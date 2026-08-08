const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFrameRegistry() {
	const source = fs.readFileSync(path.join(__dirname, '../js/frameRegistry.js'), 'utf8');
	const context = vm.createContext({window: {}});
	vm.runInContext(source, context);
	return context.window.FRAME_REGISTRY;
}

function functionSource(source, name) {
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

test('tall planeswalker profiles use planeswalker holo stamps', () => {
	const registry = loadFrameRegistry();
	const expectedBounds = {x: 0.4394, y: 0.9015, width: 0.1214, height: 0.051};

	for (const profile of ['PlaneswalkerTall', 'PlaneswalkerTallBorderless']) {
		const stamp = registry.stampFor(profile, 'Multicolored');
		assert.equal(stamp.name, 'Multicolored Holo Stamp');
		assert.equal(stamp.src, '/img/frames/planeswalker/holo/m.png');
		assert.deepEqual({...stamp.bounds}, expectedBounds);
	}
});

test('automatic frame selection resolves land and planeswalker stamps without a missing color variable', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const registry = loadFrameRegistry();
	const context = vm.createContext({FRAME_REGISTRY: registry});
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStamp'), context);
	vm.runInContext(functionSource(autoFrame, 'automaticHoloStampColorForFrame'), context);

	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Blue Land Frame'}}, 'Land'), 'Blue');
	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Multicolored Land Frame'}}, 'Legendary Land'), 'Multicolored');
	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Land Frame'}}, 'Land'), 'Land');
	assert.equal(context.automaticHoloStampColorForFrame('Blue', {item: {name: 'Red Frame'}}, 'Creature'), 'Blue');

	const landStamp = context.selectAutomaticHoloStamp([
		{name: 'Blue Holo Stamp', src: '/blue.png', bounds: {x: 1}},
		{name: 'Land Holo Stamp', src: '/land.png', bounds: {x: 1}},
	], 'M15Regular-1', 'Blue');
	assert.equal(landStamp.name, 'Blue Holo Stamp');
	assert.deepEqual(Array.from(landStamp.masks), []);
	assert.equal(context.selectAutomaticHoloStamp([
		{name: 'Blue Land Holo Stamp', src: '/wrong-pack.png'},
	], 'M15Regular-1', 'Land'), null);

	const planeswalkerStamp = context.selectAutomaticHoloStamp([], 'PlaneswalkerTall', 'Multicolored');
	assert.equal(planeswalkerStamp.name, 'Multicolored Holo Stamp');
	assert.equal(planeswalkerStamp.src, '/img/frames/planeswalker/holo/m.png');
	assert.match(functionSource(autoFrame, 'autoFrameFromAvailableFrames'), /automaticHoloStampColorForFrame\(desiredColor, selectedVariant, typeLine\)/);
	assert.match(functionSource(autoFrame, 'autoFrameFromAvailableFrames'), /selectAutomaticHoloStamp\(frameOptions, selectedProfile, stampColor\)/);
});

test('lands inherit their holo stamp color from the rendered frame', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const context = vm.createContext({});
	vm.runInContext(functionSource(autoFrame, 'automaticHoloStampColors'), context);

	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'UL'}, 'Land')), ['U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'RL'}, 'Land')), ['R']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'ML'}, 'Legendary Land')), ['M']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'L'}, 'Land')), ['L']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'UL', pinlineRight: 'GL'}, 'Land')), ['G', 'U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'U'}, 'Creature')), ['U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'U', pinlineRight: 'G'}, 'Creature')), ['G', 'U']);
	assert.match(autoFrame, /automaticHoloStampColors\(properties, type_line\)/);
});
