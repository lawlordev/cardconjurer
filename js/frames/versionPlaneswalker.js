//checks to see if it needs to run
var planeswalkerVersionFirstLoad = !loadedVersions.includes('/js/frames/versionPlaneswalker.js');
var planeswalkerTallLayout = card.version.toLowerCase().includes('tall') || card.version.toLowerCase().includes('compleated');
var planeswalkerLayoutMode = planeswalkerTallLayout ? 'tall' : 'normal';
var planeswalkerDefaultShifts = (planeswalkerTallLayout ? [-16, 14, 34, 40] : [0, 38, 45, 0]).map(value => value / card.height);
var planeswalkerDefaultCosts = planeswalkerTallLayout ? ['+1', '0', '-1', '-7'] : ['+1', '0', '-1', ''];
if (planeswalkerVersionFirstLoad) {
	loadedVersions.push('/js/frames/versionPlaneswalker.js');
	sizeCanvas('planeswalkerPreFrame');
	sizeCanvas('planeswalkerPostFrame');
	window.planeswalkerAbilityLayout = [[[0.7467], [0.6953, 0.822], [0.6639, 0.7467, 0.8362], [0.6505, 0.72, 0.7905, 0.861]],[[0.72], [0.6391, 0.801], [0.5986, 0.72, 0.8415], [0.5986, 0.6796, 0.7605, 0.8415]]];
	var plusIcon = new Image();
	setImageUrl(plusIcon, '/img/frames/planeswalker/planeswalkerPlus.png');
	var minusIcon = new Image();
	setImageUrl(minusIcon, '/img/frames/planeswalker/planeswalkerMinus.png');
	var neutralIcon = new Image();
	setImageUrl(neutralIcon, '/img/frames/planeswalker/planeswalkerNeutral.png');
	var lightToDark = new Image();
	setImageUrl(lightToDark, '/img/frames/planeswalker/abilityLineOdd.png');
	var darkToLight = new Image();
	setImageUrl(darkToLight, '/img/frames/planeswalker/abilityLineEven.png');
	var planeswalkerTextMask = new Image();
	planeswalkerTextMask.onload = function(){resetPlaneswalkerImages(fixPlaneswalkerInputs(planeswalkerEdited));}
	setImageUrl(planeswalkerTextMask, '/img/frames/planeswalker/text.svg');
	var lightColor = 'white';
	var darkColor = '#a4a4a4';
}

if (!card.planeswalker) {
	card.planeswalker = {
		abilities:planeswalkerDefaultCosts.slice(),
		abilityAdjust:planeswalkerDefaultShifts.slice(),
		count:planeswalkerTallLayout ? 4 : 3,
		x:0.1167,
		width:0.8094,
		layoutMode:planeswalkerLayoutMode
	};
} else if (card.planeswalker.layoutMode && card.planeswalker.layoutMode != planeswalkerLayoutMode) {
	// Style changes deliberately update badge placement without replacing the
	// user's first three loyalty costs or any entered ability text.
	card.planeswalker.abilityAdjust = planeswalkerDefaultShifts.slice();
	if (planeswalkerTallLayout) {
		if (!card.planeswalker.abilities[3]) card.planeswalker.abilities[3] = '-7';
	} else {
		card.planeswalker.abilities[3] = '';
	}
	card.planeswalker.layoutMode = planeswalkerLayoutMode;
} else if (!card.planeswalker.layoutMode) {
	// Preserve custom values on older saved cards while opting them into future
	// normal/tall transitions.
	card.planeswalker.layoutMode = planeswalkerLayoutMode;
}
if (card.text?.loyalty && !card.text.loyalty.text) card.text.loyalty.text = '4';

registerCardSpecificTextTools({
	key: 'planeswalker',
	title: 'Planeswalker',
	description: 'Set loyalty beside each ability. Fine-tune spacing only when needed.',
	fieldAccessories: Object.fromEntries([0, 1, 2, 3].map(index => [`ability${index}`, `
		<label for="planeswalker-cost-${index}"><span>Loyalty cost</span><input id="planeswalker-cost-${index}" type="text" class="input" oninput="planeswalkerEdited();" aria-label="Ability ${index + 1} loyalty cost"></label>
	`])),
	layoutDescription: 'Adjust ability heights and the vertical placement of each loyalty badge.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Ability boxes</h3><p>Height available to each ability's rules text</p></div>
			<div class="layout-control-grid">
				${[0, 1, 2, 3].map(index => `<label class="layout-control-field"><span>Ability ${index + 1} height</span><span class="layout-input-shell"><input id="planeswalker-height-${index}" type="number" class="input" min="0" step="1" oninput="planeswalkerEdited();"><small>px</small></span></label>`).join('')}
			</div>
		</section>
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Loyalty badges</h3><p>Move each loyalty badge vertically from its automatic position</p></div>
			<div class="layout-control-grid">
				${[0, 1, 2, 3].map(index => `<label class="layout-control-field"><span>Ability ${index + 1} shift</span><span class="layout-input-shell"><input id="planeswalker-shift-${index}" type="number" class="input" step="1" oninput="planeswalkerEdited();"><small>px</small></span></label>`).join('')}
			</div>
		</section>`,
	advancedHTML: `
		<label class="checkbox-container input workspace-checkbox card-specific-option-card full-width">
			<span class="frame-advanced-option-copy"><strong>Invert Textbox Colors</strong><small>Use dark ability boxes for light artwork</small></span>
			<input id="planeswalker-invert" type="checkbox" onchange="invertPlaneswalkerColors();"><span class="checkmark"></span>
		</label>`,
	onRender: () => {
		fixPlaneswalkerInputs();
		invertPlaneswalkerColors(true);
	}
});

if (!planeswalkerVersionFirstLoad) resetPlaneswalkerImages(fixPlaneswalkerInputs(planeswalkerEdited));

function planeswalkerEdited() {
	// manage text masks
	var planeswalkerTall = 0;
	if (card.version.includes('Tall') || card.version.includes('Compleated')) {
		planeswalkerTall = 1;
		if (!(planeswalkerTextMask.src.includes('tall'))) {
			setImageUrl(planeswalkerTextMask, '/img/frames/planeswalker/tall/planeswalkerTallMaskRules.png');
		}
	} else if (card.version == 'planeswalkerTransformFront') {
		if (!planeswalkerTextMask.src.includes('transform/textFront')) {
			setImageUrl(planeswalkerTextMask, '/img/frames/planeswalker/transform/textFront.svg');
		}
	} else {
		if (!planeswalkerTextMask.src.includes('planeswalker/text.svg')) {
			setImageUrl(planeswalkerTextMask, '/img/frames/planeswalker/text.svg');
		}
	}
	// manage textbox size
	if (card.version.toLowerCase().includes('TransformFront')) {
		card.planeswalker.x = 0.1167;
		card.planeswalker.width = 0.8334;
	} else {
		card.planeswalker.x = 0.1167;
		card.planeswalker.width = 0.8094;
	}
	card.planeswalker.abilities[0] = document.querySelector('#planeswalker-cost-0').value;
	card.planeswalker.abilities[1] = document.querySelector('#planeswalker-cost-1').value;
	card.planeswalker.abilities[2] = document.querySelector('#planeswalker-cost-2').value;
	card.planeswalker.abilities[3] = document.querySelector('#planeswalker-cost-3').value;
	card.planeswalker.abilityAdjust[0] = document.querySelector('#planeswalker-shift-0').value / card.height;
	card.planeswalker.abilityAdjust[1] = document.querySelector('#planeswalker-shift-1').value / card.height;
	card.planeswalker.abilityAdjust[2] = document.querySelector('#planeswalker-shift-2').value / card.height;
	card.planeswalker.abilityAdjust[3] = document.querySelector('#planeswalker-shift-3').value / card.height;
	card.planeswalker.count = 0;
	var lastY = card.text.ability0.y;
	for (var i = 0; i < 4; i ++) {
	 	card.text['ability' + i].y = lastY;
	 	var height = parseFloat((parseInt(document.querySelector('#planeswalker-height-' + i).value) / card.height).toFixed(4));
	 	if (height > 0) {
	 		card.planeswalker.count ++;
	 	}
	 	if (document.querySelector('#planeswalker-cost-' + i).value == "") {
	 		if (!card.planeswalker.orig_ability_textbox_x) {
		 		card.planeswalker.orig_ability_textbox_x = card.text['ability' + i].x;
		 		card.planeswalker.orig_ability_textbox_width = card.text['ability' + i].width;
	 		}
	 		card.text['ability' + i].x = card.planeswalker.orig_ability_textbox_x - 0.044;
	 		card.text['ability' + i].width = card.planeswalker.orig_ability_textbox_width + 0.044;
	 	} else if (card.planeswalker.orig_ability_textbox_x) {
	 		card.text['ability' + i].x = card.planeswalker.orig_ability_textbox_x;
	 		card.text['ability' + i].width = card.planeswalker.orig_ability_textbox_width;
	 	}
	 	card.text['ability' + i].height = height;
	 	lastY += height;
	}
	fixPlaneswalkerInputs();
	var transitionHeight = scaleHeight(0.0048);
	planeswalkerPreFrameContext.clearRect(0, 0, planeswalkerPreFrameCanvas.width, planeswalkerPreFrameCanvas.height);
	planeswalkerPreFrameContext.globalCompositeOperation = 'source-over';
	planeswalkerPostFrameContext.clearRect(0, 0, planeswalkerPostFrameCanvas.width, planeswalkerPostFrameCanvas.height);
	if (!['planeswalkerSDCC15', 'planeswalkerSeventh'].includes(card.version)) {
		for (var i = 0; i < card.planeswalker.count; i ++) {
			var x = scaleX(card.planeswalker.x);
			var y = scaleY(card.text['ability' + i].y);
			var width = scaleWidth(card.planeswalker.width);
			var height = scaleHeight(card.text['ability' + i].height);
			if (i == 0) {
				y -= scaleHeight(0.1);
				height += scaleHeight(0.1);
			} else if (i == card.planeswalker.count - 1) {
				height += scaleHeight(0.5);
			}
			if (i % 2 == 0) {
				planeswalkerPreFrameContext.fillStyle = lightColor;
				planeswalkerPreFrameContext.globalAlpha = 0.608;
				planeswalkerPreFrameContext.fillRect(x, y + transitionHeight, width, height - 2 * transitionHeight);
				planeswalkerPreFrameContext.globalAlpha = 1;
				if (lightToDark.complete) {
					planeswalkerPreFrameContext.drawImage(lightToDark, x, y + height - transitionHeight, width, 2 * transitionHeight);
				}
			} else {
				planeswalkerPreFrameContext.fillStyle = darkColor;
				planeswalkerPreFrameContext.globalAlpha = 0.706;
				planeswalkerPreFrameContext.fillRect(x, y + transitionHeight, width, height - 2 * transitionHeight);
				planeswalkerPreFrameContext.globalAlpha = 1;
				if (darkToLight.complete) {
					planeswalkerPreFrameContext.drawImage(darkToLight, x, y + height - transitionHeight, width, 2 * transitionHeight);
				}
			}
		}
	}
	planeswalkerPreFrameContext.globalCompositeOperation = 'destination-in';
	if (planeswalkerTextMask.complete) {
		planeswalkerPreFrameContext.drawImage(planeswalkerTextMask, scaleX(0), scaleY(0), scaleWidth(1), scaleHeight(1));
	}
	planeswalkerPostFrameContext.globalCompositeOperation = 'source-over';
	planeswalkerPostFrameContext.fillStyle = 'white'
	planeswalkerPostFrameContext.font = scaleHeight(0.0286) + 'px belerenbsc';
	planeswalkerPostFrameContext.textAlign = 'center';
	for (var i = 0; i < card.planeswalker.count; i ++) {
		var planeswalkerIconValue = card.planeswalker.abilities[i];
		var planeswalkerPlacement = scaleY(planeswalkerAbilityLayout[planeswalkerTall][card.planeswalker.count - 1][i] + card.planeswalker.abilityAdjust[i])
		if (planeswalkerIconValue.includes('+')) {
			if (plusIcon.complete) {
				planeswalkerPostFrameContext.drawImage(plusIcon, scaleX(0.0294), planeswalkerPlacement - scaleHeight(0.0258), scaleWidth(0.14), scaleHeight(0.0724));
			}
			planeswalkerPostFrameContext.fillText(planeswalkerIconValue, scaleX(0.1027), planeswalkerPlacement + scaleHeight(0.0172));
		} else if (planeswalkerIconValue.includes('-')) {
			if (minusIcon.complete) {
				planeswalkerPostFrameContext.drawImage(minusIcon, scaleX(0.028), planeswalkerPlacement - scaleHeight(0.0153), scaleWidth(0.1414), scaleHeight(0.0705));
			}
			planeswalkerPostFrameContext.fillText(planeswalkerIconValue, scaleX(0.1027), planeswalkerPlacement + scaleHeight(0.0181));
		} else if (planeswalkerIconValue != '') {
			if (neutralIcon.complete) {
				planeswalkerPostFrameContext.drawImage(neutralIcon, scaleX(0.028), planeswalkerPlacement - scaleHeight(0.0153), scaleWidth(0.1414), scaleHeight(0.061));
			}
			planeswalkerPostFrameContext.fillText(planeswalkerIconValue, scaleX(0.1027), planeswalkerPlacement + scaleHeight(0.0191));
		}
	}
	drawTextBuffer();
	drawCard();
	if (typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}

function fixPlaneswalkerInputs(callback) {
	document.querySelector('#planeswalker-height-0').value = scaleHeight(card.text.ability0.height);
	document.querySelector('#planeswalker-cost-0').value = card.planeswalker.abilities[0];
	document.querySelector('#planeswalker-shift-0').value = scaleHeight(card.planeswalker.abilityAdjust[0]);
	document.querySelector('#planeswalker-height-1').value = scaleHeight(card.text.ability1.height);
	document.querySelector('#planeswalker-cost-1').value = card.planeswalker.abilities[1];
	document.querySelector('#planeswalker-shift-1').value = scaleHeight(card.planeswalker.abilityAdjust[1]);
	document.querySelector('#planeswalker-height-2').value = scaleHeight(card.text.ability2.height);
	document.querySelector('#planeswalker-cost-2').value = card.planeswalker.abilities[2];
	document.querySelector('#planeswalker-shift-2').value = scaleHeight(card.planeswalker.abilityAdjust[2]);
	document.querySelector('#planeswalker-height-3').value = scaleHeight(card.text.ability3.height);
	document.querySelector('#planeswalker-cost-3').value = card.planeswalker.abilities[3];
	document.querySelector('#planeswalker-shift-3').value = scaleHeight(card.planeswalker.abilityAdjust[3]);
	if (callback) {
		callback();
	}
}

function resetPlaneswalkerImages(callback) {
	var planeswalkerImageFolder = '';
	var planeswalkerImageExtension = 'png';
	if (card.version == 'planeswalkerSDCC15') {
		planeswalkerImageFolder = '/sdcc15';
		planeswalkerImageExtension = 'svg';
	}
	setImageUrl(plusIcon, `/img/frames/planeswalker${planeswalkerImageFolder}/planeswalkerPlus.${planeswalkerImageExtension}`);
	setImageUrl(minusIcon, `/img/frames/planeswalker${planeswalkerImageFolder}/planeswalkerMinus.${planeswalkerImageExtension}`);
	setImageUrl(neutralIcon, `/img/frames/planeswalker${planeswalkerImageFolder}/planeswalkerNeutral.${planeswalkerImageExtension}`);
	setImageUrl(lightToDark, `/img/frames/planeswalker${planeswalkerImageFolder}/abilityLineOdd.${planeswalkerImageExtension}`);
	setImageUrl(darkToLight, `/img/frames/planeswalker${planeswalkerImageFolder}/abilityLineEven.${planeswalkerImageExtension}`);
	if (!darkToLight.onload) {
		darkToLight.onload = function() {planeswalkerEdited();}
	}
	if (callback) {
		callback();
	}
}

function invertPlaneswalkerColors(reverse = false) {
	if (reverse) {
		document.querySelector('#planeswalker-invert').checked = card.planeswalker.invert;
	} else {
		card.planeswalker.invert = document.querySelector('#planeswalker-invert').checked;
	}
	if (!lightToDark.onload) {
		lightToDark.onload = planeswalkerEdited;
		darkToLight.onload = planeswalkerEdited;
	}
	if (card.planeswalker.invert) {
		darkColor = '#5b5b5b';
		lightColor = 'black';
		setImageUrl(lightToDark, '/img/frames/planeswalker/abilityLineOddDarkened.png');
		setImageUrl(darkToLight, '/img/frames/planeswalker/abilityLineEvenDarkened.png');
	} else {
		darkColor = '#a4a4a4';
		lightColor = 'white';
		setImageUrl(lightToDark, '/img/frames/planeswalker/abilityLineOdd.png');
		setImageUrl(darkToLight, '/img/frames/planeswalker/abilityLineEven.png');
	}
	if (!reverse && typeof queueLiveDraftSave === 'function') queueLiveDraftSave();
}
