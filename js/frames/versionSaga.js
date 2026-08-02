//checks to see if it needs to run
var sagaVersionFirstLoad = !loadedVersions.includes('/js/frames/versionSaga.js');
if (sagaVersionFirstLoad) {
	loadedVersions.push('/js/frames/versionSaga.js');
	sizeCanvas('saga');
	if (!card.saga) {
		card.saga = {abilities:[1, 1, 1, 0], count:3, x:(card.version === "oldSaga" ? 0.1114 : 0.1), width:(card.version === "oldSaga" ? 0.3727 : 0.3947)};
	} else {
		card.saga.x = (card.version === "oldSaga" ? 0.1114 : 0.1);
		card.saga.width = (card.version === "oldSaga" ? 0.3727 : 0.3947);
	}
	var sagaChapter = new Image();
	setImageUrl(sagaChapter, '/img/frames/saga/sagaChapter.png');
	var sagaDivider = new Image();
	setImageUrl(sagaDivider, '/img/frames/saga/sagaDivider.png');
	sagaChapter.onload = sagaDivider.onload = sagaEdited;
} else {
	if (!card.saga) {
		card.saga = {abilities:[1, 1, 1, 0], count:3, x:(card.version === "oldSaga" ? 0.1114 : 0.1), width:(card.version === "oldSaga" ? 0.3727 : 0.3947)};
	} else {
		card.saga.x = (card.version === "oldSaga" ? 0.1114 : 0.1);
		card.saga.width = (card.version === "oldSaga" ? 0.3727 : 0.3947);
	}
}

registerCardSpecificTextTools({
	key: 'saga',
	title: 'Saga',
	description: 'Choose how many chapter symbols belong to each ability.',
	fieldAccessories: Object.fromEntries([0, 1, 2, 3].map(index => [`ability${index}`, `
		<label for="saga-chapters-${index}"><span>Chapter count</span><input id="saga-chapters-${index}" type="number" class="input" min="0" max="6" step="1" oninput="sagaEdited();" aria-label="Ability ${index + 1} chapter count"></label>
	`])),
	layoutDescription: 'Adjust the vertical space available to each Saga ability.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Ability boxes</h3><p>Set each chapter ability's text height</p></div>
			<div class="layout-control-grid">
				${[0, 1, 2, 3].map(index => `<label class="layout-control-field"><span>Ability ${index + 1} height</span><span class="layout-input-shell"><input id="saga-height-${index}" type="number" class="input" min="0" step="1" oninput="sagaEdited();"><small>px</small></span></label>`).join('')}
			</div>
		</section>`,
	onRender: fixSagaInputs
});

updateAbilityHeights();

function sagaEdited() {
	//gather data
	card.saga.abilities[0] = document.querySelector('#saga-chapters-0').value;
	card.saga.abilities[1] = document.querySelector('#saga-chapters-1').value;
	card.saga.abilities[2] = document.querySelector('#saga-chapters-2').value;
	card.saga.abilities[3] = document.querySelector('#saga-chapters-3').value;
	card.saga.count = 0;
	var lastY = card.text.ability0.y;
	for (var i = 0; i < 4; i ++) {
		card.text['ability' + i].y = lastY;
		var height = parseFloat((parseInt(document.querySelector('#saga-height-' + i).value) / card.height).toFixed(4));
		if (height > 0) {
			card.saga.count ++;
		}
		card.text['ability' + i].height = height;
		lastY += height;
	}
	fixSagaInputs();
	//draw to saga canvas
	sagaContext.clearRect(0, 0, sagaCanvas.width, sagaCanvas.height);
	sagaContext.font = 'normal normal 550 ' + scaleHeight(0.0324) + 'px plantinsemibold';
	sagaContext.textAlign = 'center';
	var sagaCount = 1;
	for (var i = 0; i < card.saga.count; i ++) {
		var x = scaleX(card.saga.x);
		var y = scaleY(card.text['ability' + i].y);
		var width = scaleWidth(card.saga.width);
		var height = scaleHeight(card.text['ability' + i].height);
		if (sagaDivider.complete) {
			sagaContext.drawImage(sagaDivider, x, y - scaleHeight(0.0029) / 2, width, scaleHeight(0.0029));
		}
		if (sagaChapter.complete) {
			var numeralX = x - scaleWidth(0.0614);
			var numeralWidth = scaleWidth(0.0787);
			var numeralHeight = scaleHeight(0.0629);
			var numeralY = y + (height - numeralHeight) / 2;
			var numeralTextX = numeralX + scaleWidth(0.0394);
			var numeralTextY = numeralY + scaleHeight(0.0429);
			var count = parseInt(card.saga.abilities[i]);
			var offset = scaleHeight(0.0358);
			var centerOffset = (count - 1) / 2;

			for (let j = 0; j < count; j++) {
					let positionOffset = (j - centerOffset) * offset * 2;

					sagaContext.drawImage(sagaChapter, numeralX, numeralY + positionOffset, numeralWidth, numeralHeight);
					sagaContext.fillText(romanNumeral(sagaCount + j), numeralTextX, numeralTextY + positionOffset);
			}
			sagaCount += count;
		}
	}
	drawTextBuffer();
	drawCard();
}

function updateAbilityHeights() {
	const maxHeight = card.text.type.y - card.text.ability0.y;
	
	// Get all saga abilities that have content
	const abilities = [];
	for (let i = 0; i < card.saga.count; i++) {
	const abilityText = card.text[`ability${i}`].text;
	// Count words excluding reminder text in parentheses
	const wordCount = abilityText
		.replace(/\([^)]*\)/g, '') // Remove reminder text
		.trim()
		.split(/\s+/)
		.length;
		
	abilities.push({
		index: i,
		wordCount: wordCount
	});
	}

	// Calculate proportional heights
	const totalWords = abilities.reduce((sum, a) => sum + a.wordCount, 0);
	
	// Add height constraint (minimum height)
	const minHeight = maxHeight * 0.15; // 15% of max height
	let availableHeight = maxHeight - (minHeight * abilities.length);
	abilities.forEach(ability => {
		const height = minHeight + (
			(ability.wordCount / totalWords) * availableHeight
		);
		card.text[`ability${ability.index}`].height = height;
	});

	// Set remaining abilities to 0 height
	for (let i = card.saga.count; i < 4; i++) {
	card.text[`ability${i}`].height = 0;
	}

	fixSagaInputs(sagaEdited);
}

function fixSagaInputs(callback) {
	document.querySelector('#saga-height-0').value = scaleHeight(card.text.ability0.height);
	document.querySelector('#saga-chapters-0').value = card.saga.abilities[0];
	document.querySelector('#saga-height-1').value = scaleHeight(card.text.ability1.height);
	document.querySelector('#saga-chapters-1').value = card.saga.abilities[1];
	document.querySelector('#saga-height-2').value = scaleHeight(card.text.ability2.height);
	document.querySelector('#saga-chapters-2').value = card.saga.abilities[2];
	document.querySelector('#saga-height-3').value = scaleHeight(card.text.ability3.height);
	document.querySelector('#saga-chapters-3').value = card.saga.abilities[3];
	if (callback) {
		callback();
	}
}

function romanNumeral(input) {
	if (input <= 0) return input;

	const romanMap = [
		{ value: 1000, numeral: 'M' },
		{ value: 900, numeral: 'CM' },
		{ value: 500, numeral: 'D' },
		{ value: 400, numeral: 'CD' },
		{ value: 100, numeral: 'C' },
		{ value: 90, numeral: 'XC' },
		{ value: 50, numeral: 'L' },
		{ value: 40, numeral: 'XL' },
		{ value: 10, numeral: 'X' },
		{ value: 9, numeral: 'IX' },
		{ value: 5, numeral: 'V' },
		{ value: 4, numeral: 'IV' },
		{ value: 1, numeral: 'I' }
	];

	let result = '';
	for (const { value, numeral } of romanMap) {
		while (input >= value) {
			result += numeral;
			input -= value;
		}
	}
	return result;
}
