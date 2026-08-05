const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');

function functionSource(name) {
	const start = creator.indexOf(`function ${name}(`);
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
	const autoFrameInput = {value: 'PlaneswalkerTall', dataset: {profile: 'PlaneswalkerTall'}};
	const context = {
		autoFrameInput,
		activeFramePack: 'M15Regular-1',
		activeFrameCustomizationPack: 'PlaneswalkerTall',
		activeFrameComponentOptions: {},
		automaticVariantPack: 'PlaneswalkerTall',
		FRAME_REGISTRY: {engine: pack => pack},
		localStorage: {setItem() {}},
		document: {
			querySelector(selector) { return selector === '#autoFrame' ? autoFrameInput : null; },
			querySelectorAll() { return []; }
		},
		renderFrameCustomize() {}
	};
	vm.createContext(context);
	vm.runInContext(functionSource('applyLiveDraftUi'), context);
	return context;
}

test('loading a blank card resets a stale planeswalker frame profile', () => {
	const context = createContext();

	context.applyLiveDraftUi({});

	assert.equal(context.activeFramePack, 'M15Regular-1');
	assert.equal(context.activeFrameCustomizationPack, null);
	assert.equal(context.automaticVariantPack, null);
	assert.equal(context.autoFrameInput.value, 'M15Regular-1');
	assert.equal(context.autoFrameInput.dataset.profile, 'M15Regular-1');
});

test('loading a saved tall planeswalker keeps its rendered and selected profiles aligned', () => {
	const context = createContext();

	context.applyLiveDraftUi({
		activeFramePack: 'M15Regular-1',
		activeFrameCustomizationPack: 'PlaneswalkerTall',
		activeFrameComponentOptions: {},
		automaticVariantPack: 'PlaneswalkerTall',
		autoFrameValue: 'PlaneswalkerTall',
		selectedFrameProfile: 'PlaneswalkerTall'
	});

	assert.equal(context.activeFramePack, 'M15Regular-1');
	assert.equal(context.activeFrameCustomizationPack, 'PlaneswalkerTall');
	assert.equal(context.automaticVariantPack, 'PlaneswalkerTall');
	assert.equal(context.autoFrameInput.value, 'PlaneswalkerTall');
	assert.equal(context.autoFrameInput.dataset.profile, 'PlaneswalkerTall');
});
