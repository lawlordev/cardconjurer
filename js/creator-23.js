//URL Params
var params = new URLSearchParams(window.location.search);
const debugging = params.get('debug') != null;
if (debugging) {
	alert('debugging - 4.0');
	document.querySelectorAll('.debugging').forEach(element => element.classList.remove('hidden'));
}

//To save the server from being overloaded? Maybe?
function fixUri(input) {
	/* --- DISABLED FOR LOCAL VERSION --
	var prefix = 'https://card-conjurer.storage.googleapis.com';//'https://raw.githubusercontent.com/ImKyle4815/cardconjurer/remake';
	if (input.includes(prefix) || input.includes('http') || input.includes('data:image') || window.location.href.includes('localhost')) {
		return input;
	} else {
		return prefix + input; //input.replace('/img/frames', prefix + '/img/frames');
	} */
	if (typeof input !== 'string') return input;
	if (window.location.protocol === 'set-conjurer:') {
		try {
			var source = new URL(input, window.location.href);
			if (['localhost', '127.0.0.1', '::1'].includes(source.hostname)) {
				return source.pathname + source.search + source.hash;
			}
		} catch (error) {}
	}
	return input;
}
function setImageUrl(image, source) {
	image.crossOrigin = 'anonymous';
	image.src = fixUri(source);
}

const baseWidth = 1500;
const baseHeight = 2100;
const highResScale = 1.34;
// function getStandardWidth() {
// 	var value = baseWidth;
// 	if (localStorage.getItem('high-res') == 'true') {
// 		value *= highResScale;
// 	}
// 	return value;
// }
// function getStandardHeight() {
// 	var value = baseHeight;
// 	if (localStorage.getItem('high-res') == 'true') {
// 		value *= highResScale;
// 	}
// 	return value;
// }
function getStandardWidth() {
	return 2010;
}
function getStandardHeight() {
	return 2814;
}

// Trackers for bulk download
window.ImageLoadTracker = {
    promises: [],
    isTracking: false,

    // Call this to start a new tracking session.
    start: function() {
        this.promises = [];
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function() {
        this.isTracking = false;
        this.promises = [];
    },

    /**
     * Creates a promise that resolves when the image from 'src' is loaded.
     * Adds this promise to the tracking array.
     * @param {string} src - The source URL of the image to load.
     */
    track: function(src) {
        // Only track if a session is active and the src is valid.
        if (!this.isTracking || !src || src.includes('blank.png')) {
            return;
        }

        const promise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            // Resolve the promise on load.
            img.onload = () => resolve(img);
            // Also resolve on error to prevent Promise.all from failing on a single broken image.
            // The app's own error handlers will manage displaying a blank image.
            img.onerror = () => {
                console.warn(`Could not load tracked image: ${src}`);
                resolve(null); 
            };
            img.src = src;
        });
        this.promises.push(promise);
    },

    /**
     * Returns a single promise that resolves when all tracked images have finished loading.
     */
    waitForAll: function() {
        return Promise.all(this.promises);
    }
};
window.FontLoadTracker = {
    fonts: new Set(),
    isTracking: false,

    // Call this to start a new font tracking session.
    start: function() {
        this.fonts.clear();
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function() {
        this.isTracking = false;
        this.fonts.clear();
    },

    /**
     * Adds a font family to the set of required fonts for the current card.
     * @param {string} fontFamily - The name of the font family to track (e.g., 'belerenbsc').
     */
    track: function(fontFamily) {
        if (this.isTracking && fontFamily) {
            this.fonts.add(fontFamily);
        }
    },

    /**
     * Uses the document.fonts API to wait for all tracked fonts to be loaded and ready.
     * @returns {Promise} A promise that resolves when all fonts in the set are available.
     */
    waitForAll: function() {
        if (this.fonts.size === 0) {
            return Promise.resolve(); // No fonts to wait for.
        }

        const fontPromises = [];
        // The document.fonts.load() method checks if a font is ready for use.
        // It requires a size (e.g., '12px'), but the family name is the crucial part.
        for (const font of this.fonts) {
            fontPromises.push(typeof ensureCanvasFontReady === 'function'
                ? ensureCanvasFontReady(font)
                : document.fonts.load(`12px "${String(font).replace(/["\\]/g, '\\$&')}"`));
        }

        console.log('Waiting for fonts to load:', Array.from(this.fonts));
        return Promise.all(fontPromises);
    }
};

//card object
var card = {width:getStandardWidth(), height:getStandardHeight(), marginX:0, marginY:0, frames:[], artSource:fixUri('/img/blank.png'), artX:0, artY:0, artZoom:1, artRotate:0, setSymbolSource:fixUri('/img/blank.png'), setSymbolX:0, setSymbolY:0, setSymbolZoom:1, setSymbolRotate:0, watermarkSource:fixUri('/img/blank.png'), watermarkX:0, watermarkY:0, watermarkZoom:1, watermarkLeft:'none', watermarkRight:'none', watermarkColorMode:'auto', watermarkOpacity:0.4, serialNumber:'', serialTotal:'', serialX:172, serialY:1383, serialScale:1, infoUseStar:false, version:'', manaSymbols:[]};
var liveDraftCardStorageKey = '__card_conjurer_live_draft__';
var liveDraftUiStorageKey = '__card_conjurer_live_draft_ui__';
var liveDraftResetInProgress = false;
var liveDraftSaveTimer = null;
window.cardDrawingPromiseResolver = null;
//core images/masks
const black = new Image(); black.crossOrigin = 'anonymous'; black.src = fixUri('/img/black.png');
const blank = new Image(); blank.crossOrigin = 'anonymous'; blank.src = fixUri('/img/blank.png');
const right = new Image(); right.crossOrigin = 'anonymous'; right.src = fixUri('/img/frames/maskRightHalf.png');
const middle = new Image(); middle.crossOrigin = 'anonymous'; middle.src = fixUri('/img/frames/maskMiddleThird.png');
const corner = new Image(); corner.crossOrigin = 'anonymous'; corner.src = fixUri('/img/frames/cornerCutout.png');
const serial = new Image(); serial.crossOrigin = 'anonymous'; serial.src = fixUri('/img/frames/serial.png');
//art
art = new Image(); art.crossOrigin = 'anonymous'; art.src = blank.src;
art.onerror = function() {if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}}
art.onload = artEdited;
//set symbol
setSymbol = new Image(); setSymbol.crossOrigin = 'anonymous'; setSymbol.src = blank.src;
setSymbol.onerror = function() {
	if (this.src.includes('gatherer.wizards.com')) {
		notify('<a target="_blank" href="http' + this.src.split('http')[2] + '">Loading the set symbol from Gatherer failed. Please check this link to see if it exists. If it does, it may be necessary to manually download and upload the image.</a>', 5);
	}
	if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}
}
setSymbol.onload = setSymbolEdited;
//watermark
watermark = new Image(); watermark.crossOrigin = 'anonymous'; watermark.src = blank.src;
watermark.onerror = function() {if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}}
watermark.onload = watermarkEdited;
//preview canvas
var previewCanvas = document.querySelector('#previewCanvas');
var previewContext = previewCanvas.getContext('2d');
var previewRenderCommitId = 0;
var draggingArt = false;
var activeArtPointerId = null;
var artDragTarget = 'art';
var artDragLastPoint = {x: 0, y: 0};
var artDragLastClientY = 0;
var pendingArtDrag = null;
var artDragAnimationFrame = 0;

function beginPreviewRenderCommit() {
	return ++previewRenderCommitId;
}

function finishPreviewRenderCommit(commitId) {
	if (commitId !== previewRenderCommitId) return;
	var previewWell = previewCanvas.closest('.creator-canvas-well');
	if (previewWell) previewWell.dataset.renderRevision = String(commitId);
}

var canvasFontReadyPromises = new Map();
var manaSymbolImagesReadyPromise = null;

function canvasFontFamiliesFor(textObjects) {
	var families = new Set(['mplantin']);
	(textObjects || []).forEach(textObject => {
		if (!textObject) return;
		families.add(textObject.font || 'mplantin');
		var rawText = String(textObject.text || '');
		var fontCodePattern = /\{font(?!color|size)([^}]+)\}/gi;
		var fontMatch;
		while ((fontMatch = fontCodePattern.exec(rawText))) {
			if (fontMatch[1]) families.add(fontMatch[1].trim());
		}
		if (/\{roll/i.test(rawText)) families.add('belerenb');
		if (textObject.font === 'saloongirl' && rawText.includes('*')) families.add('belerenbsc');
	});
	Array.from(families).forEach(fontFamily => {
		if (fontFamily === 'mplantin') families.add('mplantini');
		if (fontFamily === 'gillsans') {
			families.add('gillsansitalic');
			families.add('gillsansbold');
			families.add('gillsansbolditalic');
		}
		if (fontFamily === 'neosans') families.add('neosansitalic');
	});
	return Array.from(families).filter(Boolean);
}

function ensureCanvasFontReady(fontFamily) {
	if (!document.fonts?.load || !fontFamily) return Promise.resolve();
	if (!canvasFontReadyPromises.has(fontFamily)) {
		var escapedFamily = String(fontFamily).replace(/["\\]/g, '\\$&');
		var fontPromise = document.fonts.load(`16px "${escapedFamily}"`, 'BESbswy')
			.catch(error => console.warn(`Could not preload canvas font: ${fontFamily}`, error));
		canvasFontReadyPromises.set(fontFamily, fontPromise);
	}
	return canvasFontReadyPromises.get(fontFamily);
}

async function ensureCanvasFontsReady(textObjects) {
	if (!document.fonts) return;
	await Promise.all(canvasFontFamiliesFor(textObjects).map(ensureCanvasFontReady));
	await document.fonts.ready;
}

function waitForRenderableImage(image, timeoutMs = 2500) {
	if (!image || image.complete) {
		return image?.decode ? image.decode().catch(() => {}) : Promise.resolve();
	}
	return new Promise(resolve => {
		var settled = false;
		var finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			image.removeEventListener('load', finish);
			image.removeEventListener('error', finish);
			resolve();
		};
		var timeout = setTimeout(finish, Math.max(0, Number(timeoutMs) || 2500));
		image.addEventListener('load', finish, {once:true});
		image.addEventListener('error', finish, {once:true});
	});
}

function ensureManaSymbolImagesReady() {
	if (!manaSymbolImagesReadyPromise) {
		manaSymbolImagesReadyPromise = Promise.all(Array.from(mana.values()).map(symbol => waitForRenderableImage(symbol.image)));
	}
	return manaSymbolImagesReadyPromise;
}
var canvasList = [];
//frame/mask picker stuff
var availableFrames = [];
var selectedFrame = null;
var selectedFrameIndex = 0;
var selectedMaskIndex = 0;
var selectedTextIndex = 0;
var replacementMasks = {};
var customCount = 0;
var lastFrameClick = null;
var lastMaskClick = null;
//for imports
var scryfallArt;
var scryfallCard;
var artLayoutReturnFocus = null;
var artSearchReturnFocus = null;
var watermarkLayoutReturnFocus = null;
var serialLayoutReturnFocus = null;
//for text
var drawTextBetweenFrames = false;
var redrawFrames = false;
var savedTextXPosition = 0;
var savedTextXPosition2 = 0;
var savedRollYPosition = null;
var savedFont = null;
var savedTextContents = {};
var savedTextFontSizes = {};
var layoutOwnedTextDefaults = {};
//for misc
var date = new Date();
card.infoYear = date.getFullYear();
document.querySelector("#info-year").value = card.infoYear;
//to avoid rerunning special scripts (planeswalker, saga, etc...)

var loadedVersions = [];
var activeCardSpecificTextTools = null;
var cardSpecificLayoutReturnFocus = null;
//Card Object managament
async function resetCardIrregularities({canvas = [getStandardWidth(), getStandardHeight(), 0, 0], resetOthers = true} = {}) {
	//misc details
	card.margins = false;
	card.bottomInfoTranslate = {x:0, y:0};
	card.bottomInfoRotate = 0;
	card.setSymbolRotate = 0;
	card.setSymbolDefaults = null;
	const setSymbolRotateInput = document.querySelector('#setSymbol-rotate');
	if (setSymbolRotateInput) setSymbolRotateInput.value = 0;
	card.bottomInfoZoom = 1;
	card.bottomInfoColor = 'white';
	replacementMasks = {};
	//rotation
	if (card.landscape) {
		// previewContext.scale(card.width/card.height, card.height/card.width);
		// previewContext.rotate(Math.PI / 2);
		// previewContext.translate(0, -card.width / 2);
		previewContext.setTransform(1, 0, 0, 1, 0, 0);
		card.landscape = false;
	}
	//card size
	card.width = canvas[0];
	card.height = canvas[1];
	card.marginX = canvas[2];
	card.marginY = canvas[3];
	//canvases
	canvasList.forEach(name => {
		if (window[name + 'Canvas'].width != card.width * (1 + card.marginX) || window[name + 'Canvas'].height != card.height * (1 + card.marginY)) {
			sizeCanvas(name);
		}
	});
	if (resetOthers) {
		clearCardSpecificTextTools();
		setBottomInfoStyle();
		//onload
		card.onload = null;

		card.hideBottomInfoBorder = false;
		card.showsFlavorBar = true;
	}
}
async function setBottomInfoStyle() {
	if (document.querySelector('#enableNewCollectorStyle').checked) {
			await loadBottomInfo({
				midLeft: {text:'{kerning3}{elemidinfo-set}{kerning0} \u2022 {kerning3}{elemidinfo-language}{kerning0}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}', x:0.0647, y:0.9548, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				topLeft: {text:'{elemidinfo-rarity} {right13}{kerning4}{elemidinfo-number}{kerning0}{savex2}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003, compactCollectorNumber:true},
				note: {text:'{loadx2} {right13}{elemidinfo-note}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				bottomLeft: {text:'NOT FOR SALE', x:0.0647, y:0.9719, width:0.8707, height:0.0143, oneLine:true, font:'gothammedium', size:0.0143, color:card.bottomInfoColor, outlineWidth:0.003},
				wizards: {name:'wizards', text:'{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast', x:0.0647, y:0.9377, width:0.8707, height:0.0167, oneLine:true, font:'mplantin', size:0.0162, color:card.bottomInfoColor, align:'right', outlineWidth:0.003},
				bottomRight: {text:'{ptshift0,0.0172}CardConjurer.com', x:0.0647, y:0.9548, width:0.8707, height:0.0143, oneLine:true, font:'mplantin', size:0.0143, color:card.bottomInfoColor, align:'right', outlineWidth:0.003}
			});
		} else {
			await loadBottomInfo({
				midLeft: {text:'{kerning3}{elemidinfo-set}{kerning0} \u2022 {kerning3}{elemidinfo-language}{kerning0}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}', x:0.0647, y:0.9548, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color: card.bottomInfoColor, outlineWidth:0.003},
				topLeft: {text:'{kerning4}{elemidinfo-number}{kerning0} {right13}{elemidinfo-rarity}{savex2}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003, compactCollectorNumber:true},
				note: {text:'{loadx2} {right13}{elemidinfo-note}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				bottomLeft: {text:'NOT FOR SALE', x:0.0647, y:0.9719, width:0.8707, height:0.0143, oneLine:true, font:'gothammedium', size:0.0143, color:card.bottomInfoColor, outlineWidth:0.003},
				wizards: {name:'wizards', text:'{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast', x:0.0647, y:0.9377, width:0.8707, height:0.0167, oneLine:true, font:'mplantin', size:0.0162, color:card.bottomInfoColor, align:'right', outlineWidth:0.003},
				bottomRight: {text:'{ptshift0,0.0172}CardConjurer.com', x:0.0647, y:0.9548, width:0.8707, height:0.0143, oneLine:true, font:'mplantin', size:0.0143, color:card.bottomInfoColor, align:'right', outlineWidth:0.003}
			});
		}
	applyCollectorStarStyle(Boolean(card.infoUseStar));
	syncCollectorStarControl();
}
//Canvas management
function sizeCanvas(name, width = Math.round(card.width * (1 + 2 * card.marginX)), height = Math.round(card.height * (1 + 2 * card.marginY))) {
	if (!window[name + 'Canvas']) {
		window[name + 'Canvas'] = document.createElement('canvas');
		window[name + 'Context'] = window[name + 'Canvas'].getContext('2d');
		canvasList[canvasList.length] = name;
	}
	window[name + 'Canvas'].width = width;
	window[name + 'Canvas'].height = height;
	if (name == 'line') { //force true to view all canvases - must restore to name == 'line' for proper kerning adjustments
		window[name + 'Canvas'].style = 'width: 20rem; height: 28rem; border: 1px solid red;';
		const label = document.createElement('div');
		label.innerHTML = name + '<br>If you can see this and don\'t want to, please clear your cache.';
		label.appendChild(window[name + 'Canvas']);
		label.classList = 'fake-hidden'; //Comment this out to view canvases
		document.body.appendChild(label);
	}
}
//create main canvases
sizeCanvas('card');
sizeCanvas('frame');
sizeCanvas('frameMasking');
sizeCanvas('frameCompositing');
sizeCanvas('text');
sizeCanvas('paragraph');
sizeCanvas('line');
sizeCanvas('watermark');
sizeCanvas('bottomInfo');
sizeCanvas('guidelines');
sizeCanvas('prePT');
//Scaling
function scaleX(input) {
	return Math.round((input + card.marginX) * card.width);
}
function scaleWidth(input) {
	return Math.round(input * card.width);
}
function scaleY(input) {
	return Math.round((input + card.marginY) * card.height);
}
function scaleHeight(input) {
	return Math.round(input * card.height);
}
//Other nifty functions
function getElementIndex(element) {
	return Array.prototype.indexOf.call(element.parentElement.children, element);
}
function getCardName() {
	if (card.text == undefined || card.text.title == undefined) {
		return 'unnamed';
	}
	var imageName = card.text.title.text || 'unnamed';
	if (card.text.nickname) {
		imageName += ' (' + card.text.nickname.text + ')';
	}
	return imageName.replace(/\{[^}]+\}/g, '');
}
function getInlineCardName() {
	if (card.text == undefined || card.text.title == undefined) {
		return 'unnamed';
	}
	var imageName = card.text.title.text || 'unnamed';
	if (card.text.nickname) {
		imageName = card.text.nickname.text;
	}
	return imageName.replace(/\{[^}]+\}/g, '');
}
//UI
function toggleCreatorTabs(event, target) {
	Array.from(document.querySelector('#creator-menu-sections').children).forEach(element => element.classList.add('hidden'));
	document.querySelector('#creator-menu-' + target).classList.remove('hidden');
	selectSelectable(event);
}
function selectSelectable(event) {
	var eventTarget = event.target.closest('.selectable');
	Array.from(eventTarget.parentElement.children).forEach(element => element.classList.remove('selected'));
	eventTarget.classList.add('selected');
}
function dragStart(event) {
	Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
	event.target.closest('.draggable').classList.add('dragging');
}
function dragEnd(event) {
	Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
}
function touchMove(event) {
	if (event.target.nodeName != 'H4') {
		event.preventDefault();
	}
	var clientX = event.touches[0].clientX;
	var clientY = event.touches[0].clientY;
	Array.from(document.querySelector('.dragging').parentElement.children).forEach(element => {
		var elementBounds = element.getBoundingClientRect();
		if (clientY > elementBounds.top && clientY < elementBounds.bottom) {
			dragOver(element, false);
		}
	})
}
function dragOver(event, drag=true) {
	var eventTarget;
	if (drag) {
		eventTarget = event.target.closest('.draggable');
	} else {
		eventTarget = event;
	}
	var movingElement = document.querySelector('.dragging');
	if (document.querySelector('.dragging') && !eventTarget.classList.contains('dragging') && eventTarget.parentElement == movingElement.parentElement) {
		var parentElement = eventTarget.parentElement;
		var elements = document.createDocumentFragment();
		var movingElementPassed = false;
		var movingElementOldIndex = -1;
		var movingElementNewIndex = -1;
		Array.from(parentElement.children).forEach((element, index) => {
			if (element == eventTarget) {
				movingElementNewIndex = index;
				if(movingElementPassed) {
					elements.appendChild(element.cloneNode(true));
					elements.appendChild(movingElement.cloneNode(true));
				} else {
					elements.appendChild(movingElement.cloneNode(true));
					elements.appendChild(element.cloneNode(true));
				}
			} else if(element != movingElement) {
				elements.appendChild(element.cloneNode(true));
			} else {
				movingElementOldIndex = index;
				movingElementPassed = true;
			}
		});
		Array.from(elements.children).forEach(element => {
			element.ondragstart = dragStart;
			element.ontouchstart = dragStart;
			element.ondragend = dragEnd;
			element.ontouchend = dragEnd;
			element.ondragover = dragOver;
			element.ontouchmove = touchMove;
			element.onclick = frameElementClicked;
			element.children[3].onclick = removeFrame;
		})
		parentElement.innerHTML = null;
		parentElement.appendChild(elements);
		if (movingElementNewIndex >= 0) {
			var originalMovingElement = card.frames[movingElementOldIndex];
			card.frames.splice(movingElementOldIndex, 1);
			card.frames.splice(movingElementNewIndex, 0, originalMovingElement);
			drawFrames();
		}
	}
}
//Set Symbols
const setSymbolAliases = new Map([
	["anb", "ana"],
	["tsb", "tsp"],
	["pmei", "sld"],
]);
//Mana Symbols
const mana = new Map();
// var manaSymbols = [];
loadManaSymbols(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
				 'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 't', 'untap', 's', 'oldtap', 'originaltap', 'purple', "inf", "alchemy"]);
loadManaSymbols(true, ['e', 'a', 'p']);
loadManaSymbols(['wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu', '2w', '2u', '2b', '2r', '2g', 'wp', 'up', 'bp', 'rp', 'gp', 'h',
				 'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup', 'purplew', 'purpleu', 'purpleb', 'purpler', 'purpleg',
				 '2purple', 'purplep', 'cw', 'cu', 'cb', 'cr', 'cg'], [1.2, 1.2]);
loadManaSymbols(['bar.png', 'whitebar.png']);
loadManaSymbols(['brush', 'whitebrush'], [2.85, 2.85]);
loadManaSymbols(['xxbgw', 'xxbrg', 'xxgub', 'xxgwu', 'xxrgw', 'xxrwu', 'xxubr', 'xxurg', 'xxwbr', 'xxwub'], [1.2, 1.2]);
loadManaSymbols(true, ['chaos'], [1.2, 1]);
loadManaSymbols(true, ['tk'], [0.8, 1]);
loadManaSymbols(true, ['planeswalker'], [0.6, 1.2]);
loadManaSymbols(true, ['+1', '+2', '+3', '+4', '+5', '+6', '+7', '+8', '+9', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9', '+0'], [1.6, 1]);
function loadManaSymbols(matchColor, manaSymbolPaths, size = [1, 1]) {
	if (typeof matchColor === 'object') {
		// Hacky way to add a default argument for matchColor without breaking the function call from other places
		size = manaSymbolPaths || [1,1];
		manaSymbolPaths = matchColor;
		matchColor = false;
	}

	manaSymbolPaths.forEach(item => {
		var manaSymbol = {};
		if (typeof item == 'string') {
			manaSymbol.name = item.split('.')[0];
			manaSymbol.path = item;
		} else {
			manaSymbol.name = item[0].split('.')[0];
			manaSymbol.path = item[0];
		}
		if (manaSymbol.name.includes('/')) {
			manaSymbol.name = manaSymbol.name.split('/');
			manaSymbol.name = manaSymbol.name[manaSymbol.name.length - 1];
		}
		if (typeof item != 'string') {
			manaSymbol.back = item[1];
			manaSymbol.backs = item[2];
			for (var i = 0; i < item[2]; i ++) {
				loadManaSymbols([manaSymbol.path.replace(manaSymbol.name, 'back' + i + item[1])])
			}
		}

		manaSymbol.matchColor = matchColor;

		manaSymbol.width = size[0];
		manaSymbol.height = size[1];
		manaSymbol.image = new Image();
		manaSymbol.image.crossOrigin = 'anonymous';
		var manaSymbolPath = '/img/manaSymbols/' + manaSymbol.path;
		if (!manaSymbolPath.includes('.png')) {
			manaSymbolPath += '.svg';
		}
		manaSymbol.image.src = fixUri(manaSymbolPath);
		mana.set(manaSymbol.name, manaSymbol);
		// manaSymbols.push(manaSymbol);
	});
}
function findManaSymbolIndex(string) {
	return mana.get(key) || -1;
}
function getManaSymbol(key) {
	return mana.get(key);
}
//FRAME TAB
function isDrawableImage(image) {
	return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function drawFrames() {
	frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
	var frameToDraw = card.frames.slice().reverse();
	var haveDrawnPrePTCanvas = false;
	frameToDraw.forEach(item => {
		if (isDrawableImage(item.image) && (item.masks || []).every(mask => isDrawableImage(mask.image))) {
			if (!haveDrawnPrePTCanvas && drawTextBetweenFrames && item.name.includes('Power/Toughness')) {
				haveDrawnPrePTCanvas = true;
				frameContext.globalCompositeOperation = 'source-over';
				frameContext.globalAlpha = 1;
				frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
			}
			frameContext.globalCompositeOperation = item.mode || 'source-over';
			frameContext.globalAlpha = item.opacity / 100 || 1;
			if (item.opacity == 0) {
				frameContext.globalAlpha = 0;
			}
			var bounds = item.bounds || {};
			var ogBounds = item.ogBounds || bounds;
			frameX = Math.round(scaleX(bounds.x || 0));
			frameY = Math.round(scaleY(bounds.y || 0));
			frameWidth = Math.round(scaleWidth(bounds.width || 1));
			frameHeight = Math.round(scaleHeight(bounds.height || 1));
			frameMaskingContext.globalCompositeOperation = 'source-over';
			frameMaskingContext.drawImage(black, 0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);
			frameMaskingContext.globalCompositeOperation = 'source-in';
			item.masks.forEach(mask => frameMaskingContext.drawImage(mask.image, scaleX((bounds.x || 0) - (ogBounds.x || 0) - ((ogBounds.x || 0) * ((bounds.width || 1) / (ogBounds.width || 1) - 1))), scaleY((bounds.y || 0) - (ogBounds.y || 0) - ((ogBounds.y || 0) * ((bounds.height || 1) / (ogBounds.height || 1) - 1))), scaleWidth((bounds.width || 1) / (ogBounds.width || 1)), scaleHeight((bounds.height || 1) / (ogBounds.height || 1))));
			if (item.preserveAlpha) { //preserves alpha, and blends colors using an alpha that only cares about the mask(s), and the user-set opacity value
				//draw the image onto a separate canvas to view its unaltered state
				frameCompositingContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
				frameCompositingContext.drawImage(item.image, frameX, frameY, frameWidth, frameHeight);
				//create pixel arrays for the existing image, new image, and alpha mask
				var existingData = frameContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
				var existingPixels = existingData.data;
				var newPixels = frameCompositingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
				var maskPixels = frameMaskingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
				const functionalAlphaMultiplier = frameContext.globalAlpha / 255;
				//manually blends colors, basing blending-alpha on the masks and desired draw-opacity, but preserving alpha
				for (var i = 0; i < existingPixels.length; i += 4) {
					const functionalAlpha = maskPixels[i + 3] * functionalAlphaMultiplier //functional alpha = alpha ignoring source image
					if (newPixels[i + 3] > 0) { //Only blend if the new image has alpha
						existingPixels[  i  ] = existingPixels[  i  ] * (1 - functionalAlpha) + newPixels[  i  ] * functionalAlpha; //RED
						existingPixels[i + 1] = existingPixels[i + 1] * (1 - functionalAlpha) + newPixels[i + 1] * functionalAlpha; //GREEN
						existingPixels[i + 2] = existingPixels[i + 2] * (1 - functionalAlpha) + newPixels[i + 2] * functionalAlpha; //BLUE
					}
				}
				frameContext.putImageData(existingData, 0, 0);
			} else {
				//mask the image
				frameMaskingContext.drawImage(item.image, frameX, frameY, frameWidth, frameHeight);
				//color overlay
				if (item.colorOverlayCheck) {frameMaskingContext.globalCompositeOperation = 'source-in'; frameMaskingContext.fillStyle = item.colorOverlay; frameMaskingContext.fillRect(0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);}
				//HSL adjustments
				if (item.hslHue || item.hslSaturation || item.hslLightness) {
					hsl(frameMaskingCanvas, item.hslHue || 0, item.hslSaturation || 0, item.hslLightness || 0);
				}
				//erase mode
				if (item.erase) {frameContext.globalCompositeOperation = 'destination-out';}
				frameContext.drawImage(frameMaskingCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
			}
		}
	});
	if (!haveDrawnPrePTCanvas && drawTextBetweenFrames) {
		haveDrawnPrePTCanvas = true;
		frameContext.globalCompositeOperation = 'source-over';
		frameContext.globalAlpha = 1;
		frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
	}
	drawCard();
}
function loadFramePacks(framePackOptions = []) {
	const framePackSelect = document.querySelector('#selectFramePack');
	if (!framePackSelect) {
		const firstFramePack = framePackOptions.find(item => item.value != 'disabled');
		if (firstFramePack) loadScript("/js/frames/pack" + firstFramePack.value + ".js");
		return;
	}
	framePackSelect.innerHTML = null;
	framePackOptions.forEach(item => {
		var framePackOption = document.createElement('option');
		framePackOption.innerHTML = item.name;
		if (item.value == 'disabled') {
			framePackOption.disabled = true;
		} else {
			framePackOption.value = item.value;
		}
		framePackSelect.appendChild(framePackOption);
	});
	loadScript("/js/frames/pack" + framePackSelect.value + ".js");
}
function loadFramePack(frameOptions = availableFrames) {
	resetDoubleClick();
	document.querySelector('#frame-picker').innerHTML = null;
	frameOptions.forEach(item => {
		var frameOption = document.createElement('div');
		frameOption.classList = 'frame-option hidden';
		frameOption.onclick = frameOptionClicked;
		var frameOptionImage = document.createElement('img');
		frameOption.appendChild(frameOptionImage);
		frameOptionImage.onload = function() {
			this.parentElement.classList.remove('hidden');
		}
		if (!item.noThumb && !item.src.includes('/img/black.png')) {
			frameOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
		} else {
			frameOptionImage.src = fixUri(item.src);
		}
		frameOptionImage.alt = '';
		var frameOptionLabel = document.createElement('p');
		frameOptionLabel.textContent = item.name;
		frameOption.appendChild(frameOptionLabel);
		document.querySelector('#frame-picker').appendChild(frameOption);

	})
	document.querySelector('#mask-picker').innerHTML = '';
	let defaultFrameIndex = frameOptions.findIndex(item => /^(colorless|eldrazi)(?: regular)? frame/i.test(item.name || ''));
	if (defaultFrameIndex < 0) {
		defaultFrameIndex = frameOptions.findIndex(item => /^white(?: regular)? frame/i.test(item.name || ''));
	}
	document.querySelector('#frame-picker').children[defaultFrameIndex < 0 ? 0 : defaultFrameIndex].click();
	const automaticallyUpdateFrame = document.querySelector('#automaticallyUpdateFrame');
	if (localStorage.getItem('autoLoadFrameVersion') == 'true' && (!automaticallyUpdateFrame || !automaticallyUpdateFrame.checked)) {
		document.querySelector('#loadFrameVersion').click();
	}
}
function autoLoadFrameVersion() {
	localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}
function frameOptionClicked(event) {
	const button = doubleClick(event, 'frame');
	const clickedFrameOption = event.target.closest('.frame-option');
	const newFrameIndex = getElementIndex(clickedFrameOption);
	if (newFrameIndex != selectedFrameIndex || document.querySelector('#mask-picker').innerHTML == '') {
		resetDoubleClick();
		Array.from(document.querySelectorAll('.frame-option.selected')).forEach(element => element.classList.remove('selected'));
		clickedFrameOption.classList.add('selected');
		selectedFrameIndex = newFrameIndex;
		if (!availableFrames[selectedFrameIndex].noDefaultMask) {
			document.querySelector('#mask-picker').innerHTML = '<div class="mask-option" onclick="maskOptionClicked(event)"><img src="' + black.src + '"><p>No Mask</p></div>';
		} else {
			document.querySelector('#mask-picker').innerHTML = '';
		}
		document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', No Mask)';
		if (availableFrames[selectedFrameIndex].masks) {
			availableFrames[selectedFrameIndex].masks.forEach(item => {
				const maskOption = document.createElement('div');
				maskOption.classList = 'mask-option hidden';
				maskOption.onclick = maskOptionClicked;
				const maskOptionImage = document.createElement('img');
				maskOption.appendChild(maskOptionImage);
				maskOptionImage.onload = function() {
					this.parentElement.classList.remove('hidden');
				}
				maskOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
				const maskOptionLabel = document.createElement('p');
				maskOptionLabel.innerHTML = item.name;
				maskOption.appendChild(maskOptionLabel);
				document.querySelector('#mask-picker').appendChild(maskOption);
			});
		}
		const firstChild = document.querySelector('#mask-picker').firstChild;
		firstChild.classList.add('selected');
		firstChild.click();
	} else if (button) { button.click(); resetDoubleClick(); }
}
function maskOptionClicked(event) {
	var button = doubleClick(event, 'mask');
	const clickedMaskOption = event.target.closest('.mask-option');
	(document.querySelector('.mask-option.selected').classList || document.querySelector('body').classList).remove('selected');
	clickedMaskOption.classList.add('selected');
	const newMaskIndex = getElementIndex(clickedMaskOption)
	if (newMaskIndex != selectedMaskIndex) { button = null; }
	selectedMaskIndex = newMaskIndex;
	var selectedMaskName = 'No Mask'
	if (selectedMaskIndex > 0) {selectedMaskName = availableFrames[selectedFrameIndex].masks[selectedMaskIndex - 1].name;}
	document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', ' + selectedMaskName + ')';
	if (button) { button.click(); resetDoubleClick(); }
}
function resetDoubleClick() {
	lastFrameClick, lastMaskClick = null, null;
}
function doubleClick(event, maskOrFrame) {
	const currentClick = (new Date()).getTime();
	var lastClick = null;
	if (maskOrFrame == 'mask') {
		lastClick = lastMaskClick;
		lastMaskClick = currentClick;
	} else {
		lastClick = lastFrameClick + 0;
		lastFrameClick = currentClick + 0;
	}
	if (lastClick && lastClick + 500 > currentClick) {
		var buttonID = null;
		if (event.shiftKey) {
			buttonID = '#addToRightHalf';
		} else if (event.ctrlKey) {
			buttonID = '#addToLeftHalf';
		} else if (event.altKey) {
			buttonID = '#addToMiddleThird';
		} else {
			buttonID = '#addToFull';
		}
		return document.querySelector(buttonID);
	}
	return null;
}
function cardFrameProperties(colors, manaCost, typeLine, power, style) {
	var colors = colors.map(color => color.toUpperCase())
	if ([
			['U', 'W'],
			['B', 'W'],
			['R', 'B'],
			['G', 'B'],
			['B', 'U'],
			['R', 'U'],
			['G', 'R'],
			['W', 'R'],
			['W', 'G'],
			['U', 'G']
		].map(arr => JSON.stringify(arr) === JSON.stringify(colors)).includes(true)) {
		colors.reverse();
	}

	var isHybrid = manaCost.includes('/');

	var rules;
	if (style == 'Seventh') {
		if (typeLine.includes('Land')) {
			if (colors.length == 0 || colors.length > 2) {
				rules = 'L';
			} else {
				rules = colors[0] + 'L';
			}
		} else {
			if (colors.length == 1) {
				rules = colors[0];
			} else if (colors.length >=2) {
				rules = 'M';
			} else if (typeLine.includes("Artifact")) {
				rules = 'A';
			} else {
				rules = 'C';
			}
		}

	} else {
		if (typeLine.includes('Land')) {
			if (colors.length == 0) {
				rules = 'L';
			} else if (colors.length > 2) {
				rules = 'ML';
			} else {
				rules = colors[0] + 'L';
			}
		} else if (colors.length > 2) {
			if (style == 'Etched' && typeLine.includes('Artifact')) {
				rules = 'A';
			} else {
				rules = 'M';
			}
		} else if (colors.length != 0) {
			rules = colors[0];
		} else if (typeLine.includes('Artifact')) {
			rules = 'A';
		} else {
			rules = 'C';
		}
	}

	var rulesRight;
	if (colors.length == 2) {
		if (typeLine.includes('Land')) {
			rulesRight = colors[1] + 'L';
		} else if (style != 'Seventh') {
			rulesRight = colors[1];
		}
	}

	var pinline = rules;
	var pinlineRight = rulesRight;

	if (style == 'Seventh' && typeLine.includes('Land') && colors.length >= 2) {
		pinline = 'L';
		pinlineRight = null;
	}

	var typeTitle;
	if (colors.length >= 2) {
		if (isHybrid || typeLine.includes('Land')) {
			if (colors.length >= 3) {
				typeTitle = 'M';
			} else {
				typeTitle = 'L';
			}
		} else {
			typeTitle = 'M';
		}
	} else if (typeLine.includes('Land')) {
		if (colors.length == 0) {
			typeTitle = 'L';
		} else if (style == 'Etched') {
			if (colors.length > 2) {
				typeTitle = 'M';
			} else if (colors.length == 1) {
				typeTitle = colors[0];
			} else {
				typeTitle = 'L';
			}
		} else {
			typeTitle = colors[0] + 'L';
		}
	} else if (colors.length == 1) {
		typeTitle = colors[0];
	} else if (typeLine.includes('Artifact')) {
		typeTitle = 'A';
	} else {
		typeTitle = 'C';
	}

	var pt;
	if (power || typeLine.includes('Creature')) {
		if (typeLine.includes('Vehicle')) {
			pt = 'V';
		} else if (typeTitle == 'L') {
			pt = 'C';
		} else {
			pt = typeTitle;
		}
	}

	var frame;
	if (style == 'Seventh') {
		if (typeLine.includes('Land')) {
			frame = 'L'
		} else {
			frame = pinline;
		}
	} else if (typeLine.includes('Land')) {
		if (style == 'Etched') {
			if (colors.length > 2) {
				frame = 'M';
			} else if (colors.length > 0) {
				frame = colors[0];
			} else {
				frame = 'L';
			}
		} else {
			frame = 'L';
		}
	} else if (typeLine.includes('Vehicle')) {
		frame = 'V';
	} else if (typeLine.includes('Artifact')) {
		frame = 'A';
	} else if (colors.length > 2) {
		frame = 'M';
	} else if (colors.length == 2) {
		if (isHybrid || style == 'Etched') {
			frame = colors[0];
		} else {
			frame = 'M';
		}
	} else if (colors.length == 1) {
		frame = colors[0];
	} else {
		frame = 'C';
	}

	var frameRight;
	if (!(typeLine.includes('Vehicle') || typeLine.includes('Artifact'))) {
		if (colors.length == 2 && (isHybrid || style == 'Etched')) {
			frameRight = colors[1];
		}
	}

	return {
		'pinline': pinline,
		'pinlineRight': pinlineRight,
		'rules': rules,
		'rulesRight': rulesRight,
		'typeTitle': typeTitle,
		'pt': pt,
		'frame': frame,
		'frameRight': frameRight
	}
}

function setAutoframeNyx(value) {
	localStorage.setItem('autoframe-always-nyx', document.querySelector('#autoframe-always-nyx').checked);
	setAutoFrame();
}

var autoFramePack;

function frameThumbnailSource(frame, source = frame.src) {
	if (frame.noThumb || source.includes('/img/black.png')) return fixUri(source);
	return fixUri(source.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
}

function frameFallbackSources(frame) {
	const sources = [frame.fallbackSrc, ...(Array.isArray(frame.fallbackSrcs) ? frame.fallbackSrcs : [])];
	const frameName = String(frame.name || '');
	if (/\b(?:colorless|eldrazi)\b/i.test(frameName)) {
		const signature = frameName.replace(/\b(?:colorless|eldrazi)\b/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
		for (const neutralColor of ['Artifact', 'White']) {
			const exactName = `${neutralColor} ${signature}`.replace(/\s+/g, ' ').trim().toLowerCase();
			const exactMatch = availableFrames.find(candidate => String(candidate.name || '').toLowerCase() === exactName);
			const variantMatch = exactMatch || availableFrames.find(candidate => {
				const candidateName = String(candidate.name || '').toLowerCase();
				return candidateName.includes(neutralColor.toLowerCase()) && candidateName.includes('frame') &&
					candidateName.includes('enchantment') === frameName.toLowerCase().includes('enchantment');
			});
			if (variantMatch?.src) sources.push(variantMatch.src);
		}
	}
	return sources.filter((source, index) => source && source !== frame.src && sources.indexOf(source) === index);
}

async function addFrame(additionalMasks = [], loadingFrame = false) {
	var frameToAdd = JSON.parse(JSON.stringify(availableFrames[selectedFrameIndex]));
	var maskThumbnail = true;
	if (!loadingFrame) {
		// The frame is being added manually by the user, so we must process which mask(s) they have selected
		var noDefaultMask = 0;
		if (frameToAdd.noDefaultMask) {noDefaultMask = 1;}
		if (frameToAdd.masks && selectedMaskIndex + noDefaultMask > 0) {
			frameToAdd.masks = frameToAdd.masks.slice(selectedMaskIndex - 1 + noDefaultMask, selectedMaskIndex + noDefaultMask);
		} else {
		 	frameToAdd.masks = [];
		 	maskThumbnail = false;
		}
		additionalMasks.forEach(item => {
			if (item.name in replacementMasks) {
				const replacement = replacementMasks[item.name];
				if (typeof replacement === 'string') {
					// String value: just replace the src
					item.src = replacement;
				} else if (typeof replacement === 'object') {
					// Object value: merge properties
					Object.assign(item, replacement);
				}
			}
			frameToAdd.masks.push(item);
		});
		// Check if any mask has preserveAlpha and transfer it to the frame
		frameToAdd.masks.forEach(mask => {
			if (mask.preserveAlpha) {
				frameToAdd.preserveAlpha = true;
			}
		});
		// Likewise, we now add any complementary frames
		if ('complementary' in frameToAdd && frameToAdd.masks.length == 0) {
			if (typeof frameToAdd.complementary == 'number') {
				frameToAdd.complementary = [frameToAdd.complementary];
			} else if (typeof frameToAdd.complementary == 'string') {
				availableFrames.forEach((availableFrame, index, availableFrames) => {
				  if (availableFrame.name == frameToAdd.complementary) {
				  	frameToAdd.complementary = [index];
				  }
				})
			}
			const realFrameIndex = selectedFrameIndex;
			for (const index of frameToAdd.complementary) {
				selectedFrameIndex = index;
				await addFrame();
			}
			selectedFrameIndex = realFrameIndex;
		}
	} else {
		frameToAdd = loadingFrame;
		if (frameToAdd.masks.length == 0 || (frameToAdd.masks[0].src.includes('/img/frames/mask'))) {
			maskThumbnail = false;
		}
	}
	frameToAdd.masks.forEach(item => {
		item.image = new Image();
		item.image.crossOrigin = 'anonymous';
		item.image.src = blank.src;
		item.image.onload = drawFrames;
		ImageLoadTracker.track(fixUri(item.src));
		item.image.src = fixUri(item.src);
	});
	frameToAdd.image = new Image();
	frameToAdd.image.crossOrigin = 'anonymous'
	frameToAdd.image.src = blank.src;
	frameToAdd.image.onload = drawFrames;
	const fallbackSources = frameFallbackSources(frameToAdd);
	let fallbackIndex = 0;
	frameToAdd.image.onerror = function() {
		const fallbackSource = fallbackSources[fallbackIndex++];
		if (!fallbackSource) {
			console.warn(`Could not load frame image or any fallback: ${frameToAdd.src}`);
			this.onerror = null;
			this.src = blank.src;
			return;
		}
		console.warn(`Could not load frame image ${this.src}; using ${fallbackSource}`);
		ImageLoadTracker.track(fixUri(fallbackSource));
		this.src = fixUri(fallbackSource);
		if (frameElementImage) frameElementImage.src = frameThumbnailSource(frameToAdd, fallbackSource);
	};
	if ('stretch' in frameToAdd) {
		stretchSVG(frameToAdd);
	} else {
		ImageLoadTracker.track(fixUri(frameToAdd.src));
		frameToAdd.image.src = fixUri(frameToAdd.src);
	}
	if (!loadingFrame) {
		card.frames.unshift(frameToAdd);
	}
	var frameElement = document.createElement('div');
	frameElement.classList = 'draggable frame-element';
	frameElement.draggable = 'true';
	frameElement.ondragstart = dragStart;
	frameElement.ondragend = dragEnd;
	frameElement.ondragover = dragOver;
	frameElement.ontouchstart = dragStart;
	frameElement.ontouchend = dragEnd;
	frameElement.ontouchmove = touchMove;
	frameElement.onclick = frameElementClicked;
	var frameElementImage = document.createElement('img');
	frameElementImage.src = frameThumbnailSource(frameToAdd);
	let thumbnailFallbackIndex = 0;
	frameElementImage.onerror = function() {
		const fallbackSource = fallbackSources[thumbnailFallbackIndex++];
		if (!fallbackSource) {
			this.onerror = null;
			return;
		}
		this.src = frameThumbnailSource(frameToAdd, fallbackSource);
	};
	frameElement.appendChild(frameElementImage);
	var frameElementMask = document.createElement('img');
	if (maskThumbnail) {
		frameElementMask.src = fixUri(frameToAdd.masks[0].src.replace('.png', 'Thumb.png'));
	} else {
		frameElementMask.src = black.src;
	}
	frameElement.appendChild(frameElementMask);
	var frameElementLabel = document.createElement('h4');
	frameElementLabel.innerHTML = frameToAdd.name;
	frameToAdd.masks.forEach(item => frameElementLabel.innerHTML += ', ' + item.name);
	frameElement.appendChild(frameElementLabel);
	var frameElementClose = document.createElement('h4');
	frameElementClose.innerHTML = 'X';
	frameElementClose.classList = 'frame-element-close';
	frameElementClose.onclick = removeFrame;
	frameElement.appendChild(frameElementClose);
	document.querySelector('#frame-list').prepend(frameElement);
	bottomInfoEdited();
}
function removeFrame(event) {
	card.frames.splice(getElementIndex(event.target.parentElement), 1);
	event.target.parentElement.remove();
	drawFrames();
	bottomInfoEdited();
}
function frameElementClicked(event) {
	if (!event.target.classList.contains('frame-element-close')) {
		var selectedFrameElement = event.target.closest('.frame-element');
		selectedFrame = card.frames[Array.from(selectedFrameElement.parentElement.children).indexOf(selectedFrameElement)];
		document.querySelector('#frame-element-editor').classList.add('opened');
		selectedFrame.bounds = selectedFrame.bounds || {};
		if (selectedFrame.ogBounds == undefined) {
			selectedFrame.ogBounds = JSON.parse(JSON.stringify(selectedFrame.bounds));
		}
		// Basic manipulations
		document.querySelector('#frame-editor-x').value = scaleWidth(selectedFrame.bounds.x || 0);
		document.querySelector('#frame-editor-x').onchange = (event) => {selectedFrame.bounds.x = (event.target.value / card.width); drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-y').value = scaleHeight(selectedFrame.bounds.y || 0);
		document.querySelector('#frame-editor-y').onchange = (event) => {selectedFrame.bounds.y = (event.target.value / card.height); drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-width').value = scaleWidth(selectedFrame.bounds.width || 1);
		document.querySelector('#frame-editor-width').onchange = (event) => {selectedFrame.bounds.width = (event.target.value / card.width); drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-height').value = scaleHeight(selectedFrame.bounds.height || 1);
		document.querySelector('#frame-editor-height').onchange = (event) => {selectedFrame.bounds.height = (event.target.value / card.height); drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-opacity').value = selectedFrame.opacity || 100;
		document.querySelector('#frame-editor-opacity').onchange = (event) => {selectedFrame.opacity = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-erase').checked = selectedFrame.erase || false;
		document.querySelector('#frame-editor-erase').onchange = (event) => {selectedFrame.erase = event.target.checked; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-alpha').checked = selectedFrame.preserveAlpha || false;
		document.querySelector('#frame-editor-alpha').onchange = (event) => {selectedFrame.preserveAlpha = event.target.checked; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-color-overlay-check').checked = selectedFrame.colorOverlayCheck || false;
		document.querySelector('#frame-editor-color-overlay-check').onchange = (event) => {selectedFrame.colorOverlayCheck = event.target.checked; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-color-overlay').value = selectedFrame.colorOverlay || false;
		document.querySelector('#frame-editor-color-overlay').onchange = (event) => {selectedFrame.colorOverlay = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-hue').value = selectedFrame.hslHue || 0;
		document.querySelector('#frame-editor-hsl-hue-slider').value = selectedFrame.hslHue || 0;
		document.querySelector('#frame-editor-hsl-hue').onchange = (event) => {selectedFrame.hslHue = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-hue-slider').onchange = (event) => {selectedFrame.hslHue = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-saturation').value = selectedFrame.hslSaturation || 0;
		document.querySelector('#frame-editor-hsl-saturation-slider').value = selectedFrame.hslSaturation || 0;
		document.querySelector('#frame-editor-hsl-saturation').onchange = (event) => {selectedFrame.hslSaturation = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-saturation-slider').onchange = (event) => {selectedFrame.hslSaturation = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-lightness').value = selectedFrame.hslLightness || 0;
		document.querySelector('#frame-editor-hsl-lightness-slider').value = selectedFrame.hslLightness || 0;
		document.querySelector('#frame-editor-hsl-lightness').onchange = (event) => {selectedFrame.hslLightness = event.target.value; drawFrames(); queueLiveDraftSave();}
		document.querySelector('#frame-editor-hsl-lightness-slider').onchange = (event) => {selectedFrame.hslLightness = event.target.value; drawFrames(); queueLiveDraftSave();}
		// Removing masks
		const selectMaskElement = document.querySelector('#frame-editor-masks');
		selectMaskElement.innerHTML = null;
		const maskOptionNone = document.createElement('option');
		maskOptionNone.disabled = true;
		maskOptionNone.innerHTML = 'None Selected';
		selectMaskElement.appendChild(maskOptionNone);
		selectedFrame.masks.forEach(mask => {
			const maskOption = document.createElement('option');
			maskOption.innerHTML = mask.name;
			selectMaskElement.appendChild(maskOption);
		});
		selectMaskElement.selectedIndex = 0;
	}
}
function frameElementMaskRemoved() {
	const selectElement = document.querySelector('#frame-editor-masks');
	const selectedOption = selectElement.value;
	if (selectedOption != 'None Selected') {
		selectElement.remove(selectElement.selectedIndex);
		selectElement.selectedIndex = 0;
		selectedFrame.masks.forEach(mask => {
			if (mask.name == selectedOption) {
				selectedFrame.masks = selectedFrame.masks.filter(item => item.name != selectedOption);
				drawFrames();
				queueLiveDraftSave();
			}
		});
	}
}
function uploadMaskOption(imageSource) {
	const uploadedMask = {name:`Uploaded Image (${customCount})`, src:imageSource, noThumb:true, image: new Image()};
	customCount ++;
	selectedFrame.masks.push(uploadedMask);
	uploadedMask.image.onload = drawFrames;
	uploadedMask.image.src = imageSource;
}
function uploadFrameOption(imageSource) {
	const uploadedFrame = {name:`Uploaded Image (${customCount})`, src:imageSource, noThumb:true};
	customCount ++;
	availableFrames.push(uploadedFrame);
	loadFramePack();
}
function hsl(canvas, inputH, inputS, inputL) {
	//adjust inputs
	var hue = parseInt(inputH) / 360;
	var saturation = parseInt(inputS) / 100;
	var lightness = parseInt(inputL) / 100;
	//create needed objects
	var context = canvas.getContext('2d')
	var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	var pixels = imageData.data;
	//for every pixel...
	for (var i = 0; i < pixels.length; i += 4) {
		//grab rgb
		var r = pixels[i];
		var g = pixels[i + 1];
		var b = pixels[i + 2];
		//convert to hsl
		var res = rgbToHSL(r, g, b);
		h = res[0];
		s = res[1];
		l = res[2];
		//make adjustments
		h += hue;
		while (h > 1) {h --;}
		s = Math.min(Math.max(s + saturation, 0), 1);
		l = Math.min(Math.max(l + lightness, 0), 1);
		//convert back to rgb
		res = hslToRGB(h, s, l);
		r = res[0];
		g = res[1];
		b = res[2];
		//and reassign
		pixels[i] = r;
		pixels[i + 1] = g;
		pixels[i + 2] = b;
	}
	//then put the new image data back
	context.putImageData(imageData, 0, 0);
}
function croppedCanvas(oldCanvas, sensitivity = 0) {
	var oldContext = oldCanvas.getContext('2d');
	var newCanvas = document.createElement('canvas');
	var newContext = newCanvas.getContext('2d');
	var pixels = oldContext.getImageData(0, 0, oldCanvas.width, oldCanvas.height).data;
	var pixX = [];
	var pixY = [];
	for (var x = 0; x < oldCanvas.width; x += 1) {
		for (var y = 0; y < oldCanvas.height; y += 1) {
			if (pixels[(y * oldCanvas.width + x) * 4 + 3] > sensitivity) {
				pixX.push(x);
				pixY.push(y);
			}
		}
	}
	pixX.sort(function(a, b) { return a - b });
	pixY.sort(function(a, b) { return a - b });
	var n = pixX.length - 1;
	var newWidth = 1 + pixX[n] - pixX[0];
	var newHeight = 1 + pixY[n] - pixY[0];
	newCanvas.width = newWidth;
	newCanvas.height = newHeight;
	newContext.putImageData(oldCanvas.getContext('2d').getImageData(pixX[0], pixY[0], newWidth, newHeight), 0, 0);
	return newCanvas;
}
/*
shoutout to https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion for providing the hsl-rgb conversion algorithms
*/
function rgbToHSL(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}
function hslToRGB(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
//TEXT TAB
var writingText;
var autoFrameTimer;
var textRenderRequestId = 0;
var bottomInfoRenderRequestId = 0;
var manaInputState = {};
var currentLayoutTextKeys = new Set();
var userOptionalTextKeys = new Set();
const optionalTextboxDefinitions = {
	nickname: {name:'Nickname', text:'', x:0.14, y:0.1129, width:0.72, height:0.0243, oneLine:true, font:'mplantini', size:0.0229, color:'white', shadowX:0.0014, shadowY:0.001, align:'center'},
	pt: {name:'Power/Toughness', text:'', x:0.7928, y:0.902, width:0.1367, height:0.0372, size:0.0372, font:'belerenbsc', oneLine:true, align:'center'},
	dateStamp: {name:'Date Stamp', text:'', x:0.11, y:0.5072, width:0.78, height:0.0286, size:0.0286, font:'belerenb', oneLine:true, align:'right', color:'#ffd35b', shadowX:-0.0007, shadowY:-0.001}
};

function isPlaneswalkerTextLayout() {
	return String(card.version || '').toLowerCase().includes('planeswalker');
}

function isTallPlaneswalkerTextLayout() {
	var version = String(card.version || '').toLowerCase();
	return version.includes('planeswalker') && (version.includes('tall') || version.includes('compleated'));
}

function textFieldSupportedForCurrentCard(key) {
	return !(isPlaneswalkerTextLayout() && ['nickname', 'pt'].includes(key));
}

function optionalTextboxDefinitionForCurrentCard(key) {
	var definition = optionalTextboxDefinitions[key];
	if (!definition) return null;
	var result = {...definition};
	if (key === 'dateStamp' && isTallPlaneswalkerTextLayout()) {
		var typeY = card.text?.type?.y;
		result.y += (typeof typeY === 'number' ? typeY : 0.4967) - 0.5625;
	}
	return result;
}

function textFieldFocusState() {
	var activeElement = document.activeElement;
	if (!activeElement || !activeElement.classList.contains('text-field-input')) return null;
	return {
		key: activeElement.dataset.textKey,
		start: activeElement.selectionStart,
		end: activeElement.selectionEnd
	};
}

function loadTextOptions(textObject, replace=true) {
	textObject = textObject && typeof textObject === 'object' && !Array.isArray(textObject) ? textObject : {};
	var focusState = textFieldFocusState();
	var oldCardText = card.text || {};
	Object.entries(layoutOwnedTextDefaults).forEach(([key, ownedDefault]) => {
		if (oldCardText[key]?.text?.includes(ownedDefault.text)) {
			oldCardText[key].text = oldCardText[key].text.replace(ownedDefault.text, '');
			savedTextContents[key] = oldCardText[key].text;
		}
		delete layoutOwnedTextDefaults[key];
	});
	Object.entries(oldCardText).forEach(item => {
		savedTextContents[item[0]] = oldCardText[item[0]].text;
		if (oldCardText[item[0]].fontSize !== undefined) savedTextFontSizes[item[0]] = oldCardText[item[0]].fontSize;
	});
	if (replace) {
		currentLayoutTextKeys = new Set(Object.keys(textObject));
		card.text = textObject;
	} else {
		Object.keys(textObject).forEach(key => {
			card.text[key] = textObject[key];
		});
	}
	Object.entries(card.text).forEach(item => {
		if (oldCardText[item[0]]) {
			card.text[item[0]].text = oldCardText[item[0]].text;
		} else if (savedTextContents[item[0]] !== undefined) {
			card.text[item[0]].text = savedTextContents[item[0]];
		}
		if (oldCardText[item[0]]?.fontSize !== undefined) {
			card.text[item[0]].fontSize = oldCardText[item[0]].fontSize;
		} else if (savedTextFontSizes[item[0]] !== undefined) {
			card.text[item[0]].fontSize = savedTextFontSizes[item[0]];
		}
	});
	if (replace) {
		Object.keys(optionalTextboxDefinitions).forEach(key => {
			if (!textFieldSupportedForCurrentCard(key)) return;
			if (!card.text[key] && userOptionalTextKeys.has(key) && savedTextContents[key]) {
				if (key === 'nickname') installNicknameTextbox(savedTextContents[key]);
				else card.text[key] = {...optionalTextboxDefinitionForCurrentCard(key), text:savedTextContents[key]};
				if (card.text[key] && savedTextFontSizes[key] !== undefined) card.text[key].fontSize = savedTextFontSizes[key];
			}
		});
	}
	renderTextFieldForm(focusState);
	drawTextBuffer();
	drawNewGuidelines();
}

function setLayoutOwnedTextDefault(key, text, owner) {
	if (!card.text?.[key] || card.text[key].text !== '') return false;
	card.text[key].text = text;
	layoutOwnedTextDefaults[key] = {text:text, owner:owner || card.version || ''};
	if (typeof syncTextFieldValues === 'function') syncTextFieldValues();
	drawTextBuffer();
	return true;
}

function setSelectedTextKey(key) {
	var index = Object.keys(card.text).indexOf(key);
	if (index >= 0) selectedTextIndex = index;
}

function installNicknameTextbox(nicknameText='') {
	if (card.text.nickname) return card.text.nickname;
	if (!card.text.title) {
		card.text.nickname = {...optionalTextboxDefinitions.nickname, text:nicknameText};
		return card.text.nickname;
	}
	card.text.nickname = {
		...optionalTextboxDefinitions.nickname,
		name: 'Nickname',
		text: nicknameText
	};
	return card.text.nickname;
}

function removeNicknameTextbox() {
	if (!card.text.nickname) return;
	delete card.text.nickname;
}

function ensureOptionalTextbox(key) {
	if (!textFieldSupportedForCurrentCard(key)) return null;
	if (!card.text[key] && optionalTextboxDefinitions[key]) {
		if (key === 'nickname') installNicknameTextbox();
		else card.text[key] = optionalTextboxDefinitionForCurrentCard(key);
	}
	userOptionalTextKeys.add(key);
	setSelectedTextKey(key);
	return card.text[key];
}

function manaEditorValue(key, textObject) {
	var state = manaInputState[key];
	var parsedText = textObject?.text || '';
	return state && state.parsed === parsedText ? state.raw : parsedText;
}

function createTextFieldCard(key, textObject, optionalPlaceholder) {
	var field = document.createElement('section');
	field.className = 'text-field-card';
	field.dataset.textKey = key;

	var heading = document.createElement('div');
	heading.className = 'text-field-card-heading';
	var label = document.createElement('label');
	label.textContent = textObject.name || key;
	heading.appendChild(label);
	if (optionalPlaceholder) {
		var optionalLabel = document.createElement('span');
		optionalLabel.className = 'text-field-optional';
		optionalLabel.textContent = 'Optional';
		heading.appendChild(optionalLabel);
	}
	var layoutButton = document.createElement('button');
	layoutButton.type = 'button';
	layoutButton.className = 'text-field-layout-button';
	layoutButton.textContent = 'Layout';
	layoutButton.onclick = () => textboxEditorForKey(key);
	if (['title', 'type'].includes(key)) {
		var autoSizeLabel = document.createElement('label');
		autoSizeLabel.className = 'text-field-auto-size';
		var autoSizeInput = document.createElement('input');
		autoSizeInput.type = 'checkbox';
		autoSizeInput.checked = textObject.autoSize !== false;
		autoSizeInput.setAttribute('aria-label', `Auto-size ${textObject.name || key}`);
		autoSizeInput.onchange = () => {
			textObject.autoSize = autoSizeInput.checked;
			drawTextBuffer(0);
			if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
		};
		autoSizeLabel.append(autoSizeInput, document.createTextNode('Auto-Size'));
		heading.appendChild(autoSizeLabel);
	}
	heading.appendChild(layoutButton);
	field.appendChild(heading);

	var input = document.createElement(textObject.oneLine ? 'input' : 'textarea');
	if (textObject.oneLine) input.type = 'text';
	input.className = 'input text-field-input';
	input.dataset.textKey = key;
	input.setAttribute('aria-label', textObject.name || key);
	input.placeholder = optionalPlaceholder ? 'Leave empty to hide' : '';
	input.value = optionalPlaceholder ? '' : (textObject.manaCost ? manaEditorValue(key, textObject) : (textObject.text || ''));
	input.onfocus = () => setSelectedTextKey(key);
	if (textObject.manaCost) {
		input.oninput = () => {
			const rawValue = input.value;
			const parsedValue = typeof FRAME_REGISTRY !== 'undefined' && typeof FRAME_REGISTRY.normalizeManaCost === 'function'
				? FRAME_REGISTRY.normalizeManaCost(rawValue)
				: rawValue;
			manaInputState[key] = {raw:rawValue, parsed:parsedValue};
			textEdited(key, parsedValue, optionalPlaceholder);
		};
	} else {
		input.oninput = () => textEdited(key, input.value, optionalPlaceholder);
	}
	field.appendChild(input);
	var accessoryHTML = activeCardSpecificTextTools?.fieldAccessories?.[key];
	if (accessoryHTML && !optionalPlaceholder) {
		var accessory = document.createElement('div');
		accessory.className = 'card-specific-field-accessory';
		accessory.innerHTML = typeof accessoryHTML === 'function' ? accessoryHTML(key, textObject) : accessoryHTML;
		field.appendChild(accessory);
	}

	return field;
}

function renderTextFieldForm(focusState) {
	var form = document.querySelector('#text-field-form');
	if (!form) return;
	var fragment = document.createDocumentFragment();
	Object.entries(card.text || {}).forEach(item => {
		if (!textFieldSupportedForCurrentCard(item[0])) return;
		fragment.appendChild(createTextFieldCard(item[0], item[1], false));
	});
	Object.entries(optionalTextboxDefinitions).forEach(item => {
		if (!textFieldSupportedForCurrentCard(item[0])) return;
		if (!card.text[item[0]]) fragment.appendChild(createTextFieldCard(item[0], optionalTextboxDefinitionForCurrentCard(item[0]), true));
	});
	form.replaceChildren(fragment);
	renderCardSpecificTextTools();

	if (focusState) {
		requestAnimationFrame(() => {
			var input = form.querySelector(`.text-field-input[data-text-key="${focusState.key}"]`);
			if (!input) return;
			input.focus({preventScroll:true});
			var length = input.value.length;
			input.setSelectionRange(Math.min(focusState.start, length), Math.min(focusState.end, length));
		});
	}
}

function registerCardSpecificTextTools(config) {
	activeCardSpecificTextTools = config || null;
	renderTextFieldForm(textFieldFocusState());
}

function clearCardSpecificTextTools() {
	activeCardSpecificTextTools = null;
	document.querySelectorAll('.card-specific-field-accessory').forEach(accessory => accessory.remove());
	var host = document.querySelector('#card-specific-text-tools');
	if (host) {
		host.replaceChildren();
		host.classList.add('hidden');
	}
	closeCardSpecificLayoutDrawer(false);
}

function renderCardSpecificTextTools() {
	var host = document.querySelector('#card-specific-text-tools');
	var drawer = document.querySelector('#card-specific-layout-drawer');
	var drawerBody = document.querySelector('#card-specific-layout-body');
	if (!host || !drawer || !drawerBody) return;
	if (!activeCardSpecificTextTools) {
		host.replaceChildren();
		host.classList.add('hidden');
		drawerBody.replaceChildren();
		drawer.classList.remove('opened');
		return;
	}

	var tools = activeCardSpecificTextTools;
	var inlineHTML = typeof tools.inlineHTML === 'function' ? tools.inlineHTML() : tools.inlineHTML;
	var layoutHTML = typeof tools.layoutHTML === 'function' ? tools.layoutHTML() : tools.layoutHTML;
	var advancedHTML = typeof tools.advancedHTML === 'function' ? tools.advancedHTML() : tools.advancedHTML;
	var hasLayout = Boolean(layoutHTML);
	var hasAdvanced = Boolean(advancedHTML);
	host.classList.remove('hidden');
	host.innerHTML = `
		<div class="card-specific-tools-heading">
			<div>
				<span class="creator-eyebrow">Card-specific</span>
				<h4>${tools.title || 'Card Tools'}</h4>
				${tools.description ? `<p>${tools.description}</p>` : ''}
			</div>
			${hasLayout ? `<button type="button" class="text-field-layout-button" aria-controls="card-specific-layout-drawer" onclick="openCardSpecificLayoutDrawer(this);">Layout</button>` : ''}
		</div>
		${inlineHTML ? `<div class="card-specific-inline-controls">${inlineHTML}</div>` : ''}
		${hasAdvanced ? `
			<button type="button" class="card-specific-advanced-toggle" aria-expanded="false" aria-controls="card-specific-advanced-controls" onclick="toggleCardSpecificAdvanced(this);">
				<span>Advanced</span><span class="card-specific-chevron" aria-hidden="true"></span>
			</button>
			<div id="card-specific-advanced-controls" class="card-specific-advanced-controls hidden">${advancedHTML}</div>
		` : ''}`;

	document.querySelector('#card-specific-layout-title').textContent = `${tools.title || 'Card'} Layout`;
	drawerBody.innerHTML = layoutHTML || '';
	if (typeof tools.onRender === 'function') tools.onRender();
}

function toggleCardSpecificAdvanced(button) {
	var controls = document.querySelector('#card-specific-advanced-controls');
	if (!controls) return;
	var expanded = button.getAttribute('aria-expanded') !== 'true';
	button.setAttribute('aria-expanded', expanded);
	controls.classList.toggle('hidden', !expanded);
}

function openCardSpecificLayoutDrawer(trigger) {
	if (!activeCardSpecificTextTools?.layoutHTML) return;
	cardSpecificLayoutReturnFocus = trigger || document.activeElement;
	document.querySelector('#card-specific-layout-drawer')?.classList.add('opened');
	if (typeof activeCardSpecificTextTools.onLayoutOpen === 'function') activeCardSpecificTextTools.onLayoutOpen();
	document.querySelector('#card-specific-layout-drawer .textbox-editor-close')?.focus({preventScroll:true});
}

function closeCardSpecificLayoutDrawer(returnFocus=true) {
	var drawer = document.querySelector('#card-specific-layout-drawer');
	if (!drawer) return;
	drawer.classList.remove('opened');
	if (returnFocus && cardSpecificLayoutReturnFocus?.isConnected) cardSpecificLayoutReturnFocus.focus({preventScroll:true});
	cardSpecificLayoutReturnFocus = null;
}

document.addEventListener('keydown', event => {
	if (event.key === 'Escape' && document.querySelector('#card-specific-layout-drawer.opened')) {
		closeCardSpecificLayoutDrawer();
	}
});

function syncTextFieldValues() {
	document.querySelectorAll('.text-field-input').forEach(input => {
		var textObject = card.text && card.text[input.dataset.textKey];
		var intendedValue = textObject?.manaCost
			? manaEditorValue(input.dataset.textKey, textObject)
			: (textObject?.text || '');
		if (textObject && input.value !== intendedValue) {
			input.value = intendedValue;
		}
	});
}

function textOptionClicked(event) {
	selectedTextIndex = getElementIndex(event.target);
	document.querySelector('#text-editor').value = Object.entries(card.text)[selectedTextIndex][1].text;
	document.querySelector('#text-editor-font-size').value = Object.entries(card.text)[selectedTextIndex][1].fontSize;
	selectSelectable(event);
}
function textboxEditorForKey(key) {
	ensureOptionalTextbox(key);
	setSelectedTextKey(key);
	textboxEditor();
}
function textboxEditor() {
	var selectedTextbox = card.text[Object.keys(card.text)[selectedTextIndex]];
	if (!selectedTextbox) return;
	document.querySelector('#textbox-editor-title').textContent = `${selectedTextbox.name || 'Text'} Layout`;
	document.querySelector('#textbox-editor').classList.add('opened');
	document.querySelector('#textbox-editor-x').value = scaleWidth(selectedTextbox.x || 0);
	document.querySelector('#textbox-editor-x').onchange = (event) => {selectedTextbox.x = (event.target.value / card.width); drawTextBuffer(); queueLiveDraftSave();}
	document.querySelector('#textbox-editor-y').value = scaleHeight(selectedTextbox.y || 0);
	document.querySelector('#textbox-editor-y').onchange = (event) => {selectedTextbox.y = (event.target.value / card.height); drawTextBuffer(); queueLiveDraftSave();}
	document.querySelector('#textbox-editor-width').value = scaleWidth(selectedTextbox.width || 1);
	document.querySelector('#textbox-editor-width').onchange = (event) => {selectedTextbox.width = (event.target.value / card.width); drawTextBuffer(); queueLiveDraftSave();}
	document.querySelector('#textbox-editor-height').value = scaleHeight(selectedTextbox.height || 1);
	document.querySelector('#textbox-editor-height').onchange = (event) => {selectedTextbox.height = (event.target.value / card.height); drawTextBuffer(); queueLiveDraftSave();}
	document.querySelector('#textbox-editor-font-size').value = selectedTextbox.fontSize || 0;
	document.querySelector('#textbox-editor-font-size').oninput = (event) => {selectedTextbox.fontSize = event.target.value; drawTextBuffer(); queueLiveDraftSave();}
}
function textEdited(key, value, optionalPlaceholder=false) {
	if (typeof key === 'string') {
		var textObject = card.text[key];
		if (!textObject && optionalTextboxDefinitions[key]) textObject = ensureOptionalTextbox(key);
		if (textObject) {
			textObject.text = curlyQuotes(value);
			savedTextContents[key] = textObject.text;
			setSelectedTextKey(key);
			if (optionalPlaceholder && !value && !currentLayoutTextKeys.has(key)) {
				if (key === 'nickname') removeNicknameTextbox();
				else delete card.text[key];
				userOptionalTextKeys.delete(key);
			}
		}
	} else {
		syncTextFieldValues();
	}
	const editedTextObject = typeof key === 'string' ? card.text[key] : null;
	drawTextBuffer(editedTextObject?.manaCost ? 35 : 160);
	const flipsideColorEdited = key === 'flipSideReminder';
	const landRulesColorEdited = key === 'rules' && (card.text?.type?.text || '').toLowerCase().includes('land');
	if (typeof key !== 'string' || editedTextObject?.manaCost || key === 'type' || key === 'nickname' || flipsideColorEdited || landRulesColorEdited) {
		autoFrameBuffer(editedTextObject?.manaCost || flipsideColorEdited ? 120 : 500);
	}
	if ((key === 'type' || editedTextObject?.manaCost || flipsideColorEdited || landRulesColorEdited) && typeof renderFrameCustomize === 'function') renderFrameCustomize();
	if (typeof syncAutomaticWatermarkColors === 'function') syncAutomaticWatermarkColors();
	if (key === 'ability3') autoUpdatePlaneswalkerStyleFromAbility4();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}

var planeswalkerStyleAutoUpdatePending = false;
async function autoUpdatePlaneswalkerStyleFromAbility4() {
	if (planeswalkerStyleAutoUpdatePending || typeof applyFrameCustomization !== 'function') return;
	var fourthAbilityHasText = Boolean(card.text?.ability3?.text?.trim());
	var targetStyle = ({
		planeswalkerRegular:fourthAbilityHasText ? 'PlaneswalkerTall' : null,
		planeswalkerTall:fourthAbilityHasText ? null : 'PlaneswalkerRegular',
		planeswalkerBorderless:fourthAbilityHasText ? 'PlaneswalkerTallBorderless' : null,
		planeswalkerTallBorderless:fourthAbilityHasText ? null : 'PlaneswalkerBorderless'
	})[card.version];
	if (!targetStyle) return;
	planeswalkerStyleAutoUpdatePending = true;
	try {
		await applyFrameCustomization(targetStyle);
	} finally {
		planeswalkerStyleAutoUpdatePending = false;
	}
}
function textFieldFontSizeEdited(key, value) {
	var textObject = card.text[key] || ensureOptionalTextbox(key);
	textObject.fontSize = value;
	savedTextFontSizes[key] = value;
	drawTextBuffer();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}
function fontSizedEdited() {
	var key = Object.keys(card.text)[selectedTextIndex];
	if (key) textFieldFontSizeEdited(key, document.querySelector('#text-editor-font-size').value);
}
function drawTextBuffer(delay=160) {
	clearTimeout(writingText);
	var requestId = ++textRenderRequestId;
	writingText = setTimeout(() => drawText(requestId), delay);
}
function autoFrameBuffer(delay=500) {
	clearTimeout(autoFrameTimer);
	autoFrameTimer = setTimeout(autoFrame, delay);
}
async function drawText(requestId) {
	if (requestId == null) requestId = ++textRenderRequestId;
	var previewCommitId = beginPreviewRenderCommit();
	var textObjects = Object.values(card.text || {});
	await Promise.all([
		ensureCanvasFontsReady(textObjects),
		ensureManaSymbolImagesReady()
	]);
	if (requestId !== textRenderRequestId) {
		return false;
	}
	textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
	prePTContext.clearRect(0, 0, prePTCanvas.width, prePTCanvas.height);
	drawTextBetweenFrames = false;
	var renderedTextBounds = {};
	var textEntries = Object.entries(card.text || {});
	var orderedTextEntries = textEntries.filter(entry => entry[1]?.manaCost).concat(textEntries.filter(entry => !entry[1]?.manaCost));
	for (var textObject of orderedTextEntries) {
		var fittedTextObject = collisionAwareTextObject(textObject[0], textObject[1], renderedTextBounds);
		renderedTextBounds[textObject[0]] = writeText(fittedTextObject, textContext);
		continue;
	}
	if (drawTextBetweenFrames || redrawFrames) {
		drawFrames();
		if (!drawTextBetweenFrames) {
			redrawFrames = false;
		}
	} else {
		drawCard();
	}
	finishPreviewRenderCommit(previewCommitId);
	return true;
}

function primaryManaBounds(renderedTextBounds) {
	var entry = Object.entries(card.text || {}).find(item => item[1]?.manaCost && !/flip|back/i.test(item[0]));
	return entry ? renderedTextBounds[entry[0]] : null;
}

function setSymbolVisualLeft() {
	if (!card.setSymbolBounds || !setSymbol || !setSymbol.complete || !setSymbol.naturalWidth || !setSymbol.naturalHeight || setSymbol.src.includes('/img/blank.png')) return null;
	var width = setSymbol.width * Number(card.setSymbolZoom || 0);
	var height = setSymbol.height * Number(card.setSymbolZoom || 0);
	if (!width || !height) return null;
	var rotation = Math.PI * Number(card.setSymbolRotate || 0) / 180;
	var visualWidth = Math.abs(width * Math.cos(rotation)) + Math.abs(height * Math.sin(rotation));
	return scaleX(Number(card.setSymbolX || 0)) + width / 2 - visualWidth / 2;
}

function collisionAwareTextObject(key, textObject, renderedTextBounds) {
	if (!['title', 'type'].includes(key) || textObject.autoSize === false || !textObject.oneLine) return textObject;
	var fitted = Object.assign({}, textObject);
	fitted.autoSizeVerticalCenter = true;
	var textLeft = scaleX(Number(textObject.x || 0));
	var configuredRight = textLeft + scaleWidth(Number(textObject.width || 1));
	var obstacleLeft = null;
	if (key === 'title') {
		var manaBounds = primaryManaBounds(renderedTextBounds);
		if (manaBounds && manaBounds.width > 0) obstacleLeft = manaBounds.left;
	} else {
		obstacleLeft = setSymbolVisualLeft();
	}
	if (Number.isFinite(obstacleLeft)) {
		var fittedRight = Math.min(configuredRight, obstacleLeft - 8);
		fitted.width = Math.max(1, fittedRight - textLeft) / card.width;
	}
	return fitted;
}
var justifyWidth = 90;
let manaSymbolsToRender = [];
//Split CJK characters individually so Japanese/Chinese text can wrap per-character
function splitCJKCharacters(splitText) {
	var result = [];
	for (var i = 0; i < splitText.length; i++) {
		var segment = splitText[i];
		if (segment.includes('{') || segment === ' ') {
			result.push(segment);
		} else if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(segment)) {
			for (var j = 0; j < segment.length; j++) {
				result.push(segment[j]);
			}
		} else {
			result.push(segment);
		}
	}
	return result;
}
//Pre-scan ruby codes to find the smallest annotation size needed so all ruby text is consistent
function prescanRubySize(splitText, textObject, ctx, textSize, fontStyle, font, fontExt) {
	var annSize = textObject.vertical ? textSize * 0.35 : textSize * 0.5;
	for (var i = 0; i < splitText.length; i++) {
		var word = splitText[i];
		if (!word || !word.toLowerCase().startsWith('{ruby:')) { continue; }
		var parts = word.replace(/[{}]/g, '').split(':');
		var base = parts[1] || '';
		var annotation = parts[2] || '';
		if (base.length == 0) { continue; }
		if (textObject.vertical) {
			var charsPerBase = Math.ceil(annotation.length / base.length);
			for (var j = 0; j < base.length; j++) {
				var charCount = Math.min(charsPerBase, annotation.length - j * charsPerBase);
				if (charCount > 0) {
					annSize = Math.min(annSize, textSize / charCount);
				}
			}
		} else {
			var baseWidth = ctx.measureText(base).width;
			ctx.font = fontStyle + annSize + 'px ' + font + fontExt;
			var annWidth = ctx.measureText(annotation).width;
			if (annWidth > baseWidth && baseWidth > 0) {
				annSize = Math.min(annSize, annSize * (baseWidth / annWidth));
			}
			ctx.font = fontStyle + textSize + 'px ' + font + fontExt;
		}
	}
	return annSize;
}
//Draw ruby text (base with annotation above or to the right)
function drawRubyText(word, textObject, ctx, paragraphCtx, lineCanvas, annSize, state, opts) {
	var parts = word.replace(/[{}]/g, '').split(':');
	var base = parts[1] || '';
	var annotation = parts[2] || '';
	var savedFont = ctx.font;
	if (textObject.vertical) {
		drawRubyVertical(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont);
	} else {
		drawRubyHorizontal(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont);
	}
}
//Vertical ruby: base chars stacked top-to-bottom, annotation to the right
function drawRubyVertical(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont) {
	var charsPerBase = Math.ceil(annotation.length / base.length);
	for (var i = 0; i < base.length; i++) {
		var baseChar = base[i];
		var annStart = i * charsPerBase;
		var annChars = annotation.substring(annStart, Math.min(annStart + charsPerBase, annotation.length));
		//Flush line before drawing next base character
		if (i > 0) {
			var hAdj = 0;
			if (opts.textAlign == 'center') { hAdj = (opts.textWidth - state.currentX) / 2; }
			else if (opts.textAlign == 'right') { hAdj = opts.textWidth - state.currentX; }
			if (state.currentX > state.widestLineWidth) { state.widestLineWidth = state.currentX; }
			paragraphCtx.drawImage(lineCanvas, hAdj, state.currentY);
			state.lineY = 0;
			ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
			state.currentX = opts.startingCurrentX;
			state.currentY += opts.textSize + state.newLineSpacing;
			state.newLineSpacing = (textObject.lineSpacing || 0) * opts.textSize;
		}
		//Draw base character
		var baseCharWidth = ctx.measureText(baseChar).width;
		var baseY = opts.canvasMargin + opts.textSize * opts.textFontHeightRatio + state.lineY;
		if (opts.textOutlineWidth >= 1) { ctx.strokeText(baseChar, state.currentX + opts.canvasMargin, baseY); }
		ctx.fillText(baseChar, state.currentX + opts.canvasMargin, baseY);
		//Draw annotation chars to the right, centered vertically
		if (annChars.length > 0) {
			ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
			var annX = state.currentX + opts.canvasMargin + baseCharWidth;
			var totalAnnH = annChars.length * annSize;
			var baseTopY = opts.canvasMargin + state.lineY;
			var annStartY = baseTopY + (opts.textSize - totalAnnH) / 2 + annSize * opts.textFontHeightRatio - opts.textSize * 0.08;
			for (var j = 0; j < annChars.length; j++) {
				var charY = annStartY + j * annSize;
				if (opts.textOutlineWidth >= 1) { ctx.strokeText(annChars[j], annX, charY); }
				ctx.fillText(annChars[j], annX, charY);
			}
			ctx.font = savedFont;
		}
		state.currentX += baseCharWidth;
	}
}
//Horizontal ruby: annotation drawn above base text, evenly distributed
function drawRubyHorizontal(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont) {
	var baseWidth = ctx.measureText(base).width;
	ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
	var annWidth = ctx.measureText(annotation).width;
	ctx.font = savedFont;
	var totalWidth = Math.max(baseWidth, annWidth);
	//Wrap to new line if needed
	if (totalWidth + state.currentX >= opts.textWidth && opts.textArcRadius == 0 && !opts.textOneLine) {
		var hAdj = 0;
		if (opts.textAlign == 'center') { hAdj = (opts.textWidth - state.currentX) / 2; }
		else if (opts.textAlign == 'right') { hAdj = opts.textWidth - state.currentX; }
		if (state.currentX > state.widestLineWidth) { state.widestLineWidth = state.currentX; }
		paragraphCtx.drawImage(lineCanvas, hAdj, state.currentY);
		state.lineY = 0;
		ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
		state.currentX = opts.startingCurrentX;
		state.currentY += opts.textSize + state.newLineSpacing;
		state.newLineSpacing = (textObject.lineSpacing || 0) * opts.textSize;
	}
	var baseOffsetX = (totalWidth - baseWidth) / 2;
	var baseY = opts.canvasMargin + opts.textSize * opts.textFontHeightRatio + state.lineY;
	//Position annotation using font metrics for zero-gap placement
	var baseMetrics = ctx.measureText(base);
	var baseFontAscent = baseMetrics.fontBoundingBoxAscent || opts.textSize * opts.textFontHeightRatio;
	ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
	var annMetrics = ctx.measureText(annotation);
	var annFontDescent = annMetrics.fontBoundingBoxDescent || annSize * 0.1;
	var annY = baseY - baseFontAscent - annFontDescent;
	//Distribute annotation chars evenly when base is wider
	if (annotation.length > 1 && baseWidth > annWidth) {
		var charWidths = [];
		var totalCharWidth = 0;
		for (var i = 0; i < annotation.length; i++) {
			var w = ctx.measureText(annotation[i]).width;
			charWidths.push(w);
			totalCharWidth += w;
		}
		var spacing = (baseWidth - totalCharWidth) / (annotation.length + 1);
		var drawX = state.currentX + opts.canvasMargin + baseOffsetX + spacing;
		for (var i = 0; i < annotation.length; i++) {
			if (opts.textOutlineWidth >= 1) { ctx.strokeText(annotation[i], drawX, annY); }
			ctx.fillText(annotation[i], drawX, annY);
			drawX += charWidths[i] + spacing;
		}
	} else {
		var annOffsetX = (totalWidth - annWidth) / 2;
		if (opts.textOutlineWidth >= 1) { ctx.strokeText(annotation, state.currentX + opts.canvasMargin + annOffsetX, annY); }
		ctx.fillText(annotation, state.currentX + opts.canvasMargin + annOffsetX, annY);
	}
	ctx.font = savedFont;
	//Draw base text
	if (opts.textOutlineWidth >= 1) { ctx.strokeText(base, state.currentX + opts.canvasMargin + baseOffsetX, baseY); }
	ctx.fillText(base, state.currentX + opts.canvasMargin + baseOffsetX, baseY);
	state.currentX += totalWidth;
}
function splitRulesAndFlavorText(rawText) {
	const markers = ['{flavor}', '{oldflavor}', '///'];
	const indices = markers.map(marker => rawText.indexOf(marker)).filter(index => index >= 0);
	const flavorIndex = indices.length ? Math.min(...indices) : -1;
	return flavorIndex < 0
		? {rulesText:rawText, flavorText:''}
		: {rulesText:rawText.substring(0, flavorIndex), flavorText:rawText.substring(flavorIndex)};
}

function removeReminderTextFromRules(rulesText) {
	let text = rulesText
		.replace(/\{i\}\s*(?=\()/gi, '')
		.replace(/(\))\s*\{\/i\}/gi, '$1');
	let output = '';
	let depth = 0;
	for (const character of text) {
		if (character === '(') {
			if (depth === 0) output = output.replace(/[ \t]+$/, '');
			depth++;
		} else if (character === ')' && depth > 0) {
			depth--;
		} else if (depth === 0) {
			output += character;
		}
	}
	return output.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+(?=\n|\{lns\}|\{line\})/g, '');
}

function italicizeReminderTextInRules(rulesText) {
	return rulesText.replace(/\(([^)]+)\)/g, (match, contents, offset, source) => {
		const before = source.substring(Math.max(0, offset - 3), offset).toLowerCase();
		const after = source.substring(offset + match.length, offset + match.length + 4).toLowerCase();
		return before === '{i}' && after === '{/i}' ? match : `{i}(${contents}){/i}`;
	});
}

function reminderTextOptionChanged(input) {
	localStorage.setItem(input.id, String(input.checked));
	drawTextBuffer();
}

function writeText(textObject, targetContext) {
	var finalRenderedBounds = null;
	manaSymbolsToRender = [];
	//Most bits of info about text loaded, with defaults when needed
	var textX = scaleX(textObject.x) || scaleX(0);
	var textY = scaleY(textObject.y) || scaleY(0);
	var textWidth = scaleWidth(textObject.width) || scaleWidth(1);
	var textHeight = scaleHeight(textObject.height) || scaleHeight(1);
	var startingTextSize = scaleHeight(textObject.size) || scaleHeight(0.038);
	var textFontHeightRatio = 0.7;
	var textBounded = textObject.bounded || true;
	var textOneLine = textObject.oneLine || false;
	var textManaCost = textObject.manaCost || false;
	var textAllCaps = textObject.allCaps || false;
	var textManaSpacing = scaleWidth(textObject.manaSpacing) || 0;
	//Buffers the canvases accordingly
	var canvasMargin = 300;
	paragraphCanvas.width = textWidth + 2 * canvasMargin;
	paragraphCanvas.height = textHeight + 2 * canvasMargin;
	lineCanvas.width = textWidth + 2 * canvasMargin;
	lineCanvas.height = startingTextSize + 2 * canvasMargin;
	//Preps the text string
	var splitString = '6GJt7eL8';
	var rawText = String(textObject.text || '');
	if (document.querySelector('#hide-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
		var textParts = splitRulesAndFlavorText(rawText);
		rawText = removeReminderTextFromRules(textParts.rulesText) + textParts.flavorText;
	} else if (document.querySelector('#italicize-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
		var textParts = splitRulesAndFlavorText(rawText);
		rawText = italicizeReminderTextInRules(textParts.rulesText) + textParts.flavorText;
	}
	if (textAllCaps) {
		rawText = rawText.toUpperCase();
	}
	if ((textObject.name == 'wizards' || textObject.name == 'copyright') && params.get('copyright') != null && (params.get('copyright') != '' || card.margins)) {
		rawText = params.get('copyright'); //so people using CC for custom card games without WotC's IP can customize their copyright info
		if (rawText == 'none') { rawText = ''; }
	}
	if (rawText.toLowerCase().includes('{cardname}') || rawText.toLowerCase().includes('~')) {
		rawText = rawText.replace(/{cardname}|~/ig, getInlineCardName());
	}
	if (document.querySelector('#info-artist').value == '') {
		rawText = rawText.replace('\uFFEE{savex2}{elemidinfo-artist}', '');
	}
	if (rawText.includes('///')) {
		rawText = rawText.replace(/\/\/\//g, '{flavor}');
	}
	if (rawText.includes('//')) {
		rawText = rawText.replace(/\/\//g, '{lns}');
	}

	if (card.version == 'pokemon') {
		rawText = rawText.replace(/{flavor}/g, '{oldflavor}{fontsize-20}{fontgillsansbolditalic}');
	} else if (card.version == 'dossier') {
		rawText = rawText.replace(/{flavor}(.*)/g, function(v) { return '{/indent}{lns}{bar}{lns}{fixtextalign}' + v.replace(/{flavor}/g, '').toUpperCase(); });
	} else if (!card.showsFlavorBar) {
		rawText = rawText.replace(/{flavor}/g, '{oldflavor}');
	}

	if (textObject.font == 'saloongirl') {
		rawText = rawText.replace(/\*/g, '{fontbelerenbsc}*{fontsaloongirl}');
	}
	rawText = rawText.replace(/ - /g, ' — ');
	var splitText = rawText.replace(/\n/g, '{line}').replace(/{-}/g, '\u2014').replace(/{divider}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}');
	if (rawText.trim().startsWith('{flavor}') || rawText.trim().startsWith('{oldflavor}')) {
		splitText = splitText.replace(/{flavor}/g, '{i}').replace(/{oldflavor}/g, '{i}');
	} else {
		splitText = splitText.replace(/{flavor}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}{i}').replace(/{oldflavor}/g, '{/indent}{lns}{lns}{up30}{i}');
	}
	splitText = splitText.replace(/{/g, splitString + '{').replace(/}/g, '}' + splitString).replace(/ /g, splitString + ' ' + splitString).split(splitString);

	splitText = splitText.filter(item => item);
	splitText = splitCJKCharacters(splitText);
	if (textObject.manaCost) {
		splitText = splitText.filter(item => item != ' ');
	}
	if (textObject.vertical) {
		newSplitText = [];
		splitText.forEach((item, index) => {
			if (item.includes('{') && item.includes('}')) {
				newSplitText.push(item, '{lns}');
			} else if (item == ' ') {
				newSplitText.push(`{down${scaleHeight(0.01)}}`);
			} else {
				item.split('').forEach(char => {
					if (char == '’') {
						newSplitText.push(`{right${startingTextSize * 0.6}}`, '’', '{lns}', `{up${startingTextSize * 0.75}}`);
					} else if (textManaCost && index == splitText.length-1) {
						newSplitText.push(char);
					} else {
						newSplitText.push(char, '{lns}');
					}
				});
				// newSplitText = newSplitText.concat(item.split(''));
			}
		});
		splitText = newSplitText;
	}
	// if (textManaCost && textObject.arcStart > 0) {
	// 	splitText.reverse();
	// }
	splitText.push('');
	//Manages the redraw loop
	var drawingText = true;
	//Repeatedly tries to draw the text at smaller and smaller sizes until it fits
	outerloop: while (drawingText) {
		//Rest of the text info loaded that may have been changed by a previous attempt at drawing the text
		var textColor = textObject.color || 'black';
		if (textObject.conditionalColor != undefined) {
			var codeParams = textObject.conditionalColor.split(":");
			const tagParts = codeParams[0].split(",");
		    const colorToApply = codeParams[1];

		    for (let part of tagParts) {

		        // Split into frame name + mask rules
		        const [rawFrameName, ...maskRuleParts] = part.split("*");
		        const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

		        const positiveMasks = [];
		        const negativeMasks = [];

		        for (let rule of maskRuleParts) {
		            if (!rule) continue;
		            if (rule.startsWith("!")) {
		                negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
		            } else {
		                positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
		            }
		        }

		        const matchingFrames = card.frames.filter(f =>
		            f.name.toLowerCase().includes(frameName)
		        );

		        for (const frame of matchingFrames) {
		            const masks = frame.masks || [];

		            // --------------------------------------
		            // SPECIAL RULE:
		            // If NO masks → always match immediately
		            // --------------------------------------
		            if (masks.length === 0) {
		                textColor = colorToApply;
		                lineContext.fillStyle = textColor;
		                continue;
		            }

		            const maskNames = masks.map(m => m.name.toLowerCase());

		            // --- Positive mask rules -------------------------
		            let passesPositive = true;

		            if (positiveMasks.length > 0) {
		                passesPositive = positiveMasks.every(pos =>
		                    maskNames.some(mask => mask.includes(pos))
		                );
		            }

		            if (!passesPositive) continue;

		            // --- Negative mask rules -------------------------
		            let passesNegative = true;

		            if (negativeMasks.length > 0) {
		                passesNegative = negativeMasks.every(neg =>
		                    !maskNames.some(mask => mask.includes(neg))
		                );
		            }

		            if (!passesNegative) continue;

		            // All conditions passed
		            textColor = colorToApply;
		        }
		    }
		}
		var textFont = textObject.font || 'mplantin';
		FontLoadTracker.track(textFont);
		var textAlign = textObject.align || 'left';
		var textJustify = textObject.justify || 'left';
		var textShadowColor = textObject.shadow || 'black';
		var textShadowOffsetX = scaleWidth(textObject.shadowX) || 0;
		var textShadowOffsetY = scaleHeight(textObject.shadowY) || 0;
		var textShadowBlur = scaleHeight(textObject.shadowBlur) || 0;
		var textArcRadius = scaleHeight(textObject.arcRadius) || 0;
		var manaSymbolColor = textObject.manaSymbolColor || null;
		var textRotation = textObject.rotation || 0;
		if (textArcRadius > 0) {
			//Buffers the canvases accordingly
			var canvasMargin = 300 + textArcRadius;
			paragraphCanvas.width = textWidth + 2 * canvasMargin;
			paragraphCanvas.height = textHeight + 2 * canvasMargin;
			lineCanvas.width = textWidth + 2 * canvasMargin;
			lineCanvas.height = startingTextSize + 2 * canvasMargin;
		}
		var textArcStart = textObject.arcStart || 0;
		//Variables for tracking text position/size/font
		var currentX = 0;
		var startingCurrentX = 0;
		var currentY = 0;
		var lineY = 0;
		var newLine = false;
		var textFontExtension = '';
		var textFontStyle = textObject.fontStyle || '';
		var manaPlacementCounter = 0;
		var realTextAlign = textAlign;
		savedRollYPosition = null;
		var savedRollColor = 'black';
		var drawToPrePTCanvas = false;
		var widestLineWidth = 0;
		var oneLineInkTop = Infinity;
		var oneLineInkBottom = -Infinity;
		//variables that track various... things?
		var textSize = startingTextSize;
		var newLineSpacing = (textObject.lineSpacing || 0) * textSize;
		var ptShift = [0, 0];
		var permaShift = [0, 0];
		var fillJustify = false;
		//Finish prepping canvases
		paragraphContext.clearRect(0, 0, paragraphCanvas.width, paragraphCanvas.height);
		lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
		lineContext.letterSpacing = (scaleWidth(textObject.kerning) || 0) + 'px';
		// if (textFont == 'goudymedieval') {
		// 	lineCanvas.style.letterSpacing = '3.5px';
		// }
		textSize += parseInt(textObject.fontSize || '0');
		lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
		lineContext.fillStyle = textColor;
		lineContext.shadowColor = textShadowColor;
		lineContext.shadowOffsetX = textShadowOffsetX;
		lineContext.shadowOffsetY = textShadowOffsetY;
		lineContext.shadowBlur = textShadowBlur;
		lineContext.strokeStyle = textObject.outlineColor || 'black';
		var textOutlineWidth = scaleHeight(textObject.outlineWidth) || 0;
		var textLineCap = textObject.lineCap || 'round';
		var textLineJoin = textObject.lineJoin || 'round';
		var hideBottomInfoBorder = card.hideBottomInfoBorder || false;
		if (hideBottomInfoBorder && ['midLeft', 'topLeft', 'note', 'bottomLeft', 'wizards', 'bottomRight', 'rarity', 'copyrightLine1', 'copyrightLine2'].includes(textObject.name)) {
			textOutlineWidth = 0;
		}
		lineContext.lineWidth = textOutlineWidth;
		lineContext.lineCap = textLineCap;
		lineContext.lineJoin = textLineJoin;
		var rubyGlobalAnnSize = prescanRubySize(splitText, textObject, lineContext, textSize, textFontStyle, textFont, textFontExtension);
		//Begin looping through words/codes
		innerloop: for (word of splitText) {
			var wordToWrite = word;
			if (wordToWrite.includes('{') && wordToWrite.includes('}') || textManaCost || savedFont) {
				var possibleCode = wordToWrite.toLowerCase().replace('{', '').replace('}', '');
				wordToWrite = null;
				if (possibleCode == 'line') {
					newLine = true;
					startingCurrentX = 0;
					newLineSpacing = textSize * 0.35;
				} else if (possibleCode == 'lns' || possibleCode == 'linenospace') {
					newLine = true;
				} else if (possibleCode == 'bullet' || possibleCode == '•') {
					wordToWrite = '•';
				} else if (possibleCode == 'bar') {
					var barWidth = textWidth * 0.96;
					var barHeight = scaleHeight(0.03);
					var barImageName = 'bar';
					var barDistance = 0;
					realTextAlign = textAlign;
					textAlign = 'left';
					if (card.version == 'cartoony') {
						barImageName = 'cflavor';
						barWidth = scaleWidth(0.8547);
						barHeight = scaleHeight(0.0458);
						barDistance = -0.23;
						newLineSpacing = textSize * -0.23;
						textSize -= scaleHeight(0.0086);
					}
					lineContext.drawImage(getManaSymbol(barImageName).image, canvasMargin + (textWidth - barWidth) / 2, canvasMargin + barDistance * textSize, barWidth, barHeight);
				} else if (possibleCode == 'i') {
					if (textFont == 'gilllsans' || textFont == 'neosans') {
						textFontExtension = 'italic';
					} else if (textFont == 'mplantin') {
						textFontExtension = 'i';
						textFontStyle = textFontStyle.replace('italic ', '');
					} else {
						textFontExtension = '';
						if (!textFontStyle.includes('italic')) {textFontStyle += 'italic ';}
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == '/i') {
					textFontExtension = '';
					textFontStyle = textFontStyle.replace('italic ', '');
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == 'bold') {
					if (textFont == 'gillsans') {
						textFontExtension = 'bold';
					} else {
						if (!textFontStyle.includes('bold')) {textFontStyle += 'bold ';}
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == '/bold') {
					if (textFont == 'gillsans') {
						textFontExtension = '';
					} else {
						textFontStyle = textFontStyle.replace('bold ', '');
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == 'left') {
					textAlign = 'left';
				} else if (possibleCode == 'center') {
					textAlign = 'center';
				} else if (possibleCode == 'right') {
					textAlign = 'right';
				} else if (possibleCode == 'justify-left') {
					textJustify = 'left';
				} else if (possibleCode == 'justify-center') {
					textJustify = 'center';
				} else if (possibleCode == 'justify-right') {
					textJustify = 'right';
				} else if (possibleCode.startsWith('ruby:')) {
					var rubyState = {currentX:currentX, currentY:currentY, lineY:lineY, widestLineWidth:widestLineWidth, newLineSpacing:newLineSpacing};
					drawRubyText(word, textObject, lineContext, paragraphContext, lineCanvas, rubyGlobalAnnSize, rubyState, {
						textSize:textSize, textFontStyle:textFontStyle, textFont:textFont, textFontExtension:textFontExtension,
						textFontHeightRatio:textFontHeightRatio, textAlign:textAlign, textWidth:textWidth, textArcRadius:textArcRadius,
						textOneLine:textOneLine, textOutlineWidth:textOutlineWidth, canvasMargin:canvasMargin, startingCurrentX:startingCurrentX
					});
					currentX = rubyState.currentX; currentY = rubyState.currentY; lineY = rubyState.lineY;
					widestLineWidth = rubyState.widestLineWidth; newLineSpacing = rubyState.newLineSpacing;
					wordToWrite = null;
				} else if (possibleCode.includes('conditionalcolor')) {
				    const codeParams = possibleCode.split(":");
				    const tagParts = codeParams[1].split(",");
				    const colorToApply = codeParams[2];

				    for (let part of tagParts) {

				        // Split into frame name + mask rules
				        const [rawFrameName, ...maskRuleParts] = part.split("*");
				        const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

				        const positiveMasks = [];
				        const negativeMasks = [];

				        for (let rule of maskRuleParts) {
				            if (!rule) continue;
				            if (rule.startsWith("!")) {
				                negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
				            } else {
				                positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
				            }
				        }

				        const matchingFrames = card.frames.filter(f =>
				            f.name.toLowerCase().includes(frameName)
				        );

				        for (const frame of matchingFrames) {
				            const masks = frame.masks || [];

				            // --------------------------------------
				            // SPECIAL RULE:
				            // If NO masks → always match immediately
				            // --------------------------------------
				            if (masks.length === 0) {
				                textColor = colorToApply;
				                lineContext.fillStyle = textColor;
				                continue;
				            }

				            const maskNames = masks.map(m => m.name.toLowerCase());

				            // --- Positive mask rules -------------------------
				            let passesPositive = true;

				            if (positiveMasks.length > 0) {
				                passesPositive = positiveMasks.every(pos =>
				                    maskNames.some(mask => mask.includes(pos))
				                );
				            }

				            if (!passesPositive) continue;

				            // --- Negative mask rules -------------------------
				            let passesNegative = true;

				            if (negativeMasks.length > 0) {
				                passesNegative = negativeMasks.every(neg =>
				                    !maskNames.some(mask => mask.includes(neg))
				                );
				            }

				            if (!passesNegative) continue;

				            // All conditions passed
				            textColor = colorToApply;
				            lineContext.fillStyle = textColor;
				        }
				    }
				} else if (possibleCode.includes('fontcolor')) {
					textColor = possibleCode.replace('fontcolor', '');
					lineContext.fillStyle = textColor;
				} else if (possibleCode.includes('fontsize')) {
					if (possibleCode.slice(-2) === "pt") {
						textSize = (parseInt(possibleCode.replace('fontsize', '').replace('pt', '')) * 600 / 72) || 0;
					} else {
						textSize += parseInt(possibleCode.replace('fontsize', '')) || 0;
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode.includes('font') || savedFont) {
					textFont = word.replace('{font', '').replace('}', '');
					if (savedFont) {
						textFont = savedFont;
						wordToWrite = word;
					}
					FontLoadTracker.track(textFont);
					textFontExtension = '';
					textFontStyle = '';
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
					savedFont = null;
				} else if (possibleCode.includes('outlinecolor')) {
					lineContext.strokeStyle = possibleCode.replace('outlinecolor', '');
				} else if (possibleCode.includes('outline')) {
					textOutlineWidth = parseInt(possibleCode.replace('outline', ''));
					lineContext.lineWidth = textOutlineWidth;
				} else if (possibleCode.includes('linecap')) {
					lineContext.lineCap = possibleCode.replace('linecap', '').trim();
				} else if (possibleCode.includes('linejoin')) {
					lineContext.lineJoin = possibleCode.replace('linejoin', '').trim();
				} else if (possibleCode.includes('upinline')) {
					lineY -= parseInt(possibleCode.replace('upinline', '')) || 0;
				} else if (possibleCode.substring(0, 2) == 'up' && possibleCode != 'up') {
					currentY -= parseInt(possibleCode.replace('up', '')) || 0;
				} else if (possibleCode.includes('down')) {
					currentY += parseInt(possibleCode.replace('down', '')) || 0;
				} else if (possibleCode.includes('left')) {
					currentX -= parseInt(possibleCode.replace('left', '')) || 0;
				} else if (possibleCode.includes('right')) {
					currentX += parseInt(possibleCode.replace('right', '')) || 0;
				} else if (possibleCode.includes('shadow')) {
					if (possibleCode.includes('color')) {
						textShadowColor = possibleCode.replace('shadowcolor', '');
						lineContext.shadowColor = textShadowColor;
					} else if (possibleCode.includes('blur')) {
						textShadowBlur = parseInt(possibleCode.replace('shadowblur', '')) || 0;
						lineContext.shadowBlur = textShadowBlur
					} else if (possibleCode.includes('shadowx')) {
						textShadowOffsetX = parseInt(possibleCode.replace('shadowx', '')) || 0;
						lineContext.shadowOffsetX = textShadowOffsetX;
					} else if (possibleCode.includes('shadowy')) {
						textShadowOffsetY = parseInt(possibleCode.replace('shadowy', '')) || 0;
						lineContext.shadowOffsetY = textShadowOffsetY;
					} else {
						textShadowOffsetX = parseInt(possibleCode.replace('shadow', '')) || 0;
						textShadowOffsetY = textShadowOffsetX;
						lineContext.shadowOffsetX = textShadowOffsetX;
						lineContext.shadowOffsetY = textShadowOffsetY;
					}
				} else if (possibleCode == 'planechase') {
					var planechaseHeight = textSize * 1.8;
					lineContext.drawImage(getManaSymbol('chaos').image, currentX + canvasMargin, canvasMargin, planechaseHeight * 1.2, planechaseHeight);
					currentX += planechaseHeight * 1.3;
					startingCurrentX += planechaseHeight * 1.3;
				} else if (possibleCode == 'indent') {
					startingCurrentX += currentX;
					currentY -= 10;
				} else if (possibleCode == '/indent') {
					startingCurrentX = 0;
				} else if (possibleCode.includes('elemid')) {
					if (document.querySelector('#' + word.replace('{elemid', '').replace('}', ''))) {
						wordToWrite = document.querySelector('#' + word.replace('{elemid', '').replace('}', '')).value || '';
					}
					if (word.includes('set')) {
						var midLeftText = card.bottomInfo?.midLeft?.text;
						if (midLeftText) {
							var bottomTextSubstring = midLeftText.substring(0, midLeftText.indexOf('  {savex}')).replace('{elemidinfo-set}', document.querySelector('#info-set').value || '').replace('{elemidinfo-language}', document.querySelector('#info-language').value || '');
							justifyWidth = lineContext.measureText(bottomTextSubstring).width;
						}
					} else if (word.includes('number') && wordToWrite.includes('/') && !textObject.compactCollectorNumber && !['pokemon', '8thPlaytest'].includes(card.version)) {
						fillJustify = true;
						wordToWrite = Array.from(wordToWrite).join(' ');
					}
				} else if (possibleCode == 'savex') {
					savedTextXPosition = currentX;
				} else if (possibleCode == 'loadx') {
					if (savedTextXPosition > currentX) {
						currentX = savedTextXPosition;
					}
				} else if (possibleCode == 'savex2') {
					savedTextXPosition2 = currentX;
				} else if (possibleCode == 'loadx2') {
					if (savedTextXPosition2 > currentX) {
						currentX = savedTextXPosition2;
					}
				} else if (possibleCode.includes('ptshift')) {
					if (card.frames.findIndex(element => element.name.toLowerCase().includes('power/toughness')) >= 0 || card.version.includes('planeswalker') || ['commanderLegends', 'm21', 'mysticalArchive', 'customDualLands', 'feuerAmeiseKaldheim'].includes(card.version)) {
						ptShift[0] = scaleWidth(parseFloat(possibleCode.replace('ptshift', '').split(',')[0]));
						ptShift[1] = scaleHeight(parseFloat(possibleCode.split(',')[1]));
					}
				} else if (possibleCode.includes('rollcolor')) {
					savedRollColor = possibleCode.replace('rollcolor', '') || 'black';
				} else if (possibleCode.includes('roll')) {
					drawTextBetweenFrames = true;
					redrawFrames = true;
					drawToPrePTCanvas = true;
					if (savedRollYPosition == null) {
						savedRollYPosition = currentY;
					} else {
						savedRollYPosition = -1;
					}
					savedFont = textFont;
					lineContext.font = textFontStyle + textSize + 'px ' + 'belerenb' + textFontExtension;
					wordToWrite = possibleCode.replace('roll', '');
				} else if (possibleCode.includes('permashift')) {
					permaShift = [parseFloat(possibleCode.replace('permashift', '').split(',')[0]), parseFloat(possibleCode.split(',')[1])];
				} else if (possibleCode.includes('arcradius')) {
					textArcRadius = parseInt(possibleCode.replace('arcradius', '')) || 0;
				} else if (possibleCode.includes('arcstart')) {
					textArcStart = parseFloat(possibleCode.replace('arcstart', '')) || 0;
				} else if (possibleCode.includes('rotate')) {
					textRotation = parseInt(possibleCode.replace('rotate', '')) % 360;
				} else if (possibleCode === 'manacolordefault') {
					manaSymbolColor = null;
				} else if (possibleCode.includes('manacolor')) {
					manaSymbolColor = possibleCode.replace('manacolor', '') || 'white';
				} else if (possibleCode.includes('fixtextalign')) {
					textAlign = realTextAlign;
				} else if (possibleCode.includes('kerning')) {
					lineContext.letterSpacing = possibleCode.replace('kerning', '') + 'px';
					lineContext.font = lineContext.font; //necessary for the letterspacing update to be recognized
				} else if (getManaSymbol(possibleCode.replaceAll('/', '')) != undefined || getManaSymbol(possibleCode.replaceAll('/', '').split('').reverse().join('')) != undefined) {
					var possibleCode = possibleCode.replaceAll('/', '');
					var manaSymbol;
					// Add symbol to render queue without drawing immediately
					if (textObject.manaPrefix && 
						(getManaSymbol(textObject.manaPrefix + possibleCode) != undefined || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join('')) != undefined)) {
						manaSymbol = getManaSymbol(textObject.manaPrefix + possibleCode) || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join(''));
					} else {
						if (possibleCode == 'brush' && textColor == 'white') {
							possibleCode = 'whitebrush';
						}
						manaSymbol = getManaSymbol(possibleCode) || getManaSymbol(possibleCode.split('').reverse().join(''));
					} 

					var origManaSymbolColor = manaSymbolColor;
					if (manaSymbol.matchColor && !manaSymbolColor && textColor !== 'black') {
						manaSymbolColor = textColor;
					}

					var manaSymbolSpacing = textSize * 0.04 + textManaSpacing;
					var manaSymbolWidth = manaSymbol.width * textSize * 0.78;
					var manaSymbolHeight = manaSymbol.height * textSize * 0.78;
					var manaSymbolX = currentX + canvasMargin + manaSymbolSpacing;
					var manaSymbolY = canvasMargin + textSize * 0.34 - manaSymbolHeight / 2;
					if (!textManaCost) {
						// Center inline symbols against the visible glyph box instead of
						// aligning their bottom edge to the surrounding text baseline.
						// This adapts to the active font while leaving dedicated mana-cost
						// and explicitly positioned symbol layouts unchanged.
						var inlineManaMetrics = lineContext.measureText('Mg');
						var inlineManaAscent = inlineManaMetrics.actualBoundingBoxAscent || textSize * 0.7;
						var inlineManaDescent = inlineManaMetrics.actualBoundingBoxDescent || textSize * 0.18;
						var inlineManaBaseline = canvasMargin + textSize * textFontHeightRatio + lineY;
						var inlineManaCenter = inlineManaBaseline + (inlineManaDescent - inlineManaAscent) / 2;
						manaSymbolY = inlineManaCenter - manaSymbolHeight / 2 + textSize * -0.07;
					}
					if (textObject.manaPlacement) {
						manaSymbolX = scaleWidth(textObject.manaPlacement.x[manaPlacementCounter] || 0) + canvasMargin;
						manaSymbolY = canvasMargin;
						currentY = scaleHeight(textObject.manaPlacement.y[manaPlacementCounter] || 0);
						manaPlacementCounter ++;
						newLine = true;
					} else if (textObject.manaLayout) {
						var layoutOption = 0;
						var manaSymbolCount = splitText.length - 1;
						while (textObject.manaLayout[layoutOption].max < manaSymbolCount && layoutOption < textObject.manaLayout.length - 1) {
							layoutOption ++;
						}
						var manaLayout = textObject.manaLayout[layoutOption];
						if (manaLayout.pos[manaPlacementCounter] == undefined) {
							manaLayout.pos[manaPlacementCounter] = [0, 0];
						}
						manaSymbolX = scaleWidth(manaLayout.pos[manaPlacementCounter][0] || 0) + canvasMargin;
						manaSymbolY = canvasMargin;
						currentY = scaleHeight(manaLayout.pos[manaPlacementCounter][1] || 0);
						manaPlacementCounter ++;
						manaSymbolWidth *= manaLayout.size;
						manaSymbolHeight *= manaLayout.size;
						newLine = true;
					}
					if (textObject.manaImageScale) {
						currentX -= (textObject.manaImageScale - 1) * manaSymbolWidth;
						manaSymbolX -= (textObject.manaImageScale - 1) / 2 * manaSymbolWidth;
						manaSymbolY -= (textObject.manaImageScale - 1) / 2 * manaSymbolHeight;
						manaSymbolWidth *= textObject.manaImageScale;
						manaSymbolHeight *= textObject.manaImageScale;
					}
					var backImage = null;
					if (manaSymbol.backs) {
						backImage = getManaSymbol('back' + Math.floor(Math.random() * manaSymbol.backs) + manaSymbol.back).image;
					}
					// Add to render queue
					manaSymbolsToRender.push({
						symbol: manaSymbol,
						x: manaSymbolX,
						y: manaSymbolY, 
						width: manaSymbolWidth,
						height: manaSymbolHeight,
						hasOutline: textOutlineWidth > 0,
						color: manaSymbolColor,
						radius: textArcRadius,
						arcStart: textArcStart,
						currentX: currentX,
						backImage: backImage,
						outlineWidth: textOutlineWidth,
						shadowColor: textShadowColor,
						shadowOffsetX: textShadowOffsetX,
						shadowOffsetY: textShadowOffsetY,
						shadowBlur: textShadowBlur
					});
					if (textOneLine && textObject.autoSizeVerticalCenter) {
						oneLineInkTop = Math.min(oneLineInkTop, manaSymbolY - canvasMargin);
						oneLineInkBottom = Math.max(oneLineInkBottom, manaSymbolY - canvasMargin + manaSymbolHeight);
					}
					currentX += manaSymbolWidth + manaSymbolSpacing * 2;

					manaSymbolColor = origManaSymbolColor;
				} else {
					wordToWrite = word;
				}
			}

			function renderManaSymbols() {
				if (manaSymbolsToRender.length === 0) return;

				// Detect Safari browser
				var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

				// Check if any symbols actually need outlines
				var hasAnyOutlines = manaSymbolsToRender.some(symbolData => symbolData.hasOutline);
				
				if (!hasAnyOutlines) {
					// Simple path: no outlines needed, just draw symbols normally
					manaSymbolsToRender.forEach(symbolData => {
						var imageToUse = symbolData.symbol.image;
						var backImageToUse = symbolData.backImage;
						
						// For Safari, create a combined canvas first, then apply shadow
						if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
							// Create a combined canvas for both symbols
							var combinedCanvas = document.createElement('canvas');
							combinedCanvas.width = symbolData.width;
							combinedCanvas.height = symbolData.height;
							var combinedContext = combinedCanvas.getContext('2d');
							
							// Draw back image first (if exists)
							if (symbolData.symbol.backs && backImageToUse) {
								combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
							}
							
							// Draw main symbol on top
							combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);
							
							// Now use the combined canvas as the image source
							imageToUse = combinedCanvas;
							backImageToUse = null; // Don't draw back separately since it's already combined
						}
						
						if (symbolData.radius > 0) {
							if (symbolData.symbol.backs && backImageToUse) {
								lineContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y, 
									symbolData.width, symbolData.height, symbolData.radius, 
									symbolData.arcStart, symbolData.currentX);
							}
							lineContext.drawImageArc(imageToUse, symbolData.x, symbolData.y, 
								symbolData.width, symbolData.height, symbolData.radius,
								symbolData.arcStart, symbolData.currentX);
						} else if (symbolData.color) {
							lineContext.fillImage(imageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height, symbolData.color);
						} else {
							if (symbolData.symbol.backs && backImageToUse) {
								lineContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
									symbolData.width, symbolData.height);
							}
							lineContext.drawImage(imageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height);
						}
					});
					
					manaSymbolsToRender = [];
					return; // This exits the function completely - no complex rendering
				}

				// Complex path: outlines needed, do multi-pass rendering
				// This code should ONLY run when hasAnyOutlines is true
				var outlineCanvas = lineCanvas.cloneNode(); 
				var outlineContext = outlineCanvas.getContext('2d');
				var symbolCanvas = lineCanvas.cloneNode();
				var symbolContext = symbolCanvas.getContext('2d');
				symbolContext.shadowColor = lineContext.shadowColor;
				symbolContext.shadowOffsetX = lineContext.shadowOffsetX;
				symbolContext.shadowOffsetY = lineContext.shadowOffsetY;
				symbolContext.shadowBlur = lineContext.shadowBlur;

				// Save existing text content
				var tempCanvas = lineCanvas.cloneNode();
				var tempContext = tempCanvas.getContext('2d');
				tempContext.drawImage(lineCanvas, 0, 0);
				// Clear the line context
				lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
				
				// First pass: Draw outlines only
				manaSymbolsToRender.forEach(symbolData => {
					if (!symbolData.hasOutline) return;
					outlineContext.fillStyle = 'black';
					outlineContext.beginPath();
					var centerX = symbolData.x + symbolData.width/2;
					var centerY = symbolData.y + symbolData.height/2;
					var baseRadius = Math.max(symbolData.width, symbolData.height) / 2;
					// Fix: Use half the outline width to match text rendering behavior
					var outlineRadius = baseRadius + (symbolData.outlineWidth || 0) / 2;
					outlineContext.arc(centerX, centerY + (symbolData.radius ?? 0), outlineRadius, 0, 2 * Math.PI);
					outlineContext.fill();
				});
				// Transfer outlines to main canvas
				lineContext.drawImage(outlineCanvas, 0, 0);
				
				// Restore text content on top of outlines
				lineContext.drawImage(tempCanvas, 0, 0);
				
				// Second pass: Draw mana symbols
				manaSymbolsToRender.forEach(symbolData => {
					var imageToUse = symbolData.symbol.image;
					var backImageToUse = symbolData.backImage;
					
					// For Safari, create a combined canvas first, then apply shadow
					if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
						// Create a combined canvas for both symbols
						var combinedCanvas = document.createElement('canvas');
						combinedCanvas.width = symbolData.width;
						combinedCanvas.height = symbolData.height;
						var combinedContext = combinedCanvas.getContext('2d');
						
						// Draw back image first (if exists)
						if (symbolData.symbol.backs && backImageToUse) {
							combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
						}
						
						// Draw main symbol on top
						combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);
						
						// Now use the combined canvas as the image source
						imageToUse = combinedCanvas;
						backImageToUse = null; // Don't draw back separately since it's already combined
					}
					
					if (symbolData.radius > 0) {
						if (symbolData.symbol.backs && backImageToUse) {
							symbolContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y, 
								symbolData.width, symbolData.height, symbolData.radius, 
								symbolData.arcStart, symbolData.currentX);
						}
						symbolContext.drawImageArc(imageToUse, symbolData.x, symbolData.y, 
							symbolData.width, symbolData.height, symbolData.radius,
							symbolData.arcStart, symbolData.currentX);
					} else if (symbolData.color) {
						symbolContext.fillImage(imageToUse, symbolData.x, symbolData.y,
							symbolData.width, symbolData.height, symbolData.color);
					} else {
						if (symbolData.symbol.backs && backImageToUse) {
							symbolContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height);
						}
						symbolContext.drawImage(imageToUse, symbolData.x, symbolData.y,
							symbolData.width, symbolData.height);
					}
				});

				// Draw symbols on top of text
				lineContext.drawImage(symbolCanvas, 0, 0);
				
				manaSymbolsToRender = [];
			}
			if (wordToWrite && lineContext.font.endsWith('belerenb')) {
				wordToWrite = wordToWrite.replace(/f(?:\s|$)/g, '\ue006').replace(/h(?:\s|$)/g, '\ue007').replace(/m(?:\s|$)/g, '\ue008').replace(/n(?:\s|$)/g, '\ue009').replace(/k(?:\s|$)/g, '\ue00a');
			}

			//if the word goes past the max line width, go to the next line
			if (wordToWrite && lineContext.measureText(wordToWrite).width + currentX >= textWidth && textArcRadius == 0) {
				if (textOneLine && startingTextSize > 1) {
					//doesn't fit... try again at a smaller text size?
					startingTextSize -= 1;
					continue outerloop;
				}
				newLine = true;
			}
			//if we need a new line, go to the next line
			if ((newLine && !textOneLine) || splitText.indexOf(word) == splitText.length - 1) {
				var horizontalAdjust = 0
				if (textAlign == 'center') {
					horizontalAdjust = (textWidth - currentX) / 2;
				} else if (textAlign == 'right') {
					horizontalAdjust = textWidth - currentX;
				}
				if (currentX > widestLineWidth) {
					widestLineWidth = currentX;
				}
				if (manaSymbolsToRender.length > 0) {
					renderManaSymbols();
				}
				paragraphContext.drawImage(lineCanvas, horizontalAdjust, currentY);
				lineY = 0;
				lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
				// boxes for 'roll a d20' cards
				if (savedRollYPosition != null && (newLineSpacing != 0 || !(newLine && !textOneLine))) {
					if (savedRollYPosition != -1) {
						paragraphContext.globalCompositeOperation = 'destination-over';
						paragraphContext.globalAlpha = 0.25;
						paragraphContext.fillStyle = savedRollColor;
						paragraphContext.fillRect(canvasMargin - textSize * 0.1, savedRollYPosition + canvasMargin - textSize * 0.28, paragraphCanvas.width - 2 * canvasMargin + textSize * 0.2, currentY - savedRollYPosition + textSize * 1.3);
						paragraphContext.globalCompositeOperation = 'source-over';
						paragraphContext.globalAlpha = 1;
						savedRollYPosition = -1;
					} else {
						savedRollYPosition = null;
					}
				}
				//reset
				currentX = startingCurrentX;
				currentY += textSize + newLineSpacing;
				newLineSpacing = (textObject.lineSpacing || 0) * textSize;
				newLine = false;
			}
			//if there's a word to write, it's not a space on a new line, and it's allowed to write words, then we write the word
			if (wordToWrite && (currentX != startingCurrentX || wordToWrite != ' ') && !textManaCost) {
				if (textOneLine && textObject.autoSizeVerticalCenter) {
					var inkMetrics = lineContext.measureText(wordToWrite);
					var inkAscent = inkMetrics.actualBoundingBoxAscent || textSize * textFontHeightRatio;
					var inkDescent = inkMetrics.actualBoundingBoxDescent || textSize * 0.15;
					var inkBaseline = textSize * textFontHeightRatio + lineY;
					oneLineInkTop = Math.min(oneLineInkTop, inkBaseline - inkAscent);
					oneLineInkBottom = Math.max(oneLineInkBottom, inkBaseline + inkDescent);
				}
				var justifySettings = {
					maxSpaceSize: 6,
					minSpaceSize: 0
				};
				//Rotate katakana prolonged sound mark (ー) 90° CW in vertical text
				var verticalRotateChar = textObject.vertical && wordToWrite === '\u30FC';
				if (verticalRotateChar) {
					var charWidth = lineContext.measureText(wordToWrite).width;
					var centerX = currentX + canvasMargin + charWidth / 2;
					var centerY = canvasMargin + textSize * textFontHeightRatio + lineY - textSize * 0.3;
					lineContext.save();
					lineContext.translate(centerX, centerY);
					lineContext.rotate(Math.PI / 2);
					lineContext.translate(-centerX, -centerY);
				}
				if (textArcRadius > 0) {
					lineContext.fillTextArc(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, textArcRadius, textArcStart, currentX, textOutlineWidth);
				} else {
					if (textOutlineWidth >= 1) {
						if (fillJustify) {
							lineContext.strokeJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
						} else {
							lineContext.strokeText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
						}
					}
					if (fillJustify) {
						lineContext.fillJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
					} else {
						lineContext.fillText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
					}
				}
				if (verticalRotateChar) {
					lineContext.restore();
				}

				if (fillJustify) {
					currentX += lineContext.measureJustifiedText(wordToWrite, justifyWidth, justifySettings);
				} else {
					currentX += lineContext.measureText(wordToWrite).width;
				}
			}
			if (currentY > textHeight && textBounded && !textOneLine && startingTextSize > 1 && textArcRadius == 0) {
				//doesn't fit... try again at a smaller text size?
				startingTextSize -= 1;
				continue outerloop;
			}
			if (splitText.indexOf(word) == splitText.length - 1) {
				//should manage vertical centering here
				var verticalAdjust = 0;
				if (!textObject.noVerticalCenter) {
					if (textObject.autoSizeVerticalCenter && oneLineInkTop !== Infinity && oneLineInkBottom !== -Infinity) {
						verticalAdjust = textHeight / 2 - (oneLineInkTop + oneLineInkBottom) / 2;
					} else {
						verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2;
					}
				}
				var finalHorizontalAdjust = 0;
				const horizontalAdjustUnit = (textWidth - widestLineWidth) / 2;
				if (textJustify == 'right' && textAlign != 'right') {
					finalHorizontalAdjust = 2 * horizontalAdjustUnit;
					if (textAlign == 'center') {
						finalHorizontalAdjust = horizontalAdjustUnit;
					}
				} else if (textJustify == 'center' && textAlign != 'center') {
					finalHorizontalAdjust = horizontalAdjustUnit;
					if (textAlign == 'right') {
						finalHorizontalAdjust = - horizontalAdjustUnit;
					}
				}
				var trueTargetContext = targetContext;
				if (drawToPrePTCanvas) {
					trueTargetContext = prePTContext;
				}
				if (textRotation) {
					trueTargetContext.save();
					trueTargetContext
					const shapeX = textX + ptShift[0];
					const shapeY = textY + ptShift[1];
					trueTargetContext.translate(shapeX, shapeY);
					trueTargetContext.rotate(Math.PI * textRotation / 180);
					trueTargetContext.drawImage(paragraphCanvas, permaShift[0] - canvasMargin + finalHorizontalAdjust, verticalAdjust - canvasMargin + permaShift[1]);
					trueTargetContext.restore();
				} else {
					trueTargetContext.drawImage(paragraphCanvas, textX - canvasMargin + ptShift[0] + permaShift[0] + finalHorizontalAdjust, textY - canvasMargin + verticalAdjust + ptShift[1] + permaShift[1]);
				}
				var renderedLeft = textX + ptShift[0] + permaShift[0] + finalHorizontalAdjust;
				if (textAlign === 'right') renderedLeft += textWidth - widestLineWidth;
				else if (textAlign === 'center') renderedLeft += (textWidth - widestLineWidth) / 2;
				finalRenderedBounds = {left: renderedLeft, right: renderedLeft + widestLineWidth, width: widestLineWidth, top: textY, height: textHeight};
				drawingText = false;
			}
		}
	}
	return finalRenderedBounds;
}

CanvasRenderingContext2D.prototype.fillTextArc = function(text, x, y, radius, startRotation, distance = 0, outlineWidth = 0) {
	this.save();
	this.translate(x - distance + scaleWidth(0.5), y + radius);
	this.rotate(startRotation + widthToAngle(distance, radius));
	for (var i = 0; i < text.length; i++) {
		var letter = text[i];
		if (outlineWidth >= 1) {
			this.strokeText(letter, 0, -radius);
		}
		this.fillText(letter, 0, -radius);
		this.rotate(widthToAngle(this.measureText(letter).width, radius));
	}
	this.restore();
}
CanvasRenderingContext2D.prototype.drawImageArc = function(image, x, y, width, height, radius, startRotation, distance = 0) {
	this.save();
	this.translate(x - distance + scaleWidth(0.5), y + radius);
	this.rotate(startRotation + widthToAngle(distance, radius));
	this.drawImage(image, 0, -radius, width, height);
	this.restore();
}
CanvasRenderingContext2D.prototype.fillImage = function(image, x, y, width, height, color = 'white', margin = 10) {
	var canvas = document.createElement('canvas');
	canvas.width = width + margin * 2;
	canvas.height = height + margin * 2;
	var context = canvas.getContext('2d');
	context.drawImage(image, margin, margin, width, height);
	context.globalCompositeOperation = 'source-in';
	context.fillStyle = pinlineColors(color);
	context.fillRect(0, 0, width + margin * 2, height + margin * 2);
	this.drawImage(canvas, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

const FILL = 0; //const to indicate filltext render
const STROKE = 1;
const MEASURE = 2;
var maxSpaceSize = 3; // Multiplier for max space size. If greater then no justification applied
var minSpaceSize = 0.5; // Multiplier for minimum space size
function renderTextJustified(ctx, text, x, y, width, renderType) {
	var splitChar = " ";

	var words, wordsWidth, count, spaces, spaceWidth, adjSpace, renderer, i, textAlign, useSize, totalWidth;
	textAlign = ctx.textAlign;
	ctx.textAlign = "left";
	wordsWidth = 0;
	words = text.split(splitChar).map(word => {
		var w = ctx.measureText(word).width;
		wordsWidth += w;
		return {
			width: w,
			word: word
		};
	});
	// count = num words, spaces = number spaces, spaceWidth normal space size
	// adjSpace new space size >= min size. useSize Reslting space size used to render
	count = words.length;
	spaces = count - 1;
	spaceWidth = ctx.measureText(splitChar).width;
	adjSpace = Math.max(spaceWidth * minSpaceSize, (width - wordsWidth) / spaces);
	useSize = adjSpace > spaceWidth * maxSpaceSize ? spaceWidth : adjSpace;
	totalWidth = wordsWidth + useSize * spaces;
	if (renderType === MEASURE) { // if measuring return size
		ctx.textAlign = textAlign;
		return totalWidth;
	}
	renderer = renderType === FILL ? ctx.fillText.bind(ctx) : ctx.strokeText.bind(ctx); // fill or stroke
	switch(textAlign) {
	case "right":
		x -= totalWidth;
		break;
	case "end":
		x += width - totalWidth;
		break;
	case "center": // intentional fall through to default
		x -= totalWidth / 2;
	default:
	}
	if (useSize === spaceWidth) { // if space size unchanged
		renderer(text, x, y);
	} else {
		for(i = 0; i < count; i += 1) {
			renderer(words[i].word,x,y);
			x += words[i].width;
			x += useSize;
		}
	}
	ctx.textAlign = textAlign;
}

// Parse vet and set settings object.
function justifiedTextSettings(settings) {
	var min,max;
	var vetNumber = (num, defaultNum) => {
		num = num !== null && num !== null && !isNaN(num) ? num : defaultNum;
		if(num < 0){
			num = defaultNum;
		}
		return num;
	}
	if(settings === undefined || settings === null){
		return;
	}
	max = vetNumber(settings.maxSpaceSize, maxSpaceSize);
	min = vetNumber(settings.minSpaceSize, minSpaceSize);
	if(min > max){
		return;
	}
	minSpaceSize = min;
	maxSpaceSize = max;
}
CanvasRenderingContext2D.prototype.fillJustifyText = function(text, x, y, width, settings) {
	justifiedTextSettings(settings);
	renderTextJustified(this, text, x, y, width, FILL);
}
CanvasRenderingContext2D.prototype.strokeJustifyText = function(text, x, y, width, settings){
	justifiedTextSettings(settings);
	renderTextJustified(this, text, x, y, width, STROKE);
}
CanvasRenderingContext2D.prototype.measureJustifiedText = function(text, width, settings) {
	justifiedTextSettings(settings);
	renderTextJustified(this, text, 0, 0, width, MEASURE);
}

function widthToAngle(width, radius) {
	return width / radius;
}
function curlyQuotes(input) {
	return input.replace(/ '/g, ' ‘').replace(/^'/, '‘').replace(/'/g, '’').replace(/ "/g, ' “').replace(/" /g, '” ').replace(/\."/, '.”').replace(/"$/, '”').replace(/"\)/g, '”)').replace(/"/g, '“');
}
function pinlineColors(color) {
	return color.replace('white', '#fcfeff').replace('blue', '#0075be').replace('black', '#272624').replace('red', '#ef3827').replace('green', '#007b43')
}
async function addTextbox(textboxType) {
	if (textboxType == 'Nickname' && !card.text.nickname && card.text.title) {
		installNicknameTextbox(card.text.title.text || '');
		userOptionalTextKeys.add('nickname');
		renderTextFieldForm(textFieldFocusState());
		drawTextBuffer();
	} else if (textboxType == 'Power/Toughness' && !card.text.pt) {
		var ptDefinition = optionalTextboxDefinitionForCurrentCard('pt');
		if (ptDefinition) loadTextOptions({pt:ptDefinition}, false);
	} else if (textboxType == 'DateStamp' && !card.text.dateStamp) {
		loadTextOptions({dateStamp:optionalTextboxDefinitionForCurrentCard('dateStamp')}, false);
	}
}
//ART TAB
function openArtLayoutDrawer(trigger) {
	var drawer = document.querySelector('#art-layout-drawer');
	if (!drawer) return;
	artLayoutReturnFocus = trigger || document.activeElement;
	drawer.classList.add('opened');
	drawer.setAttribute('aria-hidden', 'false');
	setTimeout(function() { drawer.querySelector('.textbox-editor-close')?.focus({preventScroll:true}); }, 0);
}

function closeArtLayoutDrawer(returnFocus = true) {
	var drawer = document.querySelector('#art-layout-drawer');
	if (drawer) {
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
	}
	if (returnFocus && artLayoutReturnFocus?.isConnected) artLayoutReturnFocus.focus();
	artLayoutReturnFocus = null;
}

function openWatermarkLayoutDrawer(trigger) {
	var drawer = document.querySelector('#watermark-layout-drawer');
	if (!drawer) return;
	watermarkLayoutReturnFocus = trigger || document.activeElement;
	drawer.classList.add('opened');
	drawer.setAttribute('aria-hidden', 'false');
	setTimeout(function() { drawer.querySelector('.textbox-editor-close')?.focus({preventScroll:true}); }, 0);
}

function closeWatermarkLayoutDrawer(returnFocus = true) {
	var drawer = document.querySelector('#watermark-layout-drawer');
	if (drawer) {
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
	}
	if (returnFocus && watermarkLayoutReturnFocus?.isConnected) watermarkLayoutReturnFocus.focus();
	watermarkLayoutReturnFocus = null;
}

function openSerialLayoutDrawer(trigger) {
	var drawer = document.querySelector('#serial-layout-drawer');
	if (!drawer) return;
	serialLayoutReturnFocus = trigger || document.activeElement;
	drawer.classList.add('opened');
	drawer.setAttribute('aria-hidden', 'false');
	setTimeout(function() { drawer.querySelector('.textbox-editor-close')?.focus({preventScroll:true}); }, 0);
}

function closeSerialLayoutDrawer(returnFocus = true) {
	var drawer = document.querySelector('#serial-layout-drawer');
	if (drawer) {
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
	}
	if (returnFocus && serialLayoutReturnFocus?.isConnected) serialLayoutReturnFocus.focus();
	serialLayoutReturnFocus = null;
}

function setArtSearchStatus(message, kind = '') {
	var status = document.querySelector('#art-search-status');
	if (!status) return;
	status.textContent = message;
	status.dataset.kind = kind;
	status.hidden = !message;
}

function openArtSearchDrawer(trigger) {
	var drawer = document.querySelector('#art-search-drawer');
	var query = document.querySelector('#art-name');
	var language = document.querySelector('#art-search-language');
	if (!drawer || !query) return;
	artSearchReturnFocus = trigger || document.activeElement;
	scryfallArt = [];
	query.value = '';
	var workspaceState = window.CardConjurerSets?.getState?.();
	var activeSet = workspaceState?.sets?.find(set => set.id === workspaceState.activeSetId);
	var preferredLanguage = String(activeSet?.language || document.querySelector('#import-language')?.value || 'en').toLowerCase();
	if (language) language.value = Array.from(language.options).some(option => option.value === preferredLanguage) ? preferredLanguage : 'en';
	var results = document.querySelector('#art-index');
	var resultsLabel = document.querySelector('#art-search-results-label');
	var useButton = document.querySelector('#art-search-use');
	if (results) results.innerHTML = '';
	if (resultsLabel) resultsLabel.hidden = true;
	if (useButton) useButton.disabled = true;
	setArtSearchStatus('');
	drawer.classList.add('opened');
	drawer.setAttribute('aria-hidden', 'false');
	setTimeout(function() { query.focus(); }, 0);
}

function closeArtSearchDrawer(returnFocus = true) {
	var drawer = document.querySelector('#art-search-drawer');
	if (drawer) {
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
	}
	if (returnFocus && artSearchReturnFocus?.isConnected) artSearchReturnFocus.focus();
	artSearchReturnFocus = null;
}

async function searchScryfallArt() {
	var queryInput = document.querySelector('#art-name');
	var languageInput = document.querySelector('#art-search-language');
	var results = document.querySelector('#art-index');
	var resultsLabel = document.querySelector('#art-search-results-label');
	var searchButton = document.querySelector('#art-search-submit');
	var useButton = document.querySelector('#art-search-use');
	var query = String(queryInput?.value || '').trim();
	if (!query) { setArtSearchStatus('Card name required.', 'error'); queryInput?.focus(); return; }
	if (searchButton) searchButton.disabled = true;
	if (useButton) useButton.disabled = true;
	if (resultsLabel) resultsLabel.hidden = true;
	setArtSearchStatus('Searching Scryfall…');
	try {
		var searchParams = new URLSearchParams({order:'released', include_extras:'true', unique:'art', q:'name=' + query + ' lang=' + (languageInput?.value || 'en')});
		var response = await fetch('https://api.scryfall.com/cards/search?' + searchParams.toString());
		if (!response.ok) {
			if (response.status === 404) throw new Error('No artwork found for “' + query + '”.');
			throw new Error('Scryfall search failed. Try again.');
		}
		var payload = await response.json();
		var processed = [];
		(payload.data || []).forEach(function(cardResult) {
			if (typeof processScryfallCard === 'function') processScryfallCard(cardResult, processed);
			else processed.push(cardResult);
		});
		scryfallArt = processed.filter(cardResult => cardResult?.image_uris?.art_crop && cardResult.artist && cardResult.type_line !== 'Card');
		results.innerHTML = '';
		scryfallArt.forEach(function(cardResult, index) {
			var name = cardResult.printed_name || cardResult.name || 'Untitled Card';
			var detail = String(cardResult.set || '').toUpperCase() + ' #' + String(cardResult.collector_number || '') + ' · ' + cardResult.artist;
			results.appendChild(new Option(name + ' (' + detail + ')', String(index)));
		});
		if (!scryfallArt.length) throw new Error('No usable artwork found for “' + query + '”.');
		results.value = '0';
		resultsLabel.hidden = false;
		useButton.disabled = false;
		setArtSearchStatus(scryfallArt.length + ' artwork' + (scryfallArt.length === 1 ? '' : 's') + ' found.');
	} catch (error) {
		scryfallArt = [];
		if (results) results.innerHTML = '';
		if (resultsLabel) resultsLabel.hidden = true;
		setArtSearchStatus(error.message || 'Scryfall search failed. Try again.', 'error');
	} finally {
		if (searchButton) searchButton.disabled = false;
	}
}

function useSelectedScryfallArt() {
	if (!scryfallArt?.[Number(document.querySelector('#art-index')?.value)]) return;
	changeArtIndex();
	closeArtSearchDrawer();
}

function loadArtUrl() {
	var input = document.querySelector('#art-url');
	var value = String(input?.value || '').trim();
	if (!value) return;
	imageURL(value, uploadArt, document.querySelector('#art-update-autofit')?.checked ? 'autoFit' : '');
}

function uploadArt(imageSource, otherParams) {
	ImageLoadTracker.track(imageSource);
	art.src = imageSource;
	if (otherParams && otherParams == 'autoFit') {
		art.onload = function() {
			autoFitArt();
			art.onload = artEdited;
		};
	}
}
async function pasteArt() {
  try {
    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          
          const url = URL.createObjectURL(blob);

          uploadArt(url, document.querySelector("#art-update-autofit").checked ? "autoFit" : "");
          // document.getElementById('preview').src = url;
          return;
        }
      }
    }

    notify('No image found in clipboard!');
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    notify('Clipboard access not allowed or no image available.');
  }
}
function artEdited() {
	var artXInput = document.querySelector('#art-x');
	var artYInput = document.querySelector('#art-y');
	var artZoomInput = document.querySelector('#art-zoom');
	var artRotateInput = document.querySelector('#art-rotate');
	var rawValues = [artXInput.value, artYInput.value, artZoomInput.value, artRotateInput.value];
	if (rawValues.some(function(value) { return String(value).trim() === '' || !Number.isFinite(Number(value)); })) {
		card.artSource = art.src;
		drawCard();
		return;
	}
	var requestedX = Number(artXInput.value);
	var requestedY = Number(artYInput.value);
	var requestedZoom = Number(artZoomInput.value) / 100;
	var requestedRotation = Number(artRotateInput.value) || 0;
	if (window.CardConjurerArtBounds && card.artBounds && art.naturalWidth && art.naturalHeight && !art.src.includes('/img/blank.png')) {
		var previousX = Number(card.artX) * card.width;
		var previousY = Number(card.artY) * card.height;
		var transformChanged = Math.abs(requestedZoom - Number(card.artZoom)) > 1e-9 || Math.abs(requestedRotation - Number(card.artRotate || 0)) > 1e-9;
		var constrain = transformChanged ? window.CardConjurerArtBounds.constrainPlacement : window.CardConjurerArtBounds.constrainMovement;
		var placement = constrain({
			x: requestedX,
			y: requestedY,
			fromX: previousX,
			fromY: previousY,
			zoom: requestedZoom,
			rotation: requestedRotation,
			imageWidth: art.naturalWidth,
			imageHeight: art.naturalHeight,
			bounds: {
				x: card.artBounds.x * card.width,
				y: card.artBounds.y * card.height,
				width: card.artBounds.width * card.width,
				height: card.artBounds.height * card.height
			}
		});
		requestedX = placement.x;
		requestedY = placement.y;
		requestedZoom = placement.zoom;
		artXInput.value = Math.round(requestedX * 1000) / 1000;
		artYInput.value = Math.round(requestedY * 1000) / 1000;
		artZoomInput.value = Math.round(requestedZoom * 1000) / 10;
	}
	card.artSource = art.src;
	card.artX = requestedX / card.width;
	card.artY = requestedY / card.height;
	card.artZoom = requestedZoom;
	card.artRotate = requestedRotation;
	drawCard();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}
function autoFitArt() {
	if (document.querySelector("#art-preserve-position")?.checked) return;
	document.querySelector('#art-rotate').value = 0;
	if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
		document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - scaleHeight(card.marginY));
		document.querySelector('#art-zoom').value = (scaleHeight(card.artBounds.height) / art.height * 100).toFixed(1);
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
	} else {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
		document.querySelector('#art-zoom').value = (scaleWidth(card.artBounds.width) / art.width * 100).toFixed(1);
		document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
	}
	artEdited();
}

function centerArtX() {
	document.querySelector('#art-rotate').value = 0;
	if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
	} else {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
	}
	artEdited();
}

function centerArtY() {
	document.querySelector('#art-rotate').value = 0;
	document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
	artEdited();
}

function artFromScryfall(scryfallResponse) {
	scryfallArt = []
	const artIndex = document.querySelector('#art-index');
	artIndex.innerHTML = null;
	var optionIndex = 0;
	scryfallResponse.forEach(card => {
		if (card.image_uris && (card.object == 'card' || card.type_line != 'Card') && card.artist) {
			scryfallArt.push(card);
			var option = document.createElement('option');
			option.innerHTML = `${card.name} (${card.set.toUpperCase()} - ${card.artist})`;
			option.value = optionIndex;
			artIndex.appendChild(option);
			optionIndex ++;
		}
	});

	if (document.querySelector('#importAllPrints').checked) {
		// If importing unique prints, the art should change to match the unique print selected.

		// First we find the illustration ID of the imported print
		var illustrationID = scryfallCard[document.querySelector('#import-index').value].illustration_id;

		// Find all unique arts for that card
		var artIllustrations = scryfallArt.map(card => card.illustration_id);

		// Find the art that matches the selected print
		var index = artIllustrations.indexOf(illustrationID);
		if (index < 0) {
			// Couldn't find art
			index = 0;
		}

		// Use that art
		artIndex.value = index;
	}

	changeArtIndex();
}
function changeArtIndex() {
	const artIndexValue = document.querySelector('#art-index').value;
	if (artIndexValue != 0 || artIndexValue == '0') {
		const scryfallCardForArt = scryfallArt[artIndexValue];
		uploadArt(scryfallCardForArt.image_uris.art_crop, 'autoFit');
		artistEdited(scryfallCardForArt.artist);
		if (params.get('mtgpics') != null) {
			imageURL(`https://www.mtgpics.com/pics/art/${scryfallCardForArt.set.toLowerCase()}/${("00" + scryfallCardForArt.collector_number).slice(-3)}.jpg`, tryMTGPicsArt);
		}
	}
}
function tryMTGPicsArt(src) {
	var attemptedImage = new Image();
	attemptedImage.onload = function() {
		if (this.complete) {
			art.onload = function() {
				autoFitArt();
				art.onload = artEdited;
			};
			art.src = this.src;
		}
	}
	attemptedImage.src = src;
}
function initDraggableArt() {
	previewCanvas.onpointerdown = artStartDrag;
	previewCanvas.onpointermove = artDrag;
	previewCanvas.onpointerup = artStopDrag;
	previewCanvas.onpointercancel = artStopDrag;
	previewCanvas.onwheel = artWheelZoom;
	draggingArt = false;
}
function previewPointToCard(e) {
	var bounds = previewCanvas.getBoundingClientRect();
	var previewPoint = new DOMPoint(
		(e.clientX - bounds.left) * previewCanvas.width / bounds.width,
		(e.clientY - bounds.top) * previewCanvas.height / bounds.height
	);
	var canvasPoint = previewContext.getTransform().inverse().transformPoint(previewPoint);
	return {
		x: canvasPoint.x * cardCanvas.width / previewCanvas.width,
		y: canvasPoint.y * cardCanvas.height / previewCanvas.height
	};
}
function artStartDrag(e) {
	e.preventDefault();
	e.stopPropagation();
	artDragTarget = document.querySelector('#drag-target-setSymbol').checked ? 'setSymbol' : 'art';
	artDragLastPoint = previewPointToCard(e);
	artDragLastClientY = Number(e.clientY);
	pendingArtDrag = null;
	if (artDragAnimationFrame) cancelAnimationFrame(artDragAnimationFrame);
	artDragAnimationFrame = 0;
	activeArtPointerId = e.pointerId;
	draggingArt = true;
	previewCanvas.setPointerCapture?.(e.pointerId);
}
function artDrag(e) {
	if (!draggingArt || e.pointerId !== activeArtPointerId) return;
	e.preventDefault();
	e.stopPropagation();
	pendingArtDrag = {
		clientX: Number(e.clientX),
		clientY: Number(e.clientY),
		pointerId: e.pointerId,
		shiftKey: Boolean(e.shiftKey),
		ctrlKey: Boolean(e.ctrlKey)
	};
	if (!artDragAnimationFrame) artDragAnimationFrame = requestAnimationFrame(flushArtDrag);
}
function flushArtDrag() {
	artDragAnimationFrame = 0;
	var e = pendingArtDrag;
	pendingArtDrag = null;
	if (!e || !draggingArt || e.pointerId !== activeArtPointerId) return;
	var target = artDragTarget;
	var canRotate = true;
	var edited = target == "art" ? artEdited : setSymbolEdited;
	if (e.shiftKey || e.ctrlKey) {
		var changeY = e.clientY - artDragLastClientY;
		if (e.ctrlKey && canRotate) {
			document.querySelector(`#${target}-rotate`).value = Math.round((parseFloat(document.querySelector(`#${target}-rotate`).value) + changeY / 10) % 360 * 10) / 10;
		} else {
			document.querySelector(`#${target}-zoom`).value = Math.round((parseFloat(document.querySelector(`#${target}-zoom`).value) * (1.002 ** -changeY)) * 10) / 10;
		}
		artDragLastPoint = previewPointToCard(e);
	} else {
		var currentPoint = previewPointToCard(e);
		var xInput = document.querySelector(`#${target}-x`);
		var yInput = document.querySelector(`#${target}-y`);
		xInput.value = (parseFloat(xInput.value) || 0) + currentPoint.x - artDragLastPoint.x;
		yInput.value = (parseFloat(yInput.value) || 0) + currentPoint.y - artDragLastPoint.y;
		artDragLastPoint = currentPoint;
	}
	artDragLastClientY = e.clientY;
	edited();
	if (pendingArtDrag && !artDragAnimationFrame) artDragAnimationFrame = requestAnimationFrame(flushArtDrag);
}
function artStopDrag(e) {
	e.preventDefault();
	e.stopPropagation();
	if (!draggingArt || e.pointerId !== activeArtPointerId) return;
	pendingArtDrag = {
		clientX: Number(e.clientX),
		clientY: Number(e.clientY),
		pointerId: e.pointerId,
		shiftKey: Boolean(e.shiftKey),
		ctrlKey: Boolean(e.ctrlKey)
	};
	if (artDragAnimationFrame) cancelAnimationFrame(artDragAnimationFrame);
	artDragAnimationFrame = 0;
	flushArtDrag();
	draggingArt = false;
	previewCanvas.releasePointerCapture?.(e.pointerId);
	activeArtPointerId = null;
	pendingArtDrag = null;
}
function artWheelZoom(e) {
	if (!window.CardConjurerArtBounds || !card.artBounds || !art.naturalWidth || !art.naturalHeight || art.src.includes('/img/blank.png')) return;
	e.preventDefault();
	e.stopPropagation();
	var zoomInput = document.querySelector('#art-zoom');
	var xInput = document.querySelector('#art-x');
	var yInput = document.querySelector('#art-y');
	var fromZoom = (parseFloat(zoomInput.value) || 0) / 100;
	if (!fromZoom) return;
	var wheelDelta = e.deltaY * (e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? previewCanvas.clientHeight : 1));
	var wheelSteps = Math.max(-4, Math.min(4, -wheelDelta / 100));
	if (!wheelSteps) return;
	var toZoom = fromZoom * (1.1 ** wheelSteps);
	var minimumZoom = window.CardConjurerArtBounds.minimumZoom({
		imageWidth: art.naturalWidth,
		imageHeight: art.naturalHeight,
		rotation: parseFloat(document.querySelector('#art-rotate').value) || 0,
		bounds: {
			x: card.artBounds.x * card.width,
			y: card.artBounds.y * card.height,
			width: card.artBounds.width * card.width,
			height: card.artBounds.height * card.height
		}
	});
	minimumZoom = Math.ceil((minimumZoom - 1e-9) * 1000) / 1000;
	toZoom = Math.max(minimumZoom, Math.round(toZoom * 1000) / 1000);
	if (Math.abs(toZoom - fromZoom) < 1e-9) return;
	var cardPoint = previewPointToCard(e);
	var placement = window.CardConjurerArtBounds.zoomAroundPoint({
		x: parseFloat(xInput.value) || 0,
		y: parseFloat(yInput.value) || 0,
		anchorX: cardPoint.x - scaleWidth(card.marginX),
		anchorY: cardPoint.y - scaleHeight(card.marginY),
		fromZoom: fromZoom,
		toZoom: toZoom
	});
	xInput.value = placement.x;
	yInput.value = placement.y;
	zoomInput.value = placement.zoom * 100;
	artEdited();
}
//SET SYMBOL TAB
function uploadSetSymbol(imageSource, otherParams) {
	imageSource = fixUri(imageSource || '/img/blank.png');
	ImageLoadTracker.track(imageSource);
	if (otherParams && otherParams == 'resetSetSymbol') {
		setSymbol.onload = function() {
			resetSetSymbol();
			setSymbol.onload = setSymbolEdited;
		};
	} else {
		setSymbol.onload = setSymbolEdited;
	}
	setSymbol.src = imageSource;
}
function setSymbolEdited() {
	card.setSymbolSource = setSymbol.src;
	if (document.querySelector('#lockSetSymbolURL').checked) {
		localStorage.setItem('lockSetSymbolURL', card.setSymbolSource);
	}
	localStorage.setItem('set-symbol-source', document.querySelector('#set-symbol-source').value);
	card.setSymbolX = document.querySelector('#setSymbol-x').value / card.width;
	card.setSymbolY = document.querySelector('#setSymbol-y').value / card.height;
	card.setSymbolZoom = document.querySelector('#setSymbol-zoom').value / 100;
	card.setSymbolRotate = parseFloat(document.querySelector('#setSymbol-rotate').value) || 0;
	if (card.text?.type && card.text.type.autoSize !== false) drawTextBuffer(0);
	else drawCard();
}

if (!window.cardConjurerArtDrawersBound) {
	window.cardConjurerArtDrawersBound = true;
	document.addEventListener('keydown', function(event) {
		if (event.key !== 'Escape') return;
		if (document.querySelector('#art-search-drawer.opened')) closeArtSearchDrawer();
		if (document.querySelector('#art-layout-drawer.opened')) closeArtLayoutDrawer();
		if (document.querySelector('#watermark-layout-drawer.opened')) closeWatermarkLayoutDrawer();
		if (document.querySelector('#serial-layout-drawer.opened')) closeSerialLayoutDrawer();
	});
}
function resetSetSymbol() {
	if (card.setSymbolBounds == undefined) {
		return;
	}
	if (card.setSymbolBounds.fallback && (!setSymbol.naturalWidth || setSymbol.naturalWidth <= 1 || setSymbol.src.includes('/img/blank.png'))) {
		document.querySelector('#setSymbol-x').value = card.setSymbolBounds.fallback.x;
		document.querySelector('#setSymbol-y').value = card.setSymbolBounds.fallback.y;
		document.querySelector('#setSymbol-zoom').value = card.setSymbolBounds.fallback.zoom;
		document.querySelector('#setSymbol-rotate').value = card.setSymbolBounds.rotation || 0;
		setSymbolEdited();
		return;
	}
	if (card.setSymbolDefaults) {
		document.querySelector('#setSymbol-x').value = card.setSymbolDefaults.x;
		document.querySelector('#setSymbol-y').value = card.setSymbolDefaults.y;
		document.querySelector('#setSymbol-zoom').value = card.setSymbolDefaults.zoom;
		document.querySelector('#setSymbol-rotate').value = card.setSymbolDefaults.rotation || 0;
		setSymbolEdited();
		return;
	}
	document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x));
	document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y));
	const setSymbolTargetWidth = card.setSymbolBounds.fitWidth || scaleWidth(card.setSymbolBounds.width);
	const setSymbolTargetHeight = card.setSymbolBounds.fitHeight || scaleHeight(card.setSymbolBounds.height);
	var setSymbolZoom;
	if (setSymbol.width / setSymbol.height > setSymbolTargetWidth / setSymbolTargetHeight) {
		setSymbolZoom = (setSymbolTargetWidth / setSymbol.width * 100).toFixed(1);
	} else {
		setSymbolZoom = (setSymbolTargetHeight / setSymbol.height * 100).toFixed(1);
	}
	document.querySelector('#setSymbol-zoom').value = setSymbolZoom;
	document.querySelector('#setSymbol-rotate').value = card.setSymbolBounds.rotation || 0;
	if (card.setSymbolBounds.horizontal == 'center') {
		document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) / 2 - scaleWidth(card.marginX));
	} else if (card.setSymbolBounds.horizontal == 'right') {
		document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) - scaleWidth(card.marginX));
	}
	if (card.setSymbolBounds.vertical == 'center') {
		document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) / 2 - scaleHeight(card.marginY));
	} else if (card.setSymbolBounds.vertical == 'bottom') {
		document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) - scaleHeight(card.marginY));
	}
	if (card.setSymbolBounds.visualHorizontal) {
		const rotation = Math.PI * (card.setSymbolBounds.rotation || 0) / 180;
		const cosine = Math.abs(Math.cos(rotation));
		const sine = Math.abs(Math.sin(rotation));
		const renderedWidth = setSymbol.width * setSymbolZoom / 100;
		const renderedHeight = setSymbol.height * setSymbolZoom / 100;
		const targetVisualWidth = setSymbolTargetWidth * cosine + setSymbolTargetHeight * sine;
		const renderedVisualWidth = renderedWidth * cosine + renderedHeight * sine;
		const availableVisualSpace = Math.max(0, targetVisualWidth - renderedVisualWidth);
		const direction = card.setSymbolBounds.visualHorizontal === 'left' ? -1 : 1;
		const alignedX = parseFloat(document.querySelector('#setSymbol-x').value) + direction * availableVisualSpace / 2;
		document.querySelector('#setSymbol-x').value = Number(alignedX.toFixed(1));
	}
	if (card.setSymbolBounds.visualVertical) {
		const rotation = Math.PI * (card.setSymbolBounds.rotation || 0) / 180;
		const cosine = Math.abs(Math.cos(rotation));
		const sine = Math.abs(Math.sin(rotation));
		const renderedWidth = setSymbol.width * setSymbolZoom / 100;
		const renderedHeight = setSymbol.height * setSymbolZoom / 100;
		const targetVisualHeight = setSymbolTargetWidth * sine + setSymbolTargetHeight * cosine;
		const renderedVisualHeight = renderedWidth * sine + renderedHeight * cosine;
		const availableVisualSpace = Math.max(0, targetVisualHeight - renderedVisualHeight);
		const direction = card.setSymbolBounds.visualVertical === 'top' ? -1 : 1;
		const alignedY = parseFloat(document.querySelector('#setSymbol-y').value) + direction * availableVisualSpace / 2;
		document.querySelector('#setSymbol-y').value = Number(alignedY.toFixed(1));
	}
	setSymbolEdited();
}
function fetchSetSymbol() {
	var setCode = document.querySelector('#set-symbol-code').value.toLowerCase() || 'cmd';
	if (document.querySelector('#lockSetSymbolCode').checked) {
		localStorage.setItem('lockSetSymbolCode', setCode);
	}
	var setRarity = document.querySelector('#set-symbol-rarity').value.toLowerCase().replace('uncommon', 'u').replace('common', 'c').replace('rare', 'r').replace('mythic', 'm') || 'c';
	if (['a22', 'a23', 'j22', 'hlw'].includes(setCode.toLowerCase())) {
		uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.png`), 'resetSetSymbol');
	} else if (['cc', 'logan', 'joe'].includes(setCode.toLowerCase())) {
		uploadSetSymbol(fixUri(`/img/setSymbols/custom/${setCode.toLowerCase()}-${setRarity}.svg`), 'resetSetSymbol');
	} else if (document.querySelector("#set-symbol-source").value == 'gatherer') {
		if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
		uploadSetSymbol('http://gatherer.wizards.com/Handlers/Image.ashx?type=symbol&set=' + setCode + '&size=large&rarity=' + setRarity, 'resetSetSymbol');
    } else if (document.querySelector("#set-symbol-source").value == 'hexproof') {
        if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
        var hexproofUrl = 'https://api.hexproof.io/symbols/set/' + setCode + '/' + setRarity;
        // Use CORS proxy for hexproof.io
        if (params.get('noproxy') == null) {
            hexproofUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(hexproofUrl);
        }
        uploadSetSymbol(hexproofUrl, 'resetSetSymbol');
	} else {
		var extension = 'svg';
		if (['xxxx'].includes(setCode.toLowerCase())) {
			extension = 'png';
		}
		if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
		uploadSetSymbol(fixUri(`/img/setSymbols/official/${setCode.toLowerCase()}-${setRarity}.` + extension), 'resetSetSymbol');
	}
}
function lockSetSymbolCode() {
	var savedValue = '';
	if (document.querySelector('#lockSetSymbolCode').checked) {
		savedValue = document.querySelector('#set-symbol-code').value;
	}
	localStorage.setItem('lockSetSymbolCode', savedValue);
}
function lockSetSymbolURL() {
	var savedValue = '';
	if (document.querySelector('#lockSetSymbolURL').checked) {
		savedValue = card.setSymbolSource;
	}
	localStorage.setItem('lockSetSymbolURL', savedValue);
}
//WATERMARK TAB
const WATERMARK_TINTS = {
	W:'#b79d58', U:'#8cacc5', B:'#5e5e5e', R:'#c66d39', G:'#598c52',
	M:'#cab34d', A:'#647d86', L:'#5e5448'
};

const WATERMARK_PRESETS = [
	['General', [['Planeswalker','planeswalker'],['Desparked Planeswalker','desparked-planeswalker'],['DCI Star','misc-star'],['DCI Logo','misc-dci']]],
	['Monocolors', [['White','w'],['Blue','u'],['Black','b'],['Red','r'],['Green','g'],['Colorless','c']]],
	['Mechanics', [['Foretell','ability-foretell']]],
	['Phyrexian / Mirrodin', [['Phyrexian','phyrexian'],['Mirran','mirran']]],
	['Guilds · Ravnica', [['Azorius','guild-azorius'],['Dimir','guild-dimir'],['Rakdos','guild-rakdos'],['Gruul','guild-gruul'],['Selesnya','guild-selesnya'],['Orzhov','guild-orzhov'],['Izzet','guild-izzet'],['Golgari','guild-golgari'],['Boros','guild-boros'],['Simic','guild-simic']]],
	['Schools · Strixhaven', [['Silverquill','school-silverquill'],['Prismari','school-prismari'],['Witherbloom','school-witherbloom'],['Lorehold','school-lorehold'],['Quandrix','school-quandrix']]],
	['Echoverse', [['Echoverse','fracture']]],
	['Families · New Capenna', [['Brokers','family-brokers'],['Obscura','family-obscura'],['Maestros','family-maestros'],['Riveteers','family-riveteers'],['Cabaretti','family-cabaretti']]],
	['Clans · Tarkir', [['Abzan','clan-abzan'],['Jeskai','clan-jeskai'],['Sultai','clan-sultai'],['Mardu','clan-mardu'],['Temur','clan-temur'],['Ojutai','clan-ojutai'],['Silumgar','clan-silumgar'],['Kolaghan','clan-kolaghan'],['Atarka','clan-atarka'],['Dromoka','clan-dromoka']]],
	['Poleis · Theros', [['Akros','polis-akros'],['Meletis','polis-meletis'],['Setessa','polis-setessa']]],
	['Factions · Bablovia', [['Order of the Widget','faction-order-of-the-widget'],['Agents of S.N.E.A.K.','faction-agents-of-sneak'],['League of Dastardly Doom','faction-league-of-dastardly-doom'],['Goblin Explosioneers','faction-goblin-explosioneers'],['Crossbreed Labs','faction-crossbreed-labs']]],
	['Avatar: The Last Airbender', [['Water Tribe','atla-water'],['Earth Kingdom','atla-earth'],['Fire Nation','atla-fire'],['Air Nomads','atla-air']]],
	['Custom', [['Purple Mana','purple']]]
].flatMap(([group, presets]) => presets.map(([name, file]) => ({group, name, src:'/img/watermarks/' + file + '.svg'})));

function automaticWatermarkColors() {
	var derived = window.CardConjurerSetModel?.deriveCard({cardData:{text:card.text || {}}})?.derived || {};
	var types = derived.cardTypes || [];
	if (types.includes('land')) return {left:WATERMARK_TINTS.L, right:'none', label:'Land'};
	if (types.includes('artifact')) return {left:WATERMARK_TINTS.A, right:'none', label:'Artifact'};
	var colors = derived.colorIdentity || [];
	if (window.FRAME_REGISTRY?.canonicalColors) colors = FRAME_REGISTRY.canonicalColors(colors);
	if (colors.length >= 3) return {left:WATERMARK_TINTS.M, right:'none', label:'Gold'};
	if (colors.length === 2) return {left:WATERMARK_TINTS[colors[0]], right:WATERMARK_TINTS[colors[1]], label:colors.join('')};
	if (colors.length === 1) return {left:WATERMARK_TINTS[colors[0]], right:'none', label:colors[0]};
	var hasCardContent = Boolean(derived.title || derived.typeLine || derived.manaCost || derived.rulesText);
	return hasCardContent
		? {left:WATERMARK_TINTS.A, right:'none', label:'Colorless'}
		: {left:'none', right:'none', label:'None'};
}

function watermarkPreviewBackground(left, rightColor) {
	var visibleLeft = left === 'none' || left === 'default' ? '#eef2f7' : left;
	var visibleRight = rightColor === 'none' || rightColor === 'default' ? visibleLeft : rightColor;
	return rightColor === 'none'
		? visibleLeft
		: `linear-gradient(90deg, ${visibleLeft} 0 50%, ${visibleRight} 50% 100%)`;
}

function refreshWatermarkCatalogTint() {
	var colors = card.watermarkColorMode === 'manual'
		? {left:card.watermarkLeft || 'none', right:card.watermarkRight || 'none'}
		: automaticWatermarkColors();
	document.querySelectorAll('.watermark-catalog-symbol').forEach(symbol => {
		symbol.style.background = watermarkPreviewBackground(colors.left, colors.right);
	});
}

function updateWatermarkColorControls() {
	var automatic = card.watermarkColorMode !== 'manual';
	var autoInput = document.querySelector('#watermark-auto-colors');
	var manualControls = document.querySelector('#watermark-manual-colors');
	if (autoInput) autoInput.checked = automatic;
	if (manualControls) manualControls.hidden = automatic;
	var leftSelect = document.querySelector('#watermark-left');
	var rightSelect = document.querySelector('#watermark-right');
	if (leftSelect && Array.from(leftSelect.options).some(option => option.value === card.watermarkLeft)) leftSelect.value = card.watermarkLeft;
	if (rightSelect && Array.from(rightSelect.options).some(option => option.value === card.watermarkRight)) rightSelect.value = card.watermarkRight;
}

function syncAutomaticWatermarkColors() {
	if (card.watermarkColorMode === 'manual') {
		refreshWatermarkCatalogTint();
		return;
	}
	card.watermarkColorMode = 'auto';
	var colors = automaticWatermarkColors();
	var changed = card.watermarkLeft !== colors.left || card.watermarkRight !== colors.right;
	card.watermarkLeft = colors.left;
	card.watermarkRight = colors.right;
	updateWatermarkColorControls();
	refreshWatermarkCatalogTint();
	if (changed && document.querySelector('#watermark-opacity')) watermarkEdited();
}

function setWatermarkAutoColors(enabled) {
	card.watermarkColorMode = enabled ? 'auto' : 'manual';
	updateWatermarkColorControls();
	if (enabled) syncAutomaticWatermarkColors();
	else refreshWatermarkCatalogTint();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}

function renderWatermarkCatalog() {
	var catalog = document.querySelector('#watermark-catalog');
	if (!catalog || catalog.childElementCount) return;
	WATERMARK_PRESETS.forEach(preset => {
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'watermark-catalog-item';
		button.dataset.search = `${preset.name} ${preset.group}`.toLowerCase();
		button.dataset.src = preset.src;
		button.title = `${preset.name} · ${preset.group}`;
		button.setAttribute('aria-label', `Use ${preset.name} watermark`);
		button.onclick = () => selectWatermarkPreset(preset, button);

		var preview = document.createElement('span');
		preview.className = 'watermark-catalog-preview';
		var symbol = document.createElement('span');
		symbol.className = 'watermark-catalog-symbol';
		symbol.style.webkitMaskImage = `url("${fixUri(preset.src)}")`;
		symbol.style.maskImage = `url("${fixUri(preset.src)}")`;
		preview.appendChild(symbol);

		var label = document.createElement('span');
		label.className = 'watermark-catalog-title';
		label.textContent = preset.name;
		button.append(preview, label);
		catalog.appendChild(button);
	});
	refreshWatermarkCatalogTint();
	filterWatermarkCatalog('');
}

function selectWatermarkPreset(preset, button) {
	card.watermarkPresetSource = preset.src;
	document.querySelectorAll('.watermark-catalog-item').forEach(item => {
		var selected = item === button;
		item.classList.toggle('selected', selected);
		item.setAttribute('aria-pressed', selected ? 'true' : 'false');
	});
	syncAutomaticWatermarkColors();
	getSetSymbolWatermark(fixUri(preset.src), watermark, preset.src);
}

function filterWatermarkCatalog(value) {
	var query = String(value || '').trim().toLowerCase();
	var visible = 0;
	document.querySelectorAll('.watermark-catalog-item').forEach(item => {
		item.hidden = Boolean(query) && !item.dataset.search.includes(query);
		if (!item.hidden) visible++;
	});
	var status = document.querySelector('#watermark-catalog-status');
	if (status) status.textContent = `${visible} watermark${visible === 1 ? '' : 's'}`;
}

function clearWatermarkCatalogSearch() {
	var search = document.querySelector('#watermark-search');
	if (!search) return;
	search.value = '';
	filterWatermarkCatalog('');
	search.focus();
}

function loadWatermarkUrl() {
	var input = document.querySelector('#watermark-url');
	var value = String(input?.value || '').trim();
	if (!value) return;
	card.watermarkPresetSource = '';
	imageURL(value, uploadWatermark, 'resetWatermark');
}

function loadWatermarkCode() {
	var input = document.querySelector('#watermark-code');
	var value = String(input?.value || '').trim().toLowerCase();
	if (!value) return;
	input.value = value;
	card.watermarkPresetSource = '';
	getSetSymbolWatermark(value);
}

function uploadWatermark(imageSource, otherParams, presetSource) {
	ImageLoadTracker.track(imageSource);
	card.watermarkPresetSource = presetSource || '';
	document.querySelectorAll('.watermark-catalog-item').forEach(item => {
		var selected = item.dataset.src === card.watermarkPresetSource;
		item.classList.toggle('selected', selected);
		item.setAttribute('aria-pressed', selected ? 'true' : 'false');
	});
	watermark.src = imageSource;
	if (otherParams && otherParams == 'resetWatermark') {
		watermark.onload = function() {
			resetWatermark();
			watermark.onload = watermarkEdited;
		};
	}
}
function watermarkLeftColor(c) {
	card.watermarkColorMode = 'manual';
	card.watermarkLeft = c;
	updateWatermarkColorControls();
	refreshWatermarkCatalogTint();
	watermarkEdited();
}
function watermarkRightColor(c) {
	card.watermarkColorMode = 'manual';
	card.watermarkRight = c;
	updateWatermarkColorControls();
	refreshWatermarkCatalogTint();
	watermarkEdited();
}
function watermarkEdited() {
	card.watermarkSource = watermark.src;
	card.watermarkX = document.querySelector('#watermark-x').value / card.width;
	card.watermarkY = document.querySelector('#watermark-y').value / card.height;
	card.watermarkZoom = document.querySelector('#watermark-zoom').value / 100;
	card.watermarkOpacity = document.querySelector('#watermark-opacity').value / 100;
	watermarkContext.globalCompositeOperation = 'source-over';
	watermarkContext.globalAlpha = 1;
	watermarkContext.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
	if (card.watermarkLeft != 'none' && !card.watermarkSource.includes('/blank.png') && card.watermarkZoom > 0) {
		if (card.watermarkRight != 'none') {
			watermarkContext.drawImage(right, scaleX(0), scaleY(0), scaleWidth(1), scaleHeight(1));
			watermarkContext.globalCompositeOperation = 'source-in';
			if (card.watermarkRight == 'default') {
				watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
			} else {
				watermarkContext.fillStyle = card.watermarkRight;
				watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
			}
			watermarkContext.globalCompositeOperation = 'destination-over';
		}
		if (card.watermarkLeft == 'default') {
			watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
		} else {
			watermarkContext.fillStyle = card.watermarkLeft;
			watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
		}
		watermarkContext.globalCompositeOperation = 'destination-in';
		watermarkContext.drawImage(watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom);
		watermarkContext.globalAlpha = card.watermarkOpacity;
		watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
	}
	drawCard();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}
function resetWatermark() {
	var watermarkZoom;
	if (watermark.width / watermark.height > scaleWidth(card.watermarkBounds.width) / scaleHeight(card.watermarkBounds.height)) {
		watermarkZoom = (scaleWidth(card.watermarkBounds.width) / watermark.width * 100).toFixed(1);
	} else {
		watermarkZoom = (scaleHeight(card.watermarkBounds.height) / watermark.height * 100).toFixed(1);
	}
	document.querySelector('#watermark-zoom').value = watermarkZoom;
	document.querySelector('#watermark-x').value = Math.round(scaleX(card.watermarkBounds.x) - watermark.width * watermarkZoom / 200 - scaleWidth(card.marginX));
	document.querySelector('#watermark-y').value = Math.round(scaleY(card.watermarkBounds.y) - watermark.height * watermarkZoom / 200 - scaleHeight(card.marginY));
	watermarkEdited();
}
//svg cropper
function getSetSymbolWatermark(url, targetImage = watermark, presetSource = '') {
	if (!url.includes('/')) {
		url = 'https://cdn.jsdelivr.net/npm/keyrune/svg/' + url + '.svg';
	}
	xhttp = new XMLHttpRequest();
	xhttp.open('GET', url, true);
	xhttp.overrideMimeType('image/svg+xml');
	xhttp.onload = function(event) {
		if (this.readyState == 4 && this.status == 200) {
		    var svg = document.body.appendChild(xhttp.responseXML.documentElement);
		    var box = svg.getBBox(svg);
			svg.setAttribute('viewBox', [box.x, box.y, box.width, box.height].join(' '));
			svg.setAttribute('width', box.width);
			svg.setAttribute('height', box.height);
			uploadWatermark('data:image/svg+xml,' + encodeURIComponent(svg.outerHTML), 'resetWatermark', presetSource);
			svg.remove();
		} else if (this.status == 404) {
			throw new Error('Improper Set Code');
		}
	}
	xhttp.send();
}
//Bottom Info Tab
async function loadBottomInfo(textObjects = []) {
	await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
	card.bottomInfo = null;
	card.bottomInfo = textObjects;
	await bottomInfoEdited();
}
function limitCollectorCopyrightLines(input) {
	var lines = input.value.replace(/\r/g, '').split('\n');
	if (lines.length > 2) {
		input.value = lines.slice(0, 2).join('\n');
	}
}
function collectorCopyrightHasStatBox() {
	var layoutOverride = card.collectorCopyrightLayout || {};
	if (typeof layoutOverride.hasStatBox == 'boolean') {
		return layoutOverride.hasStatBox;
	}

	var frameNames = (card.frames || []).map(frame => String(frame.name || '').toLowerCase());
	var version = String(card.version || '').toLowerCase();
	return frameNames.some(name => name.includes('power/toughness') || name.includes('loyalty box') || name == 'loyalty' || name.includes('defense'))
		|| version.includes('planeswalker') || version.includes('battle');
}
function measureCollectorCopyrightLine(text, layout) {
	lineContext.save();
	lineContext.letterSpacing = '0px';
	lineContext.font = scaleHeight(layout.size) + 'px ' + layout.font;
	var metrics = lineContext.measureText(text.replace(/{[^}]+}/g, ''));
	lineContext.restore();
	return {
		width: metrics.width / card.width,
		left: (metrics.actualBoundingBoxLeft || 0) / card.width,
		right: (metrics.actualBoundingBoxRight || metrics.width) / card.width
	};
}
function drawCollectorCopyright() {
	if (!document.querySelector('#enableNewCollectorStyle').checked) {
		return;
	}

	var rawCopyright = document.querySelector('#info-copyright').value || '';
	if (params.get('copyright') != null) {
		rawCopyright = params.get('copyright') == 'none' ? '' : params.get('copyright');
	}
	var lines = rawCopyright.replace(/\r/g, '').split('\n').slice(0, 2);
	if (!lines.some(line => line.trim())) {
		return;
	}
	var hasSecondLine = lines.length > 1 && Boolean(lines[1].trim());

	var hasStatBox = collectorCopyrightHasStatBox();
	var layout = Object.assign({
		x: 0.56,
		width: 0.3754,
		firstY: 0.9377,
		secondY: 0.9548,
		height: 0.0143,
		size: 0.0143,
		font: 'mplantin'
	}, card.collectorCopyrightLayout || {});
	var noteTextObject = card.bottomInfo && card.bottomInfo.note ? card.bottomInfo.note : {};
	var useNoteStyle = document.querySelector('#copyrightFirstLineNoteStyle').checked;
	var firstLineLayout = useNoteStyle ? Object.assign({}, layout, {
		font: noteTextObject.font || 'gothammedium',
		size: noteTextObject.size || 0.0171,
		height: noteTextObject.height || 0.0171
	}) : layout;
	var secondLineMetrics = hasSecondLine ? measureCollectorCopyrightLine(lines[1], layout) : null;
	var blockWidth = hasSecondLine ? Math.min(layout.width, secondLineMetrics.width) : layout.width;
	var blockX = layout.x + layout.width - blockWidth;
	var firstLineY = hasSecondLine || !hasStatBox ? layout.firstY : layout.secondY;
	var common = {
		x: blockX,
		width: blockWidth,
		height: layout.height,
		oneLine: true,
		font: layout.font,
		size: layout.size,
		color: card.bottomInfoColor,
		outlineWidth: 0.003
	};

	var firstLine = Object.assign({}, common, {
		name: 'copyrightLine1',
		text: lines[0],
		y: firstLineY,
		align: hasStatBox && hasSecondLine ? 'left' : 'right',
		font: firstLineLayout.font,
		size: firstLineLayout.size,
		height: firstLineLayout.height
	});
	var firstLineMetrics = measureCollectorCopyrightLine(lines[0], firstLineLayout);
	if (hasStatBox && hasSecondLine) {
		firstLine.x += firstLineMetrics.left - secondLineMetrics.left;
	} else {
		firstLine.x += firstLineMetrics.width - firstLineMetrics.right;
	}
	writeText(firstLine, bottomInfoContext);

	if (hasSecondLine) {
		var secondLine = Object.assign({}, common, {
			name: 'copyrightLine2',
			text: lines[1],
			y: layout.secondY,
			align: hasStatBox ? 'left' : 'right'
		});
		if (!hasStatBox) {
			secondLine.x += secondLineMetrics.width - secondLineMetrics.right;
		}
		writeText(secondLine, bottomInfoContext);
	}
}
function copyrightFirstLineNoteStyleEdited() {
	card.infoCopyrightFirstLineNoteStyle = document.querySelector('#copyrightFirstLineNoteStyle').checked;
	bottomInfoEdited();
}
async function bottomInfoEdited() {
	var requestId = ++bottomInfoRenderRequestId;
	card.infoNumber = document.querySelector('#info-number').value;
	card.infoRarity = document.querySelector('#info-rarity').value;
	card.infoSet = document.querySelector('#info-set').value;
	card.infoLanguage = document.querySelector('#info-language').value;
	card.infoArtist = document.querySelector('#info-artist').value;
	card.infoYear = document.querySelector('#info-year').value;
	card.infoNote = document.querySelector('#info-note').value;
	card.infoCopyright = document.querySelector('#info-copyright').value;
	card.infoCopyrightFirstLineNoteStyle = document.querySelector('#copyrightFirstLineNoteStyle').checked;
	var bottomTextObjects = Object.values(card.bottomInfo || {});
	var previewCommitId = beginPreviewRenderCommit();
	await ensureCanvasFontsReady(bottomTextObjects);
	if (requestId !== bottomInfoRenderRequestId) {
		return false;
	}
	bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);

	if (document.querySelector('#enableCollectorInfo').checked) {
		for (var textObject of Object.entries(card.bottomInfo)) {
			if (["NOT FOR SALE", "Wizards of the Coast", "CardConjurer.com", "cardconjurer.com"].some(v => textObject[1].text.includes(v))) {
				continue;
			} else {
				textObject[1].name = textObject[0];
				writeText(textObject[1], bottomInfoContext);
			}
			continue;
		}
		drawCollectorCopyright();
	}

	drawCard();
	finishPreviewRenderCommit(previewCommitId);
	return true;
}
async function serialInfoEdited() {
	card.serialNumber = document.querySelector('#serial-number').value;
	card.serialTotal = document.querySelector('#serial-total').value;
	card.serialX = document.querySelector('#serial-x').value;
	card.serialY = document.querySelector('#serial-y').value;
	card.serialScale = document.querySelector('#serial-scale').value;

	drawCard();
}

async function resetSerial() {
	card.serialX = scaleX(172/2010);
	card.serialY = scaleY(1383/2814);
	card.serialScale = 1.0;

	document.querySelector('#serial-x').value = card.serialX;
	document.querySelector('#serial-y').value = card.serialY;
	document.querySelector('#serial-scale').value = card.serialScale;

	drawCard();
}

function artistEdited(value) {
	document.querySelector('#art-artist').value = value;
	document.querySelector('#info-artist').value = value;
	bottomInfoEdited();
}
function collectorBottomInfoUsesStar(bottomInfo = card.bottomInfo) {
	return Object.values(bottomInfo || {}).some(function(item) { return String(item?.text || '').includes('*'); });
}
function applyCollectorStarStyle(enabled) {
	Object.values(card.bottomInfo || {}).forEach(function(item) {
		var text = String(item?.text || '');
		item.text = enabled ? text.split(' \u2022 ').join('*') : text.split('*').join(' \u2022 ');
	});
}
function syncCollectorStarControl() {
	var input = document.querySelector('#collector-use-star');
	if (input) input.checked = Boolean(card.infoUseStar);
}
function setCollectorStar(enabled) {
	card.infoUseStar = Boolean(enabled);
	applyCollectorStarStyle(card.infoUseStar);
	syncCollectorStarControl();
	bottomInfoEdited();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}
function toggleStarDot() {
	setCollectorStar(!Boolean(card.infoUseStar));
}
async function enableNewCollectorInfoStyle() {
	localStorage.setItem('enableNewCollectorStyle', document.querySelector('#enableNewCollectorStyle').checked);
	await setBottomInfoStyle();
	bottomInfoEdited();
}
function enableCollectorInfo() {
	localStorage.setItem('enableCollectorInfo', document.querySelector('#enableCollectorInfo').checked);
	bottomInfoEdited();
}
function enableImportCollectorInfo() {
	localStorage.setItem('enableImportCollectorInfo', document.querySelector('#enableImportCollectorInfo').checked);
}
function setAutoFrame() {
	var value = document.querySelector('#autoFrame').value;
	localStorage.setItem('autoFrame', value);

	if (value !== 'false') {
		document.querySelector('#autoLoadFrameVersion').checked = true;
		localStorage.setItem('autoLoadFrameVersion', 'true');
	}

	autoFrame();
}
function setAutomaticallyUpdateFrame() {
	const toggle = document.querySelector('#automaticallyUpdateFrame');
	localStorage.setItem('automaticallyUpdateFrame', toggle.checked);
	if (!toggle.checked) {
		autoFramePack = null;
		return;
	}
	const selectedPack = typeof activeFramePack == 'undefined' ? 'M15Regular-1' : activeFramePack;
	const engine = typeof FRAME_REGISTRY == 'undefined' ? selectedPack : (FRAME_REGISTRY.engine(selectedPack) || selectedPack);
	document.querySelector('#autoFrame').value = engine;
	document.querySelector('#autoFrame').dataset.profile = selectedPack;
	localStorage.setItem('autoFrame', engine);
	localStorage.setItem('selectedFrameProfile', selectedPack);
	document.querySelector('#autoLoadFrameVersion').checked = true;
	localStorage.setItem('autoLoadFrameVersion', 'true');
	autoFramePack = engine;
	autoFrame();
}
function setAutofit() {
	localStorage.setItem('autoFit', document.querySelector('#art-update-autofit').checked);
}
function setPreserveArtPosition() {
	localStorage.setItem('preserveArtPosition', document.querySelector('#art-preserve-position').checked);
}
function removeDefaultCollector() {
	defaultCollector = {}; //{number: year, rarity:'P', setCode:'MTG', lang:'EN', starDot:false};
	localStorage.removeItem('defaultCollector'); //localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}
function setDefaultCollector() {
	starDot = defaultCollector.starDot;
	defaultCollector = {
		number: document.querySelector('#info-number').value,
		rarity: document.querySelector('#info-rarity').value,
		setCode: document.querySelector('#info-set').value,
		lang: document.querySelector('#info-language').value,
		note: document.querySelector('#info-note').value,
		copyright: document.querySelector('#info-copyright').value,
		starDot: starDot
	};
	localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}
function drawSetSymbol(cardContext, setSymbol, bounds) {
	const isImageElement = typeof HTMLImageElement !== 'undefined' && setSymbol instanceof HTMLImageElement;
	if (!bounds || !setSymbol || !setSymbol.width || !setSymbol.height || (isImageElement && (!setSymbol.complete || !setSymbol.naturalWidth || !setSymbol.naturalHeight))) return;
    
    const symbolWidth = setSymbol.width * card.setSymbolZoom;
    const symbolHeight = setSymbol.height * card.setSymbolZoom; 
    const x = scaleX(card.setSymbolX);
    const y = scaleY(card.setSymbolY);

    if (bounds.outlineWidth && bounds.outlineWidth > 0) {
        // Create temp canvas for outlined symbol
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Scale the outline width the same way text outlines are scaled
        const outlineWidth = scaleHeight(bounds.outlineWidth);
        const margin = outlineWidth * 2;
        tempCanvas.width = symbolWidth + margin;
        tempCanvas.height = symbolHeight + margin;
        
        // Setup stroke style (similar to text outline system)
        tempCtx.strokeStyle = bounds.outlineColor || 'black';
        tempCtx.lineWidth = outlineWidth;
        tempCtx.lineJoin = bounds.lineJoin || 'round';
        tempCtx.lineCap = bounds.lineCap || 'round';
        
        // First pass: Draw outline by stroking the symbol multiple times in a circle pattern
        const outlineSteps = Math.max(8, Math.ceil(outlineWidth * 2));
        for (let i = 0; i < outlineSteps; i++) {
            const angle = (i / outlineSteps) * Math.PI * 2;
            const offsetX = Math.cos(angle) * (outlineWidth / 2);
            const offsetY = Math.sin(angle) * (outlineWidth / 2);
            
            tempCtx.globalCompositeOperation = 'source-over';
            tempCtx.drawImage(setSymbol, 
                outlineWidth + offsetX, 
                outlineWidth + offsetY, 
                symbolWidth, 
                symbolHeight);
            
            // Apply the outline color
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = bounds.outlineColor || 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.globalCompositeOperation = 'destination-over';
        }
        
        // Second pass: Draw the original symbol on top
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.drawImage(setSymbol, outlineWidth, outlineWidth, symbolWidth, symbolHeight);

        // Draw to main canvas
        drawRotatedSetSymbol(cardContext, tempCanvas,
            x - outlineWidth,
            y - outlineWidth,
            tempCanvas.width,
            tempCanvas.height,
            card.setSymbolRotate);
    } else {
        // Draw main symbol without outline (simple path)
        drawRotatedSetSymbol(cardContext, setSymbol, x, y, symbolWidth, symbolHeight, card.setSymbolRotate);
    }
}
function drawRotatedSetSymbol(context, image, x, y, width, height, rotation = 0) {
	const isImageElement = typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement;
	if (!image || !width || !height || (isImageElement && (!image.complete || !image.naturalWidth || !image.naturalHeight))) return;
	if (!rotation) {
		context.drawImage(image, x, y, width, height);
		return;
	}
	context.save();
	context.translate(x + width / 2, y + height / 2);
	context.rotate(Math.PI * rotation / 180);
	context.drawImage(image, -width / 2, -height / 2, width, height);
	context.restore();
}
//DRAWING THE CARD (putting it all together)
function drawCard() {
	// reset
	cardContext.globalCompositeOperation = 'source-over';
	cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
	// art
	cardContext.save();
	cardContext.translate(scaleX(card.artX), scaleY(card.artY));
	cardContext.rotate(Math.PI / 180 * (card.artRotate || 0));
	if (document.querySelector('#grayscale-art').checked) {
		cardContext.filter='grayscale(1)';
	}
	if (isDrawableImage(art)) cardContext.drawImage(art, 0, 0, art.width * card.artZoom, art.height * card.artZoom);
	cardContext.restore();
	// frame elements
	if (card.version.includes('planeswalker') && typeof planeswalkerPreFrameCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	cardContext.drawImage(frameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerPostFrameCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('station') && typeof stationPreFrameCanvas !== "undefined") {
		cardContext.drawImage(stationPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	if (card.version.toLowerCase().includes('station') && typeof stationPostFrameCanvas !== "undefined") {
		cardContext.drawImage(stationPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('qrcode') && typeof qrCodeCanvas !== "undefined") {
		cardContext.drawImage(qrCodeCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} // REMOVE/DELETE PLANESWALKERCANVAS AFTER A FEW WEEKS
	// guidelines
	if (document.querySelector('#show-guidelines').checked) {
		cardContext.drawImage(guidelinesCanvas, scaleX(card.marginX) / 2, scaleY(card.marginY) / 2, cardCanvas.width, cardCanvas.height);
	}
	// watermark
	cardContext.drawImage(watermarkCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	// custom elements for sagas, classes, and dungeons
	if (card.version.toLowerCase().includes('saga') && typeof sagaCanvas !== "undefined") {
		cardContext.drawImage(sagaCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.includes('class') && !card.version.includes('classic') && typeof classCanvas !== "undefined") {
		cardContext.drawImage(classCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('dungeon') && typeof dungeonCanvas !== "undefined") {
		cardContext.drawImage(dungeonCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	// text
	cardContext.drawImage(textCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	// set symbol
	if (card.setSymbolBounds) {
		drawSetSymbol(cardContext, setSymbol, card.setSymbolBounds); 
	}
	// serial
	if (card.serialNumber || card.serialTotal) {
		var x = parseInt(card.serialX) || 172;
		var y = parseInt(card.serialY) || 1383;
		var scale = parseFloat(card.serialScale) || 1.0;

		cardContext.drawImage(serial, scaleX(x/2010), scaleY(y/2814), scaleWidth(464/2010) * scale, scaleHeight(143/2814) * scale);

		var number = {
			name:"Number",
			text: '{kerning3}' + card.serialNumber || '',
			x: (x+(30 * scale))/2010,
			y: (y+(52 * scale))/2814,
			width: (190 * scale)/2010,
			height: (55 * scale)/2814,
			oneLine: true,
			font: 'gothambold',
			color: 'white',
			size: (55 * scale)/2010,
			align: 'center'
		};

		var total = {
			name:"Number",
			text: '{kerning3}' + card.serialTotal || '',
			x: (x+(251 * scale))/2010,
			y: (y+(52 * scale))/2814,
			width: (190 * scale)/2010,
			height: (55 * scale)/2814,
			oneLine: true,
			font: 'gothambold',
			color: 'white',
			size: (55 * scale)/2010,
			align: 'center'
		};

		writeText(number, cardContext);
		writeText(total, cardContext);
	}
	// bottom info
	if (card.bottomInfoTranslate) {
		cardContext.save();
		cardContext.rotate(Math.PI / 180 * (card.bottomInfoRotate || 0));
		cardContext.translate(card.bottomInfoTranslate.x || 0, card.bottomInfoTranslate.y || 0);
		cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width * (card.bottomInfoZoom || 1), cardCanvas.height * (card.bottomInfoZoom || 1));
		cardContext.restore();
	} else {
		cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}


	// cutout the corners
	cardContext.globalCompositeOperation = 'destination-out';
	if (!card.noCorners && (card.marginX == 0 && card.marginY == 0)) {
		var w = card.version == 'battle' ? 2100 : getStandardWidth();

		cardContext.drawImage(corner, 0, 0, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, 0, -card.width, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, -card.width, -card.height, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, -card.height, 0, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
	}
	// ZIP exports render through the high-resolution card canvas without
	// flashing each temporary card through the visible editor preview.
	if (!window.cardConjurerSuppressPreviewRender) {
		previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		previewContext.drawImage(cardCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
		window.dispatchEvent(new CustomEvent('cardconjurer:preview-rendered'));
	}

	if (window.cardDrawingPromiseResolver) {
        window.cardDrawingPromiseResolver();
        window.cardDrawingPromiseResolver = null;
	}
}
//DOWNLOADING
function downloadCard(alt = false, jpeg = false) {
	if (card.infoArtist.replace(/ /g, '') == '' && !card.artSource.includes('/img/blank.png') && !card.artZoom == 0) {
		notify('You must credit an artist before downloading!', 5);
	} else {
		// Prep file information
		var imageDataURL;
		var imageName = getCardName();
		if (jpeg) {
			imageDataURL = cardCanvas.toDataURL('image/jpeg', 0.8);
			imageName = imageName + '.jpg';
		} else {
			imageDataURL = cardCanvas.toDataURL('image/png');
			imageName = imageName + '.png';
		}
		// Download image
		if (alt) {
			const newWindow = window.open('about:blank');
			setTimeout(function(){
				newWindow.document.body.appendChild(newWindow.document.createElement('img')).src = imageDataURL;
				newWindow.document.querySelector('img').style = 'max-height: 100vh; max-width: 100vw;';
				newWindow.document.body.style = 'padding: 0; margin: 0; text-align: center; background-color: #888;';
				newWindow.document.title = imageName;
			}, 0);
		} else {
			if (window.setConjurerDesktop) {
				void window.setConjurerDesktop.files.saveExport({
					suggestedName: imageName,
					extension: jpeg ? 'jpg' : 'png',
					encoding: 'base64',
					content: imageDataURL.slice(imageDataURL.indexOf(',') + 1)
				}).catch(function(error) {
					console.error(error);
					notify('Set Conjurer could not export that image.', 5);
				});
				return;
			}
			const downloadElement = document.createElement('a');
			downloadElement.download = imageName;
			downloadElement.target = '_blank';
			downloadElement.href = imageDataURL;
			document.body.appendChild(downloadElement);
			downloadElement.click();
			downloadElement.remove();
		}
	}
}
async function bulkDownloadZip() {
    // 1. Initial checks for libraries and saved cards.
    if (typeof JSZip === 'undefined') {
        notify('Required library (JSZip) has not loaded yet. Please wait a moment and try again.', 5);
        return;
    }
    const cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
    if (!cardKeys || cardKeys.length === 0) {
        notify('No saved cards found to download.', 3);
        return;
    }

    let fileHandle = null;
    let useStreaming = false;

    // 2. Trigger the file picker immediately to capture the user gesture.
    if (window.showSaveFilePicker) {
        try {
            notify('Please choose a location to save your ZIP file.', 15);
            fileHandle = await window.showSaveFilePicker({
                suggestedName: 'CardConjurer_Bulk.zip',
                types: [{
                    description: 'ZIP file',
                    accept: { 'application/zip': ['.zip'] },
                }],
            });
            useStreaming = true;
        } catch (err) {
            // This error occurs if the user clicks "Cancel" in the save dialog.
            if (err.name === 'AbortError') {
                notify('Save operation cancelled.', 3);
                return; // Exit the function entirely if the user cancels.
            }
            // If another error occurs, fall back to the in-memory method.
            console.error("Could not get file handle, falling back to in-memory method:", err);
        }
    }

    // 3. Save the current state and prepare the zip object.
    notify(`Preparing to process ${cardKeys.length} cards...`, 10);
    const zip = new JSZip();
    const tempKey = '__temp_current_card_state__';
    const cardToSave = JSON.parse(JSON.stringify(card));
    cardToSave.frames.forEach(frame => {
        delete frame.image;
        frame.masks.forEach(mask => delete mask.image);
    });
    localStorage.setItem(tempKey, JSON.stringify(cardToSave));

    // 4. Loop through each saved card to render and add it to the zip object.
    for (const [index, key] of cardKeys.entries()) {
        try {
			notify(`Processing card ${index + 1} of ${cardKeys.length}: ${key}`, 1);

            ImageLoadTracker.start();
            FontLoadTracker.start();
            await loadCard(key);
            await drawText();
            
            const imagePromise = ImageLoadTracker.waitForAll();
            const fontPromise = FontLoadTracker.waitForAll();
            await Promise.all([imagePromise, fontPromise]);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            drawCard();
            
            const imageName = getCardName() + '.png';
            const imageData = cardCanvas.toDataURL('image/png').split(',')[1];
            
            zip.file(imageName, imageData, { base64: true });
            console.log(`Zipped: ${imageName}`);

        } catch (error) {
            console.error(`Failed to process and zip card "${key}":`, error);
            notify(`Skipping card "${key}" due to an error.`, 3);
        } finally {
            ImageLoadTracker.stop();
            FontLoadTracker.stop();
        }
    }

    // 5. Generate and save the ZIP file using the appropriate method.
    try {
        if (useStreaming && fileHandle) {
            // Ideal Path: Manually pump the JSZip stream to the WritableStream.
            notify('Saving ZIP file to disk...', 10);
            const writable = await fileHandle.createWritable();

            await new Promise((resolve, reject) => {
                const stream = zip.generateInternalStream({ type: 'uint8array', streamFiles: true });
                
                stream
                    .on('data', (chunk) => { writable.write(chunk).catch(reject); })
                    .on('end', () => { writable.close().then(resolve).catch(reject); })
                    .on('error', (err) => { reject(err); })
                    .resume();
            });
            notify('ZIP file saved successfully!', 5);

        } else {
            // Fallback Path: For browsers without streaming support.
            notify('Streaming not supported. Building ZIP in memory... This may be slow or fail.', 10);
            const content = await zip.generateAsync({ type: 'blob' });
            
            const downloadElement = document.createElement('a');
            downloadElement.href = URL.createObjectURL(content);
            downloadElement.download = 'CardConjurer_Bulk.zip';
            document.body.appendChild(downloadElement);
            downloadElement.click();
            document.body.removeChild(downloadElement);
        }
    } catch (err) {
        console.error('Failed to generate or save ZIP file:', err);
        notify('An error occurred while saving the ZIP file.', 5);
    }
    
    // 6. Restore the user's original card state.
    await loadCard(tempKey);
    localStorage.removeItem(tempKey);
    console.log('Bulk download process finished. User state restored.');
}
//IMPORT/SAVE TAB
function importCard(cardObject) {
	console.log('Import card called with:', cardObject); // Log initial import data
	scryfallCard = cardObject;
	const importIndex = document.querySelector('#import-index');
	importIndex.innerHTML = null;
	var optionIndex = 0;
	cardObject.forEach(card => {
		if (card.type_line && card.type_line != 'Card') {
			var option = document.createElement('option');
			var name = card.printed_name || card.name;
			if (card.flavor_name) {
				name += " (" + card.flavor_name +")";
			} else if (card.printed_name) {
				name += " (" + card.name + ")";
			}
			var title = `${name} `;
			if (document.querySelector('#importAllPrints').checked) {
				title += `(${card.set.toUpperCase()} #${card.collector_number})`;
			} else {
				title += `(${card.type_line})`
			}
			option.innerHTML = title;
			option.value = optionIndex;
			importIndex.appendChild(option);
		}
		optionIndex ++;
	});
	changeCardIndex();
}

async function pasteCardText() {
	try {
    const text = await navigator.clipboard.readText();
    console.log(text);
    const card = scryfallCardFromText(text);
    importCard([card]);
  } catch (err) {
    console.error('Failed to read clipboard text: ', err);
    notify('Clipboard access failed. Did you click the button?');
  }
}

function scryfallCardFromText(text) {
	var lines = text.trim().split("\n");

	if (lines.count == 0) {
  		return {};
	}

	lines = lines.map(item => item.trim()).filter(item => item != "");

  	var name = lines.shift();
  	var manaCost;
  	var manaCostStartIndex = name.indexOf("{");
  	if (manaCostStartIndex > 0) {
  	  manaCost = name.substring(manaCostStartIndex).trim();
  	  name = name.substring(0, manaCostStartIndex).trim();
  	}

 	 var cardObject = {
 	   "name": name,
 	   "lang": "en"
 	 };

 	 if (manaCost !== undefined) {
  	  cardObject.mana_cost = manaCost;
 	 }

  	if (lines.count == 0) {
  	  return cardObject;
  	}

 	 cardObject.type_line = lines.shift().trim();

  if (lines.count == 0) {
    return cardObject;
  }

  var regex = /[0-9+\-*]+\/[0-9+*]+/
  var match = lines[lines.length-1].match(regex);
  if (match) {
    var pt = match[0].split("/");
    cardObject.power = pt[0];
    cardObject.toughness = pt[1];
    lines.pop();
  }

  if (lines.count == 0) {
    return cardObject;
  }

  cardObject.oracle_text = lines.join("\n");

  return cardObject;
}

function parseSagaAbilities(text) {
  const stepsMap = {};

  // Remove reminder text
  const abilityText = text.replace(/^\(.*?\)\s*/, '');

  // Match "I — ability" or "I, II — ability"
  const regex = /([IVX, ]+)\s+—\s+([^]+?)(?=(?:\n[IVX, ]+\s+—|$))/g;

  let match;
  while ((match = regex.exec(abilityText)) !== null) {
    const stepsRaw = match[1].split(',').map(s => s.trim());
    const ability = match[2].trim();

    for (const step of stepsRaw) {
      stepsMap[step] = ability;
    }
  }

  // Lore step order
  const loreOrder = Array.from({ length: 24 }, (_, i) => romanNumeral(i + 1));

  // Track deduplicated abilities in order with count of steps
  const abilityMap = new Map();

  for (const step of loreOrder) {
    const ability = stepsMap[step];
    if (!ability) continue;

    if (abilityMap.has(ability)) {
      abilityMap.get(ability).steps += 1;
    } else {
      abilityMap.set(ability, { ability, steps: 1 });
    }
  }

  return Array.from(abilityMap.values());
}

function extractSagaReminderText(text) {
  const match = text.match(/^\([^)]*\)/);
  return match ? match[0] : null;
}

function parseClassAbilities(text) {
    const lines = text.split('\n'); // Split text into lines
    const abilities = [];
    let reminderText = '';
    let currentLevel = 1;

    // Check if the first line is reminder text
    if (lines[0].startsWith('(')) {
            reminderText = lines.shift(); // Extract reminder text
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for "{cost}: Level X" format
            const levelMatch = line.match(/^(\{.*?\}):\s*Level \d+/); // Match cost and level
            if (levelMatch) {
                    const cost = `${levelMatch[1]}:`; // Extract cost (e.g., "{G}")
                    const ability = lines[i + 1]?.trim() || ''; // Get the next line as ability text
                    abilities.push({ cost, ability });
                    i++; // Skip the next line since it's already processed
                    currentLevel++;
            } else if (abilities.length === 0) {
                    // Handle the first level's ability text without "Level" heading
                    abilities.push({ cost: '', ability: line });
            }
    }

    // Prepend reminder text to the first ability if it exists
    if (reminderText && abilities.length > 0) {
            abilities[0].ability = `${reminderText}{lns}{bar}{lns}${abilities[0].ability}`;
    }

    return abilities;
}

function parseMultiFacedCards(card) {
    let [frontFace, backFace] = card.card_faces ?? []
    
    if (card.object === "card_face") {
        // Battle cards: find faces from scryfallCard array
        frontFace = card;
        backFace = scryfallCard.find(face => 
            face.object === "card_face" && 
            face.name !== card.name
        );
    }
    
    if (!frontFace || !backFace) {
        console.error('Could not find both faces for multi-faced card');
        return null;
    }
    
    // Single processing logic for both types
    const faces = {
        front: {
            name: frontFace.name || '',
            type: frontFace.type_line || '',
            rules: frontFace.oracle_text || '',
            mana: frontFace.mana_cost || '',
            pt: frontFace.power ? `${frontFace.power}/${frontFace.toughness}` : '',
            defense: frontFace.defense || '',
            flavor: frontFace.flavor_text || ''
        },
        back: {
            name: backFace.name || '',
            type: backFace.type_line || '',
            rules: backFace.oracle_text || '',
            mana: backFace.mana_cost || '',
            pt: backFace.power ? `${backFace.power}/${backFace.toughness}` : '',
            defense: backFace.defense || '',
            flavor: backFace.flavor_text || ''
        }
    };
    
    return faces;
}

function parseLevelerCard(card) {
    if (card.layout !== 'leveler' || !card.oracle_text) {
        console.error('Not a valid leveler card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Parse the oracle text sections
    const sections = oracleText.split('\n');
    
    // Find level up cost (first line)
    const levelUpMatch = sections[0].match(/Level up (.+?) \((.+?)\)/);
    const levelUpCost = levelUpMatch ? levelUpMatch[1] : '';
    const levelUpReminder = levelUpMatch ? levelUpMatch[2] : '';
    
    // Find level ranges and their content
    const levelSections = [];
    let currentSection = null;
    
    for (let i = 1; i < sections.length; i++) {
        const line = sections[i];
        
        // Check if this line defines a level range
        const levelMatch = line.match(/^LEVEL (.+)$/);
        if (levelMatch) {
            if (currentSection) {
                levelSections.push(currentSection);
            }
            currentSection = {
                levelRange: levelMatch[1],
                content: []
            };
        } else if (currentSection && line.trim()) {
            currentSection.content.push(line);
        }
    }
    
    // Add the last section if it exists
    if (currentSection) {
        levelSections.push(currentSection);
    }
    
    // Extract data for each level
    const parsedData = {
        layout: 'leveler', // Add this line for consistency
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        levelUpCost: levelUpCost,
        levelUpText: `Level up ${levelUpCost} {i}(${levelUpReminder}){/i}`,
        levels: []
    };
    
    // Process each level section
    levelSections.forEach(section => {
        const levelData = {
            range: section.levelRange,
            pt: '',
            abilities: []
        };
        
        // Look for P/T in the content (usually looks like "2/3")
        const ptMatch = section.content.find(line => /^\d+\/\d+$/.test(line.trim()));
        if (ptMatch) {
            levelData.pt = ptMatch.trim();
            // Remove P/T from abilities
            levelData.abilities = section.content.filter(line => line.trim() !== ptMatch.trim());
        } else {
            levelData.abilities = section.content;
        }
        
        // Join abilities into a single text block
        levelData.rulesText = levelData.abilities.join('\n');
        
        parsedData.levels.push(levelData);
    });
    
    return parsedData;
}

function parsePrototypeLayout(card) {
    if (card.layout !== 'prototype' || !card.oracle_text) {
        console.error('Not a valid prototype card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Match the entire prototype line: "Prototype {1}{U}{U} — 2/1 (reminder text)"
    const prototypeMatch = oracleText.match(/^Prototype (.+?) — (\d+)\/(\d+) \((.+?)\)/);
    
    if (!prototypeMatch) {
        console.error('Could not parse prototype information');
        return null;
    }
    
    const prototypeCost = prototypeMatch[1];
    const prototypePower = prototypeMatch[2];
    const prototypeToughness = prototypeMatch[3];
    const prototypeReminder = prototypeMatch[4];
    
    // Split by newlines and remove the first line (which contains the prototype)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();
    
    return {
        layout: 'prototype',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        prototype: {
            cost: prototypeCost,
            pt: `${prototypePower}/${prototypeToughness}`,
            reminderText: `Prototype ${prototypeCost} — ${prototypePower}/${prototypeToughness} {i}(${prototypeReminder}){/i}`
        }
    };
}

function parseMutateLayout(card) {
    if (card.layout !== 'mutate' || !card.oracle_text) {
        console.error('Not a valid mutate card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Match the mutate line: "Mutate {3}{B} (reminder text)"
    const mutateMatch = oracleText.match(/^Mutate (.+?) \((.+?)\)/);
    
    if (!mutateMatch) {
        console.error('Could not parse mutate information');
        return null;
    }
    
    const mutateCost = mutateMatch[1];
    const mutateReminder = mutateMatch[2];
    
    // Split by newlines and remove the first line (which contains the mutate)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();
    
    return {
        layout: 'mutate',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        mutate: {
            cost: mutateCost,
            reminderText: `Mutate ${mutateCost} {i}(${mutateReminder}){/i}`
        }
    };
}

function parseVanguardLayout(card) {
    if (card.layout !== 'vanguard' || !card.oracle_text) {
        console.error('Not a valid vanguard card');
        return null;
    }

    return {
        layout: 'vanguard',
        name: card.name || '',
        type: card.type_line || '',
        rules: card.oracle_text || '',
        flavor: card.flavor_text || '',
        handModifier: card.hand_modifier || '',
        lifeModifier: card.life_modifier || ''
    };
}

function parseRollAbilities(text) {
    // Check if this is a roll card
    if (!text.toLowerCase().includes('roll a d20')) {
        return null;
    }

    let modifiedText = text;
    const lines = text.split('\n');
    
    // Skip the first line ("Roll a d20.")
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Match patterns like "1—9 | ability" or "20 | ability"
        const rollMatch = line.match(/^(\d+(?:—\d+)?)\s*\|\s*(.+)$/);
        if (rollMatch) {
            const range = rollMatch[1];
            const ability = rollMatch[2];
            
            // Replace the line with the roll tag format
            const newLine = `{roll${range}} ${ability}`;
            modifiedText = modifiedText.replace(line, newLine);
        }
    }
    
    return modifiedText;
}

function parseStationCard(oracleText) {
    if (!oracleText || !oracleText.includes('Station')) {
        return null;
    }

    // Split the oracle text by STATION markers to get the pre-station text
    const parts = oracleText.split(/STATION \d+\+/);
    
    // The first part is the pre-station text (before any STATION abilities)
    let preStationText = parts[0].trim();
    
    // Format station reminder text with italics
    preStationText = preStationText.replace(/Station (\([^)]+\))/g, 'Station {i}$1{/i}');
    
    // Updated regex to match new scryfall format: "10+ | ability text"
    const stationRegex = /(\d+\+)\s*\|\s*([^\n]+)/g;
    const stationAbilities = [];
    
    let match;
    while ((match = stationRegex.exec(oracleText)) !== null) {
        stationAbilities.push({
            number: match[1], // e.g., "1+", "8+"
            text: match[2].trim()
        });
    }

    return {
        preStationText: preStationText,
        stationAbilities: stationAbilities
    };
}

function changeCardIndex(cardOverride, importOptions = {}) {
	let cardToImport = cardOverride || scryfallCard[document.querySelector('#import-index').value];
	const preserveSetOwned = Boolean(importOptions.preserveSetOwned);
	// Add debug logging for card Layout detection
	console.log('Card layout:', cardToImport.layout);
	console.log('Card version:', card.version);

	if (cardToImport.set == "plst") {
		var components = cardToImport.collector_number.split('-');
		cardToImport.set = components[0];
		cardToImport.collector_number = components[1];
	}
	// Clear all existing text fields to prevent old data from persisting BUT preserve Multi Face reminder text if we're using a Multi Face frame
	var savedFuseReminderText = '';
	var savedDescriptiveTexts = {};
	if (card.text && card.text.reminder && card.version === 'fuse' || card.version === 'room') {
		savedFuseReminderText = card.text.reminder.text;
	}
	// Save descriptive texts for vanguard
	if (card.text) {
		// Save static descriptive texts that shouldn't be overwritten
		const descriptiveFields = ['left', 'right'];
		descriptiveFields.forEach(field => {
			if (card.text[field] && card.text[field].text) {
				savedDescriptiveTexts[field] = card.text[field].text;
			}
		});
	
		// Clear all text fields
		Object.keys(card.text).forEach(key => {
			card.text[key].text = '';
		});
		
		// Restore descriptive texts
		Object.keys(savedDescriptiveTexts).forEach(field => {
			if (card.text[field]) {
				card.text[field].text = savedDescriptiveTexts[field];
			}
		});
	}

	// Update reminder text from imported card if available
	var importedReminderText = '';
	if (cardToImport.oracle_text) {
		// Extract reminder text from oracle text (text in parentheses)
		var reminderMatch = cardToImport.oracle_text.match(/\([^)]+\)/);
		if (reminderMatch) {
			importedReminderText = reminderMatch[0];
		}
	}

	// Restore reminder text: use imported if available, otherwise use saved
	if (card.text && card.text.reminder && (card.version === 'fuse' || card.version === 'room')) {
		card.text.reminder.text = importedReminderText || savedFuseReminderText;
	}
		
	//text
	var langFontCode = "";
	if (cardToImport.lang == "ph") {langFontCode = "{fontphyrexian}"}
	// Handle Multi Faced Card Layouts
	const multiFacedVersions = ['flip', 'split', 'fuse', 'aftermath', 'adventure', 'omen', 'room', 'battle', 'transform', 'modal', 'prepare'];
	const isMultiFacedVersion = multiFacedVersions.some(keyword => card.version.toLowerCase().includes(keyword));
	if (['flip', 'modal_dfc', 'transform', 'split', 'adventure', 'omen', 'prepare'].includes(cardToImport.layout) && isMultiFacedVersion) {
		const flipData = parseMultiFacedCards(cardToImport);
		if (!flipData) {
			console.error('Failed to parse Multi Faced card data');
			return;
		}
	
		// Add artist info
		if (cardToImport.artist) {
			artistEdited(cardToImport.artist);
		}
	
		// Handle art loading 
		if (cardToImport.image_uris?.art_crop) {
			uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
		}
	
		// Handle set symbol
		if (!preserveSetOwned && !document.querySelector('#lockSetSymbolCode').checked) {
			document.querySelector('#set-symbol-code').value = cardToImport.set;
			document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
			if (!document.querySelector('#lockSetSymbolURL').checked) {
			fetchSetSymbol();
			}
		}
	
		// Multi Faced card handling
		// Update text fields based on card version
		//Front Face (standard handling for all multi-faced cards)
		if (card.text?.title && card.text?.mana) {
			card.text.title.text = langFontCode + flipData.front.name;
			card.text.type.text = langFontCode + flipData.front.type; 
			card.text.rules.text = langFontCode + flipData.front.rules;
			if (flipData.front.flavor) {
				card.text.rules.text += '{flavor}' + curlyQuotes(flipData.front.flavor.replace('\n', '{lns}'));
			}
			card.text.mana.text = flipData.front.mana || '';
			
			// Handle PT vs Defense based on card version
			if (card.version === 'battle') {
				// For battles, only the defense field is unique
				if (card.text.defense) {
					card.text.defense.text = flipData.front.defense || '';
				}
			} else {
				// For other multi-faced cards, use standard PT
				if (card.text.pt) {
					card.text.pt.text = flipData.front.pt || '';
				}
			}
		}

		// Handle MDFC cards separately (they use flipsideType and flipSideReminder)
		if (cardToImport.layout === 'modal_dfc' && card.text?.flipsideType && card.text?.flipSideReminder) {
			card.text.flipsideType.text = langFontCode + flipData.back.type;
			card.text.flipSideReminder.text = langFontCode + flipData.back.rules;
		}
		//Back Face (standard handling for other multi-faced cards)
		else if (card.text?.title2 && card.text?.mana2) {
			card.text.title2.text = langFontCode + flipData.back.name;
			// Skip importing back type for room cards AND battle cards
			if (!cardToImport.type_line?.toLowerCase().includes('room')) {
				card.text.type2.text = langFontCode + flipData.back.type;
			}
			card.text.rules2.text = langFontCode + flipData.back.rules;
			if (flipData.back.flavor) {
				card.text.rules2.text += '{flavor}' + curlyQuotes(flipData.back.flavor.replace('\n', '{lns}'));
			}
			card.text.mana2.text = flipData.back.mana || '';
			if (card.text.pt2) {
				card.text.pt2.text = flipData.back.pt || '';
			}
		}
		
		// Handle pt2 for battle and transform front faces (cards without title2/mana2)
		if ((card.version === 'battle' || card.version.includes('transform') || card.version.includes('Transform')) && card.text?.pt2) {
			card.text.pt2.text = flipData.back.pt || '';
		}

		if ((card.version.includes('transform') || card.version.includes('Transform')) && card.text?.reminder && flipData.back.pt) {
			card.text.reminder.text = flipData.back.pt;
		}
	
		textEdited();
	}

	// Handle Unique Layouts (Leveler, Prototype, Mutate, and Vanguard)
	else if (['leveler', 'prototype', 'mutate', 'vanguard'].includes(cardToImport.layout) && ['leveler', 'prototype', 'mutate', 'vanguard'].includes(card.version)) {
		let uniqueData;
		
		if (cardToImport.layout === 'leveler') {
			uniqueData = parseLevelerCard(cardToImport);
		} else if (cardToImport.layout === 'prototype') {
			uniqueData = parsePrototypeLayout(cardToImport);
		} else if (cardToImport.layout === 'mutate') {
			uniqueData = parseMutateLayout(cardToImport);
		} else if (cardToImport.layout === 'vanguard') {
			uniqueData = parseVanguardLayout(cardToImport);
		}

		// Add artist info
		if (cardToImport.artist) {
			artistEdited(cardToImport.artist);
		}

		// Handle art loading 
		if (cardToImport.image_uris?.art_crop) {
			uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
		}

		// Handle set symbol
		if (!document.querySelector('#lockSetSymbolCode').checked) {
			document.querySelector('#set-symbol-code').value = cardToImport.set;
			document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
			if (!document.querySelector('#lockSetSymbolURL').checked) {
				fetchSetSymbol();
			}
		}

		// Populate text fields based on layout
		if (card.text?.title) {
			card.text.title.text = langFontCode + uniqueData.name;
			card.text.type.text = langFontCode + uniqueData.type;
			card.text.mana.text = uniqueData.mana;
			
			// Base P/T
			if (card.text.pt) {
				card.text.pt.text = uniqueData.basePT;
			}
			
			if (uniqueData.layout === 'leveler') {
				card.text.levelup.text = langFontCode + uniqueData.levelUpText;
				
				// Level 1-2 data
				if (uniqueData.levels[0]) {
					const level1Data = uniqueData.levels[0];
					if (card.text.level2) {
						card.text.level2.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level1Data.range}`;
					}
					if (card.text.rules2) {
						card.text.rules2.text = langFontCode + level1Data.rulesText;
					}
					if (card.text.pt2) {
						card.text.pt2.text = level1Data.pt;
					}
				}
				
				// Level 3+ data
				if (uniqueData.levels[1]) {
					const level2Data = uniqueData.levels[1];
					if (card.text.level3) {
						card.text.level3.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level2Data.range}`;
					}
					if (card.text.rules3) {
						card.text.rules3.text = langFontCode + level2Data.rulesText;
					}
					if (card.text.pt3) {
						card.text.pt3.text = level2Data.pt;
					}
				}
			} else if (uniqueData.layout === 'prototype') {
				if (card.text.rules2) {
					card.text.rules2.text = langFontCode + uniqueData.rules;
				}
				if (card.text.prototype) {
					card.text.prototype.text = langFontCode + uniqueData.prototype.reminderText;
				}
				if (card.text.mana2) {
					card.text.mana2.text = uniqueData.prototype.cost;
				}
				if (card.text.pt2) {
					card.text.pt2.text = uniqueData.prototype.pt;
				}
			} else if (uniqueData.layout === 'mutate') {
				if (card.text.rules2) {
					card.text.rules2.text = langFontCode + uniqueData.rules;
				}
				if (card.text.mutate) {
					card.text.mutate.text = langFontCode + uniqueData.mutate.reminderText;
				}
			} else if (uniqueData.layout === 'vanguard') {
				if (card.text.ability) {
					card.text.ability.text = langFontCode + uniqueData.rules;
				}
				if (card.text.flavor) {
					card.text.flavor.text = langFontCode + uniqueData.flavor;
				}
				if (card.text.leftval) {
					card.text.leftval.text = uniqueData.handModifier;
				}
				if (card.text.rightval) {
					card.text.rightval.text = uniqueData.lifeModifier;
				}
			}
		}

		textEdited();
	}

else if (cardToImport.oracle_text && cardToImport.oracle_text.includes('Station') && card.version.includes('station')) {

	// Clear existing station fields
	if (card.text) {
		['ability0', 'ability1', 'ability2'].forEach(field => {
			if (card.text[field]) card.text[field].text = '';
		});
	}
	
	// Clear station badge values immediately
	if (card.station?.badgeValues) {
		card.station.badgeValues[1] = '';
		card.station.badgeValues[2] = '';
	}
	
	const stationData = parseStationCard(cardToImport.oracle_text);
	const name = (cardToImport.printed_name || cardToImport.name || '').replace(/^A-/, '{alchemy}');

	// Populate basic text fields
	const basicFields = [
		['title', curlyQuotes(name)],
		['type', cardToImport.type_line],
		['mana', cardToImport.mana_cost || ''],
		['pt', cardToImport.power && cardToImport.toughness ? `${cardToImport.power}/${cardToImport.toughness}` : '']
	];
	
	basicFields.forEach(([field, value]) => {
		if (card.text?.[field]) card.text[field].text = langFontCode + value;
	});
	
	// Station ability placement logic
	if (stationData) {
		// Better regex to separate pre-text from Station reminder text
		let preText = '';
		let reminderText = '';
		
		if (stationData.preStationText) {
			// Look for Station reminder text (either already italicized or not)
			const stationReminderMatch = stationData.preStationText.match(/(.*?)(Station \{i\}\([^)]+\)\{\/i\}|Station \([^)]+\))/s);
			
			if (stationReminderMatch) {
				preText = stationReminderMatch[1].trim();
				
				// Format the reminder text with italics if not already done
				if (stationReminderMatch[2].includes('{i}')) {
					reminderText = stationReminderMatch[2];
				} else {
					reminderText = stationReminderMatch[2].replace(/Station (\([^)]+\))/, 'Station {i}$1{/i}');
				}
			} else {
				// If no Station reminder found, treat entire text as pre-text
				preText = stationData.preStationText.trim();
			}
		}
		
		const numAbilities = stationData.stationAbilities.length;
		
		// AUTO-CHECK DISABLE FIRST SQUARE FOR SINGLE ABILITIES
		const shouldDisableFirstSquare = numAbilities === 1;
		
		// Define placement scenarios as configuration
		const scenarios = {
			// [hasPreText, numAbilities]: [ability0, ability1, ability2, badgeSlots]
			[false + ',' + 1]: ['', reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
			[true + ',' + 1]: [preText, reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
			[false + ',' + 2]: [reminderText, stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]],
			[true + ',' + 2]: [preText + (reminderText ? '\n' + reminderText : ''), stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]]
		};
		
		const scenario = scenarios[Boolean(preText) + ',' + numAbilities];
		if (scenario) {
			const [ability0, ability1, ability2, badges] = scenario;
			
			// Set abilities
			[ability0, ability1, ability2].forEach((text, i) => {
				if (text && card.text[`ability${i}`]) {
					card.text[`ability${i}`].text = langFontCode + text;
				}
			});
			
			// Set disable first square checkbox and station setting
			setTimeout(() => {
				const disableCheckbox = document.querySelector('#station-disable-first-ability');
				if (disableCheckbox) {
					disableCheckbox.checked = shouldDisableFirstSquare;
				}
				if (card.station) {
					card.station.disableFirstAbility = shouldDisableFirstSquare;
				}
				
				// SET STATION-SPECIFIC UI VALUES FOR SINGLE ABILITY IMPORTS
				if (shouldDisableFirstSquare && !Boolean(preText) && card.station?.importSettings?.singleAbility) {
					// Get version-specific settings or fall back to default
					const versionOverrides = card.station.importSettings.versionOverrides || {};
					const versionSettings = versionOverrides[card.version] || card.station.importSettings.singleAbility;
					
					// Set Y offset
					const yOffsetInput = document.querySelector('#station-square-y');
					if (yOffsetInput) {
						yOffsetInput.value = versionSettings.yOffset;
						if (card.station.squares && card.station.squares[1]) {
							card.station.squares[1].y = versionSettings.yOffset + 76;
						}
					}
					
					// Set first square height
					const height1Input = document.querySelector('#station-square-height-1');
					if (height1Input) {
						height1Input.value = versionSettings.height1;
						if (card.station.squares && card.station.squares[1]) {
							card.station.squares[1].height = versionSettings.height1;
						}
					}
				}
		
				
				// Clear DOM inputs first
				['#station-badge-value-1', '#station-badge-value-2'].forEach(selector => {
					const input = document.querySelector(selector);
					if (input) input.value = '';
				});
				
				// Set new badge values
				badges.forEach((badge, i) => {
					if (badge) {
						const input = document.querySelector(`#station-badge-value-${i + 1}`);
						if (input) input.value = badge;
						if (card.station?.badgeValues) card.station.badgeValues[i + 1] = badge;
					}
				});
				
				// Force station redraw after all values are set
				setTimeout(() => {
					if (typeof stationEdited === 'function') {
						stationEdited();
					}
				}, 50);
			}, 100);
		}
	}
	
	textEdited();
}

	var name = cardToImport.printed_name || cardToImport.name || '';
	if (name.startsWith('A-')) { name = name.replace('A-', '{alchemy}'); }

	if (card.text.title) {
		if (card.version == 'wanted') {
			var subtitle = '';
			var index = name.indexOf(', ');

			if (index > 0) {
			  card.text.subtitle.text = langFontCode + curlyQuotes(name.substring(index+2));
			  card.text.title.text = langFontCode + curlyQuotes(name.substring(0, index+1));
			} else {
				card.text.title.text = langFontCode + curlyQuotes(name);
				card.text.subtitle.text = '';
			}
		} else {
			card.text.title.text = langFontCode + curlyQuotes(name);
		}
	}

	if (card.text.nickname) {card.text.nickname.text = cardToImport.flavor_name || '';}
	if (card.text.mana) {card.text.mana.text = cardToImport.mana_cost || '';}
	if (card.text.type) {card.text.type.text = langFontCode + cardToImport.type_line || '';}

	var italicExemptions = ['Boast', 'Cycling', 'Visit', 'Prize', 'I', 'II', 'III', 'IV', 'I, II', 'II, III', 'III, IV', 'I, II, III', 'II, III, IV', 'I, II, III, IV', '• Khans', '• Dragons', '• Mirran', '• Phyrexian', 'Prototype', 'Companion', 'To solve', 'Solved'];
	var italicExemptions = ['Boast', 'Cycling', 'Visit', 'Prize', 'I', 'II', 'III', 'IV', 'I, II', 'II, III', 'III, IV', 'I, II, III', 'II, III, IV', 'I, II, III, IV', '• Khans', '• Dragons', '• Mirran', '• Phyrexian', 'Prototype', 'Companion', 'To solve', 'Solved'];
	if (cardToImport.oracle_text) {
		const hasRoll = cardToImport.oracle_text.toLowerCase().includes('roll a d20');		
		const hasNumberedAbilities = /\d+(?:—\d+)?\s*\|\s*.+/.test(cardToImport.oracle_text);		
		const rollText = parseRollAbilities(cardToImport.oracle_text);
		if (rollText) {
			// Use the modified text with roll tags for further processing
			var rulesText = rollText.replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function(a){
				if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {return a;}
				return '{i}' + a + '{/i}';
			});
		} else {
			// Regular processing for non-roll cards
			var rulesText = (cardToImport.oracle_text || '').replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function(a){
				if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {return a;}
				return '{i}' + a + '{/i}';
			});
		}
		// Handle loyalty ability brackets - separate from roll handling, applies to ALL cards
		const isCleaveSpell = rulesText.toLowerCase().includes('cleave') || 
							 (cardToImport.keywords && cardToImport.keywords.includes('Cleave'));
		
		if (!isCleaveSpell) {
		// Replace loyalty ability brackets [+1], [-2], etc. with curly brackets
		// Also convert em dash (−) to regular hyphen (-)
		rulesText = rulesText.replace(/\[([+\-−]\d+)\]/g, function(match, number) {
			return '{' + number.replace('\u2212', '-') + '}';
		});
	}
	} else {
		var rulesText = '';
	}
	rulesText = curlyQuotes(rulesText).replace(/{Q}/g, '{untap}').replace(/{\u221E}/g, "{inf}").replace(/• /g, '• {indent}');
	rulesText = rulesText.replace('(If this card is your chosen companion, you may put it into your hand from outside the game for {3} any time you could cast a sorcery.)', '(If this card is your chosen companion, you may put it into your hand from outside the game for {3} as a sorcery.)')

	if (card.text.rules) {
		if (card.version == 'pokemon') {
			if (cardToImport.type_line.toLowerCase().includes('creature')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.middleStatTitle.text = 'power';
				card.text.rightStatTitle.text = 'toughness';

			} else if (cardToImport.type_line.toLowerCase().includes('planeswalker')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.pt.text = '{' + (cardToImport.loyalty || '' + '}');

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = 'loyalty';
			} else if (cardToImport.type_line.toLowerCase().includes('battle')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.pt.text = '{' + (cardToImport.defense || '' + '}');

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = 'defense';
			} else {
				card.text.rulesnoncreature.text = langFontCode + rulesText;
				card.text.rules.text = '';

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = '';
			}

		} else {
			card.text.rules.text = langFontCode + rulesText;
		}

		if (cardToImport.flavor_text) {
			var flavorText = cardToImport.flavor_text;
			var flavorTextCounter = 1;
			while (flavorText.includes('*') || flavorText.includes('"')) {
				if (flavorTextCounter % 2) {
					flavorText = flavorText.replace('*', '{/i}');
					flavorText = flavorText.replace('"', '\u201c');
				} else {
					flavorText = flavorText.replace('*', '{i}');
					flavorText = flavorText.replace('"', '\u201d');
				}
				flavorTextCounter ++;
			}

			if (card.version == 'pokemon') {
				if (cardToImport.type_line.toLowerCase().includes('creature')) {
					card.text.rules.text += '{flavor}';
					card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
				} else {
					card.text.rules.text += '{flavor}';
					card.text.rulesnoncreature.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
				}

			} else {
				card.text.rules.text += '{flavor}';
				card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
			}


		}
	} else if (card.text.case) {
		rulesText = rulesText.replace(/(\r\n|\r|\n)/g, '//{bar}//');
		card.text.case.text = langFontCode + rulesText;
	}

	if (card.text.pt) {
		if (card.version == 'invocation') {
			card.text.pt.text = cardToImport.power + '\n' + cardToImport.toughness || '';
		} else if (card.version == 'pokemon') {
			card.text.middleStat.text = '{' + (cardToImport.power || '') + '}';
			card.text.pt.text = '{' + (cardToImport.toughness || '') + '}';

			if (card.text.middleStat && card.text.middleStat.text == '{}') {card.text.middleStat.text = '';}
		} else {
			card.text.pt.text = cardToImport.power + '/' + cardToImport.toughness || '';
		}
	}
	if (card.text.pt && card.text.pt.text == undefined + '/' + undefined) {card.text.pt.text = '';}
	if (card.text.pt && card.text.pt.text == undefined + '\n' + undefined) {card.text.pt.text = '';}
	if (card.text.pt && card.text.pt.text == '{}') {card.text.pt.text = '';}
	if (card.version.includes('planeswalker')) {
		card.text.loyalty.text = cardToImport.loyalty || '';
		var planeswalkerAbilities = cardToImport.oracle_text.split('\n');
		// Replace loyalty ability brackets [+1], [-2], etc. with curly brackets for each ability
		planeswalkerAbilities = planeswalkerAbilities.map(ability => {
			return ability.replace(/\[([+\-−]\d+)\]/g, function(match, number) {
				return '{' + number.replace('\u2212', '-') + '}';
			});
		});
		while (planeswalkerAbilities.length > 4) {
			var newAbility = planeswalkerAbilities[planeswalkerAbilities.length - 2] + '\n' + planeswalkerAbilities.pop();
			planeswalkerAbilities[planeswalkerAbilities.length - 1] = newAbility;
		}
		for (var i = 0; i < 4; i ++) {
			if (planeswalkerAbilities[i]) {
				var planeswalkerAbility = planeswalkerAbilities[i].replace(': ', 'splitstring').split('splitstring');
				if (!planeswalkerAbility[1]) {
					planeswalkerAbility = ['', planeswalkerAbility[0]];
				}
				card.text['ability' + i].text = planeswalkerAbility[1].replace('(', '{i}(').replace(')', '){/i}');
				if (card.version == 'planeswalkerTall' || card.version == 'planeswalkerCompleated') {
					document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.3572) / planeswalkerAbilities.length);
				} else {
					document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.2915) / planeswalkerAbilities.length);
				}
				document.querySelector('#planeswalker-cost-' + i).value = planeswalkerAbility[0].replace('\u2212', '-');
			} else {
				card.text['ability' + i].text = '';
				document.querySelector('#planeswalker-height-' + i).value = 0;
			}
		}
		planeswalkerEdited();
	} else if (card.version.includes('saga')) {
		if (card.text.rules2) {
			const combinedText = [cardToImport.flavor_text, ...(cardToImport.keywords || [])]
				.filter(Boolean)
				.join('\n');
			card.text.rules2.text = combinedText;
		}
		const abilities = parseSagaAbilities(cardToImport.oracle_text);
		for (let i = 0; i < abilities.length; i++) {
			card.text[`ability${i}`].text = abilities[i].ability.replace('(', '{i}(').replace(')', '){/i}');
		}
		card.text.reminder.text = `{i}${extractSagaReminderText(cardToImport.oracle_text)}{/i}`;
		card.saga = {...card.saga, abilities: abilities.map(a => a.steps).concat(Array.from({ length: 4 - abilities.length}, () => 0)), count: abilities.length};
		updateAbilityHeights()
	} else if (card.version.toLowerCase().includes('class') && !card.version.includes('classicshifted') && typeof classCanvas !== "undefined") {
		if (card.text.flavor) {
			// future support classes with flavor text
			card.text.flavor.text = cardToImport.flavor_text || '';
		}
		const abilities = parseClassAbilities(cardToImport.oracle_text);
		for (let i = 0; i < abilities.length; i++) {
			const { cost, ability } = abilities[i];
			if (cost) {
				card.text[`level${i}a`].text = abilities[i].cost.replace('\u2212', '-');
			}
			if (i !== 0) {
				card.text[`level${i}b`].text = `Level ${i + 1}`;
			}
			card.text[`level${i}c`].text = ability.replace('(', '{i}(').replace(')', '){/i}');
		}
		card.class = {...card.class, abilities: abilities.map(a => a.cost).concat(Array.from({ length: 4 - abilities.length}, () => '')), count: abilities.length};
	} else if (card.version.includes('battle')) {
		card.text.defense.text = cardToImport.defense || '';
	}
	//font size
	Object.keys(card.text).forEach(key => {
			card.text[key].fontSize = 0;
		});
	textEdited();
	//collector's info
	if (!preserveSetOwned && localStorage.getItem('enableImportCollectorInfo') == 'true') {
		document.querySelector('#info-number').value = cardToImport.collector_number || "";
		document.querySelector('#info-rarity').value = (cardToImport.rarity || "")[0].toUpperCase();
		document.querySelector('#info-set').value = (cardToImport.set || "").toUpperCase();
		document.querySelector('#info-language').value = (cardToImport.lang || "").toUpperCase();
		var setXhttp = new XMLHttpRequest();
		setXhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				var setObject = JSON.parse(this.responseText)
				if (document.querySelector('#enableNewCollectorStyle').checked) {
					var number = document.querySelector('#info-number').value;

					while (number.length < 4) {
						number = '0' + number;
					}

					document.querySelector('#info-number').value = number;

					bottomInfoEdited();
				} else if (setObject.printed_size) {
					var number = document.querySelector('#info-number').value;

					while (number.length < 3) {
						number = '0' + number;
					}

					var printedSize = setObject.printed_size;
					while (printedSize.length < 3) {
						printedSize = '0' + printedSize;
					}

					if (parseInt(number) <= parseInt(printedSize)) {
						document.querySelector('#info-number').value = number + "/" + printedSize;
					} else {
						document.querySelector('#info-number').value = number;
					}


					bottomInfoEdited();
				}
			}
		}
		setXhttp.open('GET', "https://api.scryfall.com/sets/" + cardToImport.set, true);
		try {
			setXhttp.send();
		} catch {
			console.log('Scryfall API search failed.')
		}
	}
	//art
	document.querySelector('#art-name').value = cardToImport.name;
	if (importOptions.useExactArt && cardToImport.image_uris?.art_crop) {
		uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
		if (cardToImport.artist) artistEdited(cardToImport.artist);
	} else {
		fetchScryfallData(cardToImport.name, artFromScryfall, 'art');
		if (document.querySelector('#importAllPrints').checked) {
			document.querySelector('#art-index').value = document.querySelector('#import-index').value;
			changeArtIndex();
		}
	}
	//set symbol
	if (!preserveSetOwned) {
		if (!document.querySelector('#lockSetSymbolCode').checked) {
			document.querySelector('#set-symbol-code').value = cardToImport.set;
		}
		document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
		if (!document.querySelector('#lockSetSymbolURL').checked) {
			fetchSetSymbol();
		}
	}
}
function loadAvailableCards(cardKeys = JSON.parse(localStorage.getItem('cardKeys'))) {
	if (!cardKeys) {
		cardKeys = [];
		cardKeys.sort();
		localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
	}
	var select = document.querySelector('#load-card-options');
	if (!select) return;
	select.innerHTML = '<option selected="selected" disabled>None selected</option>';
	cardKeys.forEach(item => {
		var cardKeyOption = document.createElement('option');
		cardKeyOption.innerHTML = item;
		select.appendChild(cardKeyOption);
	});
}

function cardStorageSnapshot() {
	var cardToSave = JSON.parse(JSON.stringify(card));
	(cardToSave.frames || []).forEach(frame => {
		delete frame.image;
		(frame.masks || []).forEach(mask => delete mask.image);
	});
	return cardToSave;
}

function liveDraftUiSnapshot() {
	var autoFrameInput = document.querySelector('#autoFrame');
	return {
		activeFramePack: typeof activeFramePack === 'undefined' ? null : activeFramePack,
		activeFrameCustomizationPack: typeof activeFrameCustomizationPack === 'undefined' ? null : activeFrameCustomizationPack,
		activeFrameComponentOptions: typeof activeFrameComponentOptions === 'undefined' ? {} : activeFrameComponentOptions,
		automaticVariantPack: typeof automaticVariantPack === 'undefined' ? null : automaticVariantPack,
		autoFrameValue: autoFrameInput?.value || null,
		selectedFrameProfile: autoFrameInput?.dataset.profile || null
	};
}

function saveLiveDraftCard() {
	if (liveDraftResetInProgress || !card) return;
	if (window.CardConjurerSets && typeof window.CardConjurerSets.captureActiveCard === 'function') {
		window.CardConjurerSets.captureActiveCard('Edit card', 'card-edit');
		return;
	}
	try {
		var liveDraftSnapshot = cardStorageSnapshot();
		localStorage.setItem(liveDraftCardStorageKey, JSON.stringify(liveDraftSnapshot));
		localStorage.setItem(liveDraftUiStorageKey, JSON.stringify(liveDraftUiSnapshot()));
	} catch (error) {
		console.warn('The current card could not be preserved for live reload.', error);
	}
}

function queueLiveDraftSave(delay = 250) {
	if (window.CardConjurerSets && typeof window.CardConjurerSets.queueCapture === 'function') {
		window.CardConjurerSets.queueCapture(delay);
		return;
	}
	clearTimeout(liveDraftSaveTimer);
	liveDraftSaveTimer = setTimeout(saveLiveDraftCard, delay);
}

function applyLiveDraftUi(ui) {
	if (!ui) return false;
	var migratedDarkPowerToughness = ui.activeFrameCustomizationPack === 'M15DarkPT' || ui.selectedFrameProfile === 'M15DarkPT';
	var restoredFramePack = ui.activeFramePack || 'M15Regular-1';
	var selectedProfile = migratedDarkPowerToughness ? restoredFramePack : (ui.selectedFrameProfile || restoredFramePack);
	var autoFrameValue = migratedDarkPowerToughness && typeof FRAME_REGISTRY !== 'undefined'
		? (FRAME_REGISTRY.engine(selectedProfile) || selectedProfile)
		: (ui.autoFrameValue || (typeof FRAME_REGISTRY !== 'undefined' ? FRAME_REGISTRY.engine(selectedProfile) : null) || selectedProfile);
	if (typeof activeFramePack !== 'undefined') activeFramePack = restoredFramePack;
	if (typeof activeFrameCustomizationPack !== 'undefined') activeFrameCustomizationPack = migratedDarkPowerToughness ? null : (ui.activeFrameCustomizationPack || null);
	if (typeof activeFrameComponentOptions !== 'undefined') activeFrameComponentOptions = ui.activeFrameComponentOptions || {};
	if (migratedDarkPowerToughness && typeof activeFrameComponentOptions !== 'undefined') activeFrameComponentOptions['power-toughness-variant'] = {pack:'M15DarkPT', frame:null};
	if (typeof automaticVariantPack !== 'undefined') automaticVariantPack = ui.automaticVariantPack || null;
	var autoFrameInput = document.querySelector('#autoFrame');
	if (autoFrameInput) {
		autoFrameInput.value = autoFrameValue;
		autoFrameInput.dataset.profile = selectedProfile;
	}
	localStorage.setItem('autoFrame', autoFrameValue);
	localStorage.setItem('selectedFrameProfile', selectedProfile);
	if (typeof renderFrameCustomize === 'function') renderFrameCustomize(activeFramePack);
	document.querySelectorAll('.frame-catalog-item').forEach(item => {
		var selected = item.dataset.pack === activeFramePack;
		item.classList.toggle('selected', selected);
		item.setAttribute('aria-pressed', selected ? 'true' : 'false');
	});
	return migratedDarkPowerToughness;
}

function liveDraftFrameIdentity(frame) {
	return [
		frame.frameCustomizeSlot || '', frame.frameCustomizePack || '',
		frame.frameComposedParentFor || '', frame.frameComposedParentProfile || '',
		frame.name || '', frame.src || '',
		(frame.masks || []).map(mask => mask.name || mask.src || '').join('|')
	].join('::');
}

function restoreLiveDraftLayout(savedCard) {
	if (!savedCard) return;
	Object.entries(savedCard.text || {}).forEach(([key, savedText]) => {
		if (card.text?.[key]) Object.assign(card.text[key], JSON.parse(JSON.stringify(savedText)));
	});
	['planeswalker', 'saga', 'class', 'station', 'dungeon', 'artBounds', 'setSymbolBounds', 'watermarkBounds'].forEach(key => {
		if (savedCard[key] != null) card[key] = JSON.parse(JSON.stringify(savedCard[key]));
	});

	const savedFramesByIdentity = new Map();
	(savedCard.frames || []).forEach(frame => {
		const identity = liveDraftFrameIdentity(frame);
		if (!savedFramesByIdentity.has(identity)) savedFramesByIdentity.set(identity, []);
		savedFramesByIdentity.get(identity).push(frame);
	});
	const editableFrameProperties = [
		'bounds', 'ogBounds', 'opacity', 'erase', 'preserveAlpha', 'colorOverlayCheck',
		'colorOverlay', 'hslHue', 'hslSaturation', 'hslLightness'
	];
	(card.frames || []).forEach(frame => {
		const savedFrame = savedFramesByIdentity.get(liveDraftFrameIdentity(frame))?.shift();
		if (!savedFrame) return;
		editableFrameProperties.forEach(property => {
			if (savedFrame[property] != null) frame[property] = JSON.parse(JSON.stringify(savedFrame[property]));
		});
	});
	if (typeof syncTextFieldValues === 'function') syncTextFieldValues();
	// Version renderers read their layout controls back into the card. Refresh
	// those controls from the restored model first so their next render cannot
	// replace custom bounds with the pack defaults.
	if (typeof fixPlaneswalkerInputs === 'function' && card.planeswalker) fixPlaneswalkerInputs();
}

async function restoreLiveDraftCard() {
	var savedCard = localStorage.getItem(liveDraftCardStorageKey);
	if (!savedCard) return;
	try {
		var savedCardObject = JSON.parse(savedCard);
		var savedUi = JSON.parse(localStorage.getItem(liveDraftUiStorageKey) || 'null');
		// The frame catalog loads and renders its default asynchronously during
		// startup. Restore only after that work is finished so Regular cannot
		// overwrite the saved frame a moment later.
		if (window.frameCatalogReadyPromise) await window.frameCatalogReadyPromise;
		applyLiveDraftUi(savedUi);
		await loadCard(liveDraftCardStorageKey);
		applyLiveDraftUi(savedUi);
		var restoredProfile = savedUi?.activeFrameCustomizationPack || savedUi?.selectedFrameProfile;
		var restoredDetails = typeof FRAME_REGISTRY === 'undefined' ? null : FRAME_REGISTRY.definition(restoredProfile)?.details;
		var requiredComposedParent = typeof restoredDetails?.composeParent === 'string'
			? restoredDetails.composeParent
			: (restoredDetails?.composeParent?.profile || restoredDetails?.parent);
		var requiredComposedMasks = Array.isArray(restoredDetails?.composeParent?.masks)
			? restoredDetails.composeParent.masks
			: [];
		var composedParentFrames = (card.frames || []).filter(frame => frame.frameComposedParentFor === restoredProfile);
		var missingComposedParent = restoredDetails?.composeParent &&
			(requiredComposedMasks.length
				? !requiredComposedMasks.every(maskName => composedParentFrames.some(frame =>
					frame.frameComposedParentProfile === requiredComposedParent &&
					(frame.frameComposedParentMasks || []).includes(maskName)))
				: !composedParentFrames.some(frame => frame.frameComposedParentProfile === requiredComposedParent));
		var obsoleteComposedParent = !restoredDetails?.composeParent && composedParentFrames.length > 0;
		var savedProfileReapplied = false;
		// Loading the serialized card restores its frame images, but version-specific
		// editor fields (Leveler levels, Saga chapters, Mutate cost, etc.) are created
		// by the pack layout script. Reapply the selected profile on every restore,
		// then copy the saved field values back into that freshly-created layout.
		if (restoredProfile && typeof applyFrameCustomization === 'function') {
			await applyFrameCustomization(restoredProfile);
			savedProfileReapplied = true;
		}
		if (!savedProfileReapplied && (missingComposedParent || obsoleteComposedParent)) {
			if (restoredProfile && typeof applyFrameCustomization === 'function') await applyFrameCustomization(restoredProfile);
			else if (typeof autoFrame === 'function') await autoFrame();
		}
		if (savedProfileReapplied) {
			restoreLiveDraftLayout(savedCardObject);
			await renderLoadedCard(false);
		}
	} catch (error) {
		console.warn('The live-reload card draft could not be restored.', error);
		localStorage.removeItem(liveDraftCardStorageKey);
		localStorage.removeItem(liveDraftUiStorageKey);
	}
}

function resetLiveDraftCard() {
	if (window.CardConjurerSets && typeof window.CardConjurerSets.resetActiveCard === 'function') {
		window.CardConjurerSets.resetActiveCard();
		return;
	}
	if (!confirm('Reset the current card to the default card?')) return;
	liveDraftResetInProgress = true;
	localStorage.removeItem(liveDraftCardStorageKey);
	localStorage.removeItem(liveDraftUiStorageKey);
	location.reload();
}

if (!window.cardConjurerLiveDraftBound) {
	window.cardConjurerLiveDraftBound = true;
	window.addEventListener('beforeunload', saveLiveDraftCard);
}

function importChanged() {
	var unique = document.querySelector('#importAllPrints').checked ? 'prints' : '';
	fetchScryfallData(document.querySelector("#import-name").value, importCard, unique);
}
function saveCard(saveFromFile) {
	var cardKeys = JSON.parse(localStorage.getItem('cardKeys')) || [];
	var cardKey, cardToSave;
	if (saveFromFile) {
		cardKey = saveFromFile.key;
	} else {
		cardKey = getCardName();
	}
	if (!saveFromFile) {
		cardKey = prompt('Enter the name you would like to save your card under:', cardKey);
		if (!cardKey) {return null;}
	}
	cardKey = cardKey.trim();
	if (cardKeys.includes(cardKey)) {
		if (!confirm('Would you like to overwrite your card previously saved as "' + cardKey + '"?\n(Clicking "cancel" will affix a version number)')) {
			var originalCardKey = cardKey;
			var cardKeyNumber = 1;
			while (cardKeys.includes(cardKey)) {
				cardKey = originalCardKey + ' (' + cardKeyNumber + ')';
				cardKeyNumber ++;
			}
		}
	}
	if (saveFromFile) {
		cardToSave = saveFromFile.data;
	} else {
		cardToSave = cardStorageSnapshot();
	}
	try {
		localStorage.setItem(cardKey, JSON.stringify(cardToSave));
		if (!cardKeys.includes(cardKey)) {
			cardKeys.push(cardKey);
			cardKeys.sort();
			localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
			loadAvailableCards(cardKeys);
		}
	} catch (error) {
		notify('You have exceeded your 5MB of local storage, and your card has failed to save. If you would like to continue saving cards, please download all saved cards, then delete all saved cards to free up space.<br><br>Local storage is most often exceeded by uploading large images directly from your computer. If possible/convenient, using a URL avoids the need to save these large images.<br><br>Apologies for the inconvenience.');
	}
}
async function loadCardData(cardData, uiState) {
	clearCardSpecificTextTools();
	// Text carryover belongs to frame changes on one card, not switches between
	// cards. The incoming card will seed these caches with its own values.
	savedTextContents = {};
	savedTextFontSizes = {};
	layoutOwnedTextDefaults = {};
	//clear the draggable frames
	document.querySelector('#frame-list').innerHTML = null;
	//clear the existing card, then replace it with the new JSON
	card = {};
	card = JSON.parse(JSON.stringify(cardData || {}));
	if (card.infoUseStar == null) card.infoUseStar = collectorBottomInfoUsesStar(card.bottomInfo);
	var migratedDarkPowerToughness = uiState ? applyLiveDraftUi(uiState) : false;
	//if the card was loaded properly...
	if (card) {
		//load values from card into html inputs
		document.querySelector('#info-number').value = card.infoNumber;
		document.querySelector('#info-rarity').value = card.infoRarity;
		document.querySelector('#info-set').value = card.infoSet;
		document.querySelector('#info-language').value = card.infoLanguage;
		document.querySelector('#info-note').value = card.infoNote;
		document.querySelector('#info-year').value = card.infoYear || date.getFullYear();
		document.querySelector('#info-copyright').value = card.infoCopyright || '';
		document.querySelector('#copyrightFirstLineNoteStyle').checked = Boolean(card.infoCopyrightFirstLineNoteStyle);
		artistEdited(card.infoArtist);
		loadTextOptions(card.text);
		document.querySelector('#art-x').value = scaleX(card.artX) - scaleWidth(card.marginX);
		document.querySelector('#art-y').value = scaleY(card.artY) - scaleHeight(card.marginY);
		document.querySelector('#art-zoom').value = card.artZoom * 100;
		document.querySelector('#art-rotate').value = card.artRotate || 0;
		uploadArt(card.artSource);
		document.querySelector('#setSymbol-x').value = scaleX(card.setSymbolX) - scaleWidth(card.marginX);
		document.querySelector('#setSymbol-y').value = scaleY(card.setSymbolY) - scaleHeight(card.marginY);
		document.querySelector('#setSymbol-zoom').value = card.setSymbolZoom * 100;
		document.querySelector('#setSymbol-rotate').value = card.setSymbolRotate || 0;
		uploadSetSymbol(card.setSymbolSource);
		document.querySelector('#watermark-x').value = scaleX(card.watermarkX) - scaleWidth(card.marginX);
		document.querySelector('#watermark-y').value = scaleY(card.watermarkY) - scaleHeight(card.marginY);
		document.querySelector('#watermark-zoom').value = card.watermarkZoom * 100;
		card.watermarkColorMode = card.watermarkColorMode === 'manual' ? 'manual' : 'auto';
		card.watermarkLeft = card.watermarkLeft || 'none';
		card.watermarkRight = card.watermarkRight || 'none';
		updateWatermarkColorControls();
		syncAutomaticWatermarkColors();
		document.querySelector('#watermark-opacity').value = card.watermarkOpacity * 100;
		document.getElementById("rounded-corners").checked = !card.noCorners;
		uploadWatermark(card.watermarkSource, null, card.watermarkPresetSource);
		document.querySelector('#serial-number').value = card.serialNumber || '';
		document.querySelector('#serial-total').value = card.serialTotal || '';
		document.querySelector('#serial-x').value = card.serialX ?? 172;
		document.querySelector('#serial-y').value = card.serialY ?? 1383;
		document.querySelector('#serial-scale').value = card.serialScale ?? 1;
		syncCollectorStarControl();
		serialInfoEdited();

		var framesToLoad = (card.frames || []).slice().reverse();
		for (const item of framesToLoad) await addFrame([], item);
		if (card.onload) {
			await loadScript(card.onload);
		}
		await Promise.all((card.manaSymbols || []).map(item => loadScript(item)));
		applyCollectorStarStyle(Boolean(card.infoUseStar));
		syncCollectorStarControl();
		if (migratedDarkPowerToughness && typeof autoFrame === 'function') await autoFrame();
		//canvases
		var canvasesResized = false;
		canvasList.forEach(name => {
			if (window[name + 'Canvas'].width != card.width * (1 + card.marginX) || window[name + 'Canvas'].height != card.height * (1 + card.marginY)) {
				sizeCanvas(name);
				canvasesResized = true;
			}
		});
		await renderLoadedCard(canvasesResized);
	} else {
		notify('The selected card failed to load.', 5)
	}
}

async function loadCard(selectedCardKey) {
	var saved = localStorage.getItem(selectedCardKey);
	if (!saved) {
		notify(selectedCardKey + ' failed to load.', 5);
		return;
	}
	return loadCardData(JSON.parse(saved));
}

function loadedCardRenderableImages() {
	var images = [art, setSymbol, watermark];
	(card.frames || []).forEach(frame => {
		images.push(frame.image);
		(frame.masks || []).forEach(mask => images.push(mask.image));
	});
	// Version scripts keep these images outside card.frames, but they are still
	// required before a restored Planeswalker can be rendered deterministically.
	if ((card.version || '').toLowerCase().includes('planeswalker')) {
		['plusIcon', 'minusIcon', 'neutralIcon', 'lightToDark', 'darkToLight', 'planeswalkerTextMask']
			.forEach(name => images.push(window[name]));
	}
	return images.filter(Boolean);
}

async function waitForLoadedCardAssets(timeoutMs = 6000) {
	var pendingImages = loadedCardRenderableImages().filter(image => !image.complete);
	if (!pendingImages.length) return;
	await Promise.all(pendingImages.map(image => waitForRenderableImage(image, timeoutMs)));
	await renderLoadedCard(false);
}

async function renderLoadedCard(canvasesResized = false) {
	// loadTextOptions intentionally buffers ordinary typing, but loading a whole
	// card needs a single ordered commit after every dependent asset is ready.
	clearTimeout(writingText);
	await Promise.all(loadedCardRenderableImages().map(waitForRenderableImage));
	await Promise.all([
		ensureCanvasFontsReady([
			...Object.values(card.text || {}),
			...Object.values(card.bottomInfo || {})
		]),
		ensureManaSymbolImagesReady()
	]);

	if ((card.version || '').toLowerCase().includes('planeswalker') && typeof planeswalkerEdited === 'function') {
		planeswalkerEdited();
		clearTimeout(writingText);
	}
	drawFrames();
	watermarkEdited();
	if (card.bottomInfo) await bottomInfoEdited();
	await drawText();
	if (canvasesResized) drawNewGuidelines();
	drawCard();
}
function deleteCard() {
	var keyToDelete = document.querySelector('#load-card-options').value;
	if (keyToDelete) {
		var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
		cardKeys.splice(cardKeys.indexOf(keyToDelete), 1);
		cardKeys.sort();
		localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
		localStorage.removeItem(keyToDelete);
		loadAvailableCards(cardKeys);
	}
}
function deleteSavedCards() {
	if (confirm('WARNING:\n\nALL of your saved cards will be deleted! If you would like to save these cards, please make sure you have downloaded them first. There is no way to undo this.\n\n(Press "OK" to delete your cards)')) {
		var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
		cardKeys.forEach(key => localStorage.removeItem(key));
		localStorage.setItem('cardKeys', JSON.stringify([]));
		loadAvailableCards([]);
	}
}
async function downloadSavedCards() {
	var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
	if (cardKeys) {
		var allSavedCards = [];
		cardKeys.forEach(item => {
			allSavedCards.push({key:item, data:JSON.parse(localStorage.getItem(item))});
		});
		var download = document.createElement('a');
		download.href = URL.createObjectURL(new Blob([JSON.stringify(allSavedCards)], {type:'text'}));
		download.download = 'saved-cards.cardconjurer';
		document.body.appendChild(download);
		await download.click();
		download.remove();
	}
}
function uploadSavedCards(event) {
	var reader = new FileReader();
	reader.onload = function () {
		JSON.parse(reader.result).forEach(item => saveCard(item));
	}
	reader.readAsText(event.target.files[0]);
}
//TUTORIAL TAB
function loadTutorialVideo() {
	var video = document.querySelector('.video > iframe');
	if (video.src == '') {
		video.src = 'https://www.youtube-nocookie.com/embed/e4tnOiub41g?rel=0';
	}
}
// GUIDELINES
function drawNewGuidelines() {
	// clear
	guidelinesContext.clearRect(0, 0, guidelinesCanvas.width, guidelinesCanvas.height);
	// set opacity
	guidelinesContext.globalAlpha = 0.25;
	// textboxes
	guidelinesContext.fillStyle = 'blue';
	Object.entries(card.text).forEach(item => {
		guidelinesContext.fillRect(scaleX(item[1].x || 0), scaleY(item[1].y || 0), scaleWidth(item[1].width || 1), scaleHeight(item[1].height || 1));
	});
	// art
	guidelinesContext.fillStyle = 'green';
	guidelinesContext.fillRect(scaleX(card.artBounds.x), scaleY(card.artBounds.y), scaleWidth(card.artBounds.width), scaleHeight(card.artBounds.height));
	// watermark
	guidelinesContext.fillStyle = 'yellow';
	var watermarkWidth = scaleWidth(card.watermarkBounds.width);
	var watermarkHeight = scaleHeight(card.watermarkBounds.height);
	guidelinesContext.fillRect(scaleX(card.watermarkBounds.x) - watermarkWidth / 2, scaleY(card.watermarkBounds.y) - watermarkHeight / 2, watermarkWidth, watermarkHeight);
	// set symbol
	var setSymbolX = scaleX(card.setSymbolBounds.x);
	var setSymbolY = scaleY(card.setSymbolBounds.y);
	var setSymbolWidth = scaleWidth(card.setSymbolBounds.width);
	var setSymbolHeight = scaleHeight(card.setSymbolBounds.height);
	if (card.setSymbolBounds.vertical == 'center') {
		setSymbolY -= setSymbolHeight / 2;
	} else if (card.setSymbolBounds.vertical == 'bottom') {
		setSymbolY -= setSymbolHeight;
	}
	if (card.setSymbolBounds.horizontal == 'center') {
		setSymbolX -= setSymbolWidth / 2;
	} else if (card.setSymbolBounds.horizontal == 'right') {
		setSymbolX -= setSymbolWidth;
	}
	guidelinesContext.fillStyle = 'red';
	guidelinesContext.save();
	guidelinesContext.translate(setSymbolX + setSymbolWidth / 2, setSymbolY + setSymbolHeight / 2);
	guidelinesContext.rotate(Math.PI * (card.setSymbolBounds.rotation || 0) / 180);
	guidelinesContext.fillRect(-setSymbolWidth / 2, -setSymbolHeight / 2, setSymbolWidth, setSymbolHeight);
	guidelinesContext.restore();
	// grid
	guidelinesContext.globalAlpha = 1;
	guidelinesContext.beginPath();
	guidelinesContext.strokeStyle = 'gray';
	guidelinesContext.lineWidth = 1;
	const boxPadding = 25;
	for (var x = 0; x <= card.width; x += boxPadding) {
		guidelinesContext.moveTo(x, 0);
		guidelinesContext.lineTo(x, card.height);
	}
	for (var y = 0; y <= card.height; y += boxPadding) {
		guidelinesContext.moveTo(0, y);
		guidelinesContext.lineTo(card.width, y);
	}
	guidelinesContext.stroke();
	//center lines
	guidelinesContext.beginPath();
	guidelinesContext.strokeStyle = 'black';
	guidelinesContext.lineWidth = 3;
	guidelinesContext.moveTo(card.width / 2, 0);
	guidelinesContext.lineTo(card.width / 2, card.height);
	guidelinesContext.moveTo(0, card.height / 2);
	guidelinesContext.lineTo(card.width, card.height / 2);
	guidelinesContext.stroke();
	//draw to card
	drawCard();
}
//HIGHLIGHT TRANSPARENCIES
function toggleCardBackgroundColor(highlight) {
	if (highlight) {
		previewCanvas.style["background-color"] = "#ff007fff";
	} else {
		previewCanvas.style["background-color"] = "#0000";
	}
}
//Rounded Corners
function setRoundedCorners(value) {
	card.noCorners = !value;
	drawCard();
}
//Various loaders
function imageURL(url, destination, otherParams) {
	var imageurl = url;
	// If an image URL does not have HTTP in it, assume it's a local file in the repo local_art directory.
	if (!url.includes('http')) {
		imageurl = '/local_art/' + url;
	} else if (params.get('noproxy') != '') {
		//CORS PROXY LINKS
		//Previously: https://cors.bridged.cc/
		imageurl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
	}
	destination(imageurl, otherParams);
}
async function imageLocal(event, destination, otherParams) {
	var reader = new FileReader();
	reader.onload = function () {
		destination(reader.result, otherParams);
	}
	reader.onerror = function () {
		destination('/img/blank.png', otherParams);
	}
	await reader.readAsDataURL(event.target.files[0]);
}
function loadScript(scriptPath) {
	return new Promise((resolve, reject) => {
	var script = document.createElement('script');
	script.setAttribute('type', 'text/javascript');
	script.onload = function() {
		const framePackMatch = scriptPath.match(/\/js\/frames\/pack(.+)\.js(?:\?.*)?$/);
		if (framePackMatch) window.loadedFramePack = framePackMatch[1];
		resolve();
	};
	script.onerror = function(){
		notify('A script failed to load, likely due to an update. Please reload your page. Sorry for the inconvenience.');
		reject();
	}
	var scriptSource = scriptPath;
	if (/^\/js\/frames\/pack.+\.js$/.test(scriptPath)) {
		scriptSource += '?v=20260802-render-engine-4';
	} else if (/^\/js\/frames\/version.+\.js$/.test(scriptPath)) {
		scriptSource += '?v=20260802-render-engine-4';
	}
	script.setAttribute('src', scriptSource);
	document.querySelectorAll('head')[0].appendChild(script);
	});
}
// Stretchable SVGs
function stretchSVG(frameObject) {
	const sources = [frameObject.src, ...frameFallbackSources(frameObject)];
	const trySource = (index) => {
		if (index >= sources.length) {
			console.warn(`Could not load stretchable frame image or any fallback: ${frameObject.src}`);
			frameObject.image.src = blank.src;
			return;
		}
		const xhr = new XMLHttpRequest();
		xhr.open('GET', fixUri(sources[index]), true);
		xhr.overrideMimeType('image/svg+xml');
		xhr.onload = function() {
			if (this.readyState == 4 && this.status == 200 && this.responseXML?.documentElement) {
				frameObject.image.src = 'data:image/svg+xml;charset=utf-8,' + stretchSVGReal((new XMLSerializer).serializeToString(this.responseXML.documentElement), frameObject);
			} else {
				trySource(index + 1);
			}
		};
		xhr.onerror = () => trySource(index + 1);
		xhr.send();
	};
	trySource(0);
}
function stretchSVGReal(data, frameObject) {
	var returnData = data;
	frameObject.stretch.forEach(stretch => {
		const change = stretch.change;
		const targets = stretch.targets;
		const name = stretch.name;
		const oldData = returnData.split(name + '" d="')[1].split('" style=')[0];
		var newData = '';
		const listData = oldData.split(/(?=[clmz])/gi);
		for (i = 0; i < listData.length; i ++) {
			const item = listData[i];
			if (targets.includes(i) || targets.includes(-i)) {
				let sign = 1;
				if (i != 0 && targets.includes(-i)) {sign = -1};
				if (item[0] == 'C' || item[0] == 'c') {
					newCoords = [];
					item.slice(1).split(' ').forEach(pair => {
						coords = pair.split(',');
						newCoords.push((scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1])));
					});
					newData += item[0] + newCoords.join(' ');
				} else {
					const coords = item.slice(1).split(/[, ]/);
					newData += item[0] + (scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1]))
				}
			} else {
				newData += item;
			}
		}
		returnData = returnData.replace(oldData, newData);
	});
	return returnData;
}
function processScryfallCard(card, responseCards) {
	if ('card_faces' in card) {
		card.card_faces.forEach(face => {
			face.set = card.set;
			face.rarity = card.rarity;
			face.collector_number = card.collector_number;
			face.lang = card.lang;
      face.layout = card.layout; // Add layout from parent card
			if (card.lang != 'en' || face.printed_name) {
				face.oracle_text = face.printed_text || face.oracle_text;
				face.name = face.printed_name || face.name;
				face.type_line = face.printed_type_line || face.type_line;
			}
			responseCards.push(face);
			if (!face.image_uris) {
				face.image_uris = card.image_uris;
			}
		});
	} else {
		if (card.lang != 'en' || card.printed_name) {
			card.oracle_text = card.printed_text || card.oracle_text;
			card.name = card.printed_name || card.name;
			card.type_line = card.printed_type_line || card.type_line;
		}
		// Ensure layout is set even for single-faced cards
		if (!card.layout) {
			card.layout = 'normal';
		}
		responseCards.push(card);
	}
}

function fetchScryfallCardByID(scryfallID, callback = console.log) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = [JSON.parse(this.responseText)];
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify(`No card found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
		}
	}
	xhttp.open('GET', 'https://api.scryfall.com/cards/' + scryfallID, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

function fetchScryfallCardByCodeNumber(code, number, callback = console.log) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = [JSON.parse(this.responseText)];
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify('No card found for ' + code + ' #' + number, 5);
		}
	}
	xhttp.open('GET', 'https://api.scryfall.com/cards/' + code + '/' + number, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

//SCRYFALL STUFF MAY BE CHANGED IN THE FUTURE
function fetchScryfallData(cardName, callback = console.log, unique = '') {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = JSON.parse(this.responseText).data;
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify(`No cards found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
		}
	}
	cardLanguageSelect = document.querySelector('#import-language');
	var cardLanguage = `lang%3D${cardLanguageSelect.value}`;
	var uniqueArt = '';
	if (unique) {
		uniqueArt = '&unique=' + unique;
	}
	var url = `https://api.scryfall.com/cards/search?order=released&include_extras=true${uniqueArt}&q=name%3D${cardName.replace(/ /g, '_')}%20${cardLanguage}`;
	xhttp.open('GET', url, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

function toggleTextTag(tag, element, textKey) {
	element = element || document.activeElement;
	if (!element || !element.classList.contains('text-field-input')) {
		element = document.getElementById('text-editor');
	}
	if (!element) return;
	textKey = textKey || element.dataset.textKey;

	var text = element.value;

	var start = element.selectionStart;
	var end = element.selectionEnd;
	var selection = text.substring(start, end);

	var openTag = '{' + tag + '}';
	var closeTag = '{/' + tag + '}';

	var prefix = text.substring(0, start);
	var suffix = text.substring(end);

	if (prefix.endsWith(openTag) && suffix.startsWith(closeTag)) {
		prefix = prefix.substring(0, prefix.length-openTag.length);
		suffix = suffix.substring(closeTag.length);
	} else if (selection.startsWith(openTag) && selection.endsWith(closeTag)) {
		selection = selection.substring(openTag.length, selection.length-closeTag.length);
	} else {
		selection = openTag + selection + closeTag;
	}

	element.value = prefix + selection + suffix;
	if (textKey) {
		textEdited(textKey, element.value, !currentLayoutTextKeys.has(textKey));
	} else {
		textEdited();
	}
	element.focus();
	var selectionStart = prefix.length;
	var selectionEnd = selectionStart + selection.length;
	element.setSelectionRange(selectionStart, selectionEnd);
}

function toggleHighRes() {
	localStorage.setItem('high-res', document.querySelector('#high-res').checked);
	drawCard();
}

// INITIALIZATION

const hideReminderTextInput = document.querySelector('#hide-reminder-text');
const italicizeReminderTextInput = document.querySelector('#italicize-reminder-text');
const savedHideReminderText = localStorage.getItem('hide-reminder-text');
const savedItalicizeReminderText = localStorage.getItem('italicize-reminder-text');
hideReminderTextInput.checked = savedHideReminderText === 'true';
italicizeReminderTextInput.checked = savedItalicizeReminderText === null ? true : savedItalicizeReminderText === 'true';
if (savedItalicizeReminderText === null) localStorage.setItem('italicize-reminder-text', 'true');

// auto load frame version (user defaults)
if (!localStorage.getItem('autoLoadFrameVersion')) {
	localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}
document.querySelector('#autoLoadFrameVersion').checked = 'true' == localStorage.getItem('autoLoadFrameVersion');
// document.querySelector('#high-res').checked = 'true' == localStorage.getItem('high-res');

// collector info (user defaults)
var defaultCollector = JSON.parse(localStorage.getItem('defaultCollector') || '{}');
if ('number' in defaultCollector) {
	document.querySelector('#info-number').value = defaultCollector.number;
	document.querySelector('#info-note').value = defaultCollector.note;
	document.querySelector('#info-rarity').value = defaultCollector.rarity;
	document.querySelector('#info-set').value = defaultCollector.setCode;
	document.querySelector('#info-language').value = defaultCollector.lang;
	document.querySelector('#info-copyright').value = defaultCollector.copyright || '';
} else {
	document.querySelector('#info-number').value = date.getFullYear();
}
if (!localStorage.getItem('enableImportCollectorInfo')) {
	localStorage.setItem('enableImportCollectorInfo', 'false');
} else {
	document.querySelector('#enableImportCollectorInfo').checked = (localStorage.getItem('enableImportCollectorInfo') == 'true');
}
if (!localStorage.getItem('enableNewCollectorStyle')) {
	localStorage.setItem('enableNewCollectorStyle', 'false');
} else {
	document.querySelector('#enableNewCollectorStyle').checked = (localStorage.getItem('enableNewCollectorStyle') == 'true');
}
localStorage.setItem('enableCollectorInfo', 'true');
document.querySelector('#enableCollectorInfo').checked = true;
localStorage.setItem('autoFrame', 'M15Regular-1');
document.querySelector('#autoFrame').value = 'M15Regular-1';
if (!localStorage.getItem('automaticallyUpdateFrame')) {
	localStorage.setItem('automaticallyUpdateFrame', 'true');
}
document.querySelector('#automaticallyUpdateFrame').checked = localStorage.getItem('automaticallyUpdateFrame') == 'true';
if (document.querySelector('#automaticallyUpdateFrame').checked) {
	document.querySelector('#autoLoadFrameVersion').checked = true;
	localStorage.setItem('autoLoadFrameVersion', 'true');
}
if (!localStorage.getItem('autoframe-always-nyx')) {
	localStorage.setItem('autoframe-always-nyx', 'false');
}
document.querySelector('#autoframe-always-nyx').checked = localStorage.getItem('autoframe-always-nyx') == 'true';
if (!localStorage.getItem('autoFit')) {
	localStorage.setItem('autoFit', 'true');
} else {
	document.querySelector('#art-update-autofit').checked = localStorage.getItem('autoFit');
}

// lock set symbol code (user defaults)
if (!localStorage.getItem('lockSetSymbolCode')) {
	localStorage.setItem('lockSetSymbolCode', '');
}
if (localStorage.getItem('set-symbol-source')) {
	document.querySelector('#set-symbol-source').value = localStorage.getItem('set-symbol-source');
}
document.querySelector('#lockSetSymbolCode').checked = '' != localStorage.getItem('lockSetSymbolCode');
if (document.querySelector('#lockSetSymbolCode').checked) {
	document.querySelector('#set-symbol-code').value = localStorage.getItem('lockSetSymbolCode');
	fetchSetSymbol();
}

// lock set symbol url (user defaults)
if (!localStorage.getItem('lockSetSymbolURL')) {
	localStorage.setItem('lockSetSymbolURL', '');
}
document.querySelector('#lockSetSymbolURL').checked = '' != localStorage.getItem('lockSetSymbolURL');
if (document.querySelector('#lockSetSymbolURL').checked) {
	setSymbol.src = localStorage.getItem('lockSetSymbolURL');
}

//bind inputs together
bindInputs('#frame-editor-hsl-hue', '#frame-editor-hsl-hue-slider');
bindInputs('#frame-editor-hsl-saturation', '#frame-editor-hsl-saturation-slider');
bindInputs('#frame-editor-hsl-lightness', '#frame-editor-hsl-lightness-slider');
bindInputs('#show-guidelines', '#show-guidelines-2', true);

renderWatermarkCatalog();
updateWatermarkColorControls();
syncAutomaticWatermarkColors();

// Load / init whatever
loadScript('/node_modules/jszip/dist/jszip.min.js');
initDraggableArt();
window.dispatchEvent(new CustomEvent('cardconjurer:creator-ready'));
