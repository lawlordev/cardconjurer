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

function groupFor(version, key, text = 'Rules text') {
	const context = vm.createContext({card: {version}});
	vm.runInContext(functionSource('sharedTextSizeGroup'), context);
	return context.sharedTextSizeGroup(key, {text, height: 0.1});
}

test('official compartment layouts opt into their family-wide text size', () => {
	assert.equal(groupFor('planeswalkerTall', 'ability3'), 'planeswalker-abilities');
	assert.equal(groupFor('sagaRegular', 'ability1'), 'saga-abilities');
	assert.equal(groupFor('class', 'level2c'), 'class-levels');
	assert.equal(groupFor('stationBorderless', 'ability2'), 'station-abilities');
	assert.equal(groupFor('dungeon', 'dungeonRoom7'), 'dungeon-rooms');
	assert.equal(groupFor('leveler', 'rules3'), 'leveler-abilities');
});

test('independently typeset card halves do not share an automatic size', () => {
	for (const version of ['room', 'roomUB', 'adventure', 'omen', 'prepare', 'split', 'fuse', 'aftermath', 'flip']) {
		assert.equal(groupFor(version, 'rules'), null, `${version} primary rules should size independently`);
		assert.equal(groupFor(version, 'rules2'), null, `${version} secondary rules should size independently`);
	}
	assert.equal(groupFor('leveler', 'levelup'), null);
});

test('a shared group uses the smallest fitted size from its active fields', () => {
	const context = vm.createContext({
		card: {version: 'planeswalkerTall'},
		textContext: {},
		collisionAwareTextObject(key, object) { return object; },
		writeText(object) { return {fittedTextSize: object.fakeFit}; },
	});
	vm.runInContext(`${functionSource('sharedTextSizeGroup')}\n${functionSource('measureSharedTextSizeLimits')}`, context);
	const limits = context.measureSharedTextSizeLimits([
		['ability0', {text: 'Short', height: 0.1, fakeFit: 48}],
		['ability1', {text: 'Much longer', height: 0.1, fakeFit: 39}],
		['ability2', {text: 'Medium', height: 0.1, fakeFit: 44}],
	]);
	assert.equal(limits['planeswalker-abilities'], 39);
});

test('measurement is non-painting and the selected group size caps final rendering', () => {
	const drawText = functionSource('drawText', true);
	const writeText = functionSource('writeText');
	assert.match(drawText, /measureSharedTextSizeLimits\(orderedTextEntries\)/);
	assert.match(drawText, /sharedTextSizeLimit:sharedTextSizeLimits\[sharedGroup\]/);
	assert.match(writeText, /if \(!textObject\.measureOnly\)/);
	assert.match(writeText, /textObject\.sharedTextSizeLimit - fontSizeAdjustment/);
	assert.match(writeText, /fittedTextSize:startingTextSize \+ fontSizeAdjustment/);
});
