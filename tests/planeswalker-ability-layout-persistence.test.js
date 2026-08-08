const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/frames/versionPlaneswalker.js'), 'utf8');

function functionSource(name) {
	const start = source.indexOf(`function ${name}(`);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = source.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index++) {
		if (source[index] === '{') depth++;
		else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

function loadHelper() {
	const context = vm.createContext({});
	vm.runInContext(functionSource('updatePlaneswalkerAbilityTextBounds'), context);
	return context.updatePlaneswalkerAbilityTextBounds;
}

test('a manual width on a costed Planeswalker ability survives layout recalculation', () => {
	const updateBounds = loadHelper();
	const card = {
		planeswalker: {},
		text: {ability3: {x: 0.17, width: 1479 / 2010}},
	};

	updateBounds(card, 3, true);
	assert.equal(card.text.ability3.width, 1479 / 2010);
	assert.equal(card.text.ability3.x, 0.17);
});

test('blank loyalty costs expand and restore each ability independently', () => {
	const updateBounds = loadHelper();
	const card = {
		planeswalker: {},
		text: {
			ability0: {x: 0.16, width: 0.70},
			ability1: {x: 0.18, width: 0.73},
		},
	};

	updateBounds(card, 0, false);
	updateBounds(card, 1, true);
	assert.equal(card.text.ability0.x, 0.116);
	assert.equal(card.text.ability0.width, 0.744);
	assert.equal(card.text.ability1.x, 0.18);
	assert.equal(card.text.ability1.width, 0.73);

	updateBounds(card, 0, true);
	assert.equal(card.text.ability0.x, 0.16);
	assert.equal(card.text.ability0.width, 0.70);
});

test('a layout reset to costed bounds is re-expanded instead of saved as a manual blank-cost edit', () => {
	const updateBounds = loadHelper();
	const card = {
		planeswalker: {
			abilities: ['', '+1'],
			noCostTextBounds: {0: {x: 0.18, width: 0.7467}},
		},
		text: {
			ability0: {x: 0.18, width: 0.7467},
			ability1: {x: 0.18, width: 0.7467},
		},
	};

	updateBounds(card, 0, false);
	assert.equal(card.text.ability0.x, 0.136);
	assert.ok(Math.abs(card.text.ability0.width - 0.7907) < 0.000001);
	assert.equal(card.planeswalker.noCostTextBounds[0].x, 0.18);
	assert.equal(card.planeswalker.noCostTextBounds[0].width, 0.7467);
});

test('a blank ability repairs bounds corrupted by the prior layout-reset regression', () => {
	const updateBounds = loadHelper();
	const card = {
		planeswalker: {
			abilities: ['', '+1'],
			noCostTextBounds: {0: {x: 0.224, width: 0.7027}},
		},
		text: {
			ability0: {x: 0.18, width: 0.7467},
			ability1: {x: 0.18, width: 0.7467},
		},
	};

	updateBounds(card, 0, false);
	assert.equal(card.text.ability0.x, 0.136);
	assert.ok(Math.abs(card.text.ability0.width - 0.7907) < 0.000001);
	assert.equal(card.planeswalker.noCostTextBounds[0].x, 0.18);
	assert.equal(card.planeswalker.noCostTextBounds[0].width, 0.7467);
});

test('legacy already-expanded blank abilities migrate without expanding twice', () => {
	const updateBounds = loadHelper();
	const card = {
		planeswalker: {
			orig_ability_textbox_x: 0.16,
			orig_ability_textbox_width: 0.70,
		},
		text: {ability2: {x: 0.116, width: 0.744}},
	};

	updateBounds(card, 2, false);
	assert.equal(card.text.ability2.x, 0.116);
	assert.equal(card.text.ability2.width, 0.744);
	assert.equal(card.planeswalker.noCostTextBounds[2].x, 0.16);
	assert.equal(card.planeswalker.noCostTextBounds[2].width, 0.70);
});
