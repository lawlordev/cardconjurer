const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');

function functionSource(name, isAsync = false) {
	const prefix = isAsync ? `async function ${name}(` : `function ${name}(`;
	const start = creator.indexOf(prefix);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = creator.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < creator.length; index++) {
		if (creator[index] === '{') depth++;
		else if (creator[index] === '}' && --depth === 0) return creator.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

function createContext() {
	const element = {value: '', checked: false, innerHTML: ''};
	const context = {
		card: {},
		savedTextContents: {},
		savedTextFontSizes: {ability0: '-20'},
		layoutOwnedTextDefaults: {},
		currentLayoutTextKeys: new Set(),
		userOptionalTextKeys: new Set(),
		optionalTextboxDefinitions: {},
		canvasList: [],
		date: new Date('2026-01-01T00:00:00Z'),
		document: {
			activeElement: null,
			querySelector() { return element; },
			getElementById() { return element; }
		},
		clearCardSpecificTextTools() {},
		collectorBottomInfoUsesStar() { return false; },
		applyLiveDraftUi() { return false; },
		artistEdited() {},
		renderTextFieldForm() {},
		drawTextBuffer() {},
		drawNewGuidelines() {},
		scaleX(value) { return value; },
		scaleY(value) { return value; },
		scaleWidth(value) { return value; },
		scaleHeight(value) { return value; },
		uploadArt() {},
		uploadSetSymbol() {},
		updateWatermarkColorControls() {},
		syncAutomaticWatermarkColors() {},
		uploadWatermark() {},
		syncCollectorStarControl() {},
		serialInfoEdited() {},
		async addFrame() {},
		async loadScript() {},
		applyCollectorStarStyle() {},
		sizeCanvas() {},
		async renderLoadedCard() {},
		notify() {}
	};
	vm.createContext(context);
	vm.runInContext(`${functionSource('textFieldFocusState')}\n${functionSource('loadTextOptions')}\n${functionSource('loadCardData', true)}`, context);
	return context;
}

function cardData(fontSize) {
	const ability = {name: 'Ability 1', text: '', size: 0.0353};
	if (fontSize !== undefined) ability.fontSize = fontSize;
	return {
		infoUseStar: false,
		bottomInfo: {},
		text: {ability0: ability},
		infoNumber: '',
		infoRarity: 'common',
		infoSet: 'TST',
		infoLanguage: 'EN',
		infoNote: '',
		infoYear: 2026,
		infoCopyright: '',
		infoCopyrightFirstLineNoteStyle: false,
		infoArtist: '',
		artX: 0,
		artY: 0,
		artZoom: 1,
		artSource: '',
		setSymbolX: 0,
		setSymbolY: 0,
		setSymbolZoom: 1,
		setSymbolSource: '',
		watermarkX: 0,
		watermarkY: 0,
		watermarkZoom: 1,
		watermarkOpacity: 1,
		watermarkSource: '',
		marginX: 0,
		marginY: 0,
		noCorners: false,
		frames: [],
		manaSymbols: [],
		width: 1005,
		height: 1407
	};
}

test('loading a card does not inherit the previous card font-size override', async () => {
	const context = createContext();
	await context.loadCardData(cardData());
	assert.equal(context.card.text.ability0.fontSize, undefined);
});

test('loading a card keeps its own override available during frame changes', async () => {
	const context = createContext();
	await context.loadCardData(cardData('-8'));
	context.loadTextOptions({ability0: {name: 'Ability 1', text: '', size: 0.0353}});
	assert.equal(context.card.text.ability0.fontSize, '-8');
});
