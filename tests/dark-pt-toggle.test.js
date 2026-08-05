const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const frameSearch = fs.readFileSync(path.join(__dirname, '../js/frameSearch.js'), 'utf8');

function functionSource(source, name) {
	const functionStart = source.indexOf(`function ${name}(`);
	assert.notEqual(functionStart, -1, `${name} should exist`);
	const start = source.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
		? functionStart - 6
		: functionStart;
	const bodyStart = source.indexOf('{', functionStart);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index++) {
		if (source[index] === '{') depth++;
		else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

function loadFrameRegistry() {
	const source = fs.readFileSync(path.join(__dirname, '../js/frameRegistry.js'), 'utf8');
	const context = vm.createContext({window: {}});
	vm.runInContext(source, context);
	return context.window.FRAME_REGISTRY;
}

function loadDarkPowerToughnessFrames() {
	return JSON.parse(fs.readFileSync(
		path.join(__dirname, '../generated/frame-definitions/M15DarkPT.json'),
		'utf8'
	)).frames;
}

test('dark P/T is a compiled regular-frame component', () => {
	const registry = loadFrameRegistry();
	const details = registry.components.M15DarkPT;

	assert.equal(registry.kind('M15DarkPT'), 'component');
	assert.equal(details.slot, 'power-toughness-variant');
	assert.equal(details.family, 'regular');
	assert.equal(details.requiresLayer, 'power-toughness');
	assert.equal(loadDarkPowerToughnessFrames().length, 8);
});

for (const scenario of [
	{label: 'colored', colors: ['R'], expected: 'Red Power/Toughness'},
	{label: 'colorless', colors: [], expected: 'Colorless Power/Toughness'}
]) {
	test(`dark P/T replaces the normal ${scenario.label} P/T layer`, async () => {
		const registry = loadFrameRegistry();
		const card = {
			text: {mana: {text: scenario.colors.length ? `{${scenario.colors[0]}}` : ''}},
			frames: [
				{name: 'Card Frame', src: '/frame.png'},
				{name: 'Normal Power/Toughness', src: '/normal-pt.png'},
				{name: 'Border', src: '/border.png'}
			]
		};
		let removedLayerCount = 0;
		const addedLayers = [];
		const frameList = {
			children: card.frames.map(() => ({remove() { removedLayerCount++; }}))
		};
		const context = {
			window: {card},
			card,
			activeFramePack: 'M15Regular-1',
			activeFrameCustomizationPack: null,
			activeFrameComponentOptions: {
				'power-toughness-variant': {pack: 'M15DarkPT', frame: null}
			},
			FRAME_REGISTRY: registry,
			frameCustomizeTypeObject: null,
			frameCustomizeTypeDefaults: null,
			frameFlipsideTextColors: () => [],
			frameHasCustomizableLayer: requirement => requirement === 'power-toughness',
			loadFrameComponentDefinitions: async pack => {
				assert.equal(pack, 'M15DarkPT');
				return loadDarkPowerToughnessFrames();
			},
			document: {querySelector: selector => selector === '#frame-list' ? frameList : null},
			addFrame: async (_unused, layer) => addedLayers.push(layer)
		};
		vm.createContext(context);
		vm.runInContext(functionSource(frameSearch, 'frameCustomizeColorName'), context);
		vm.runInContext(functionSource(frameSearch, 'applyActiveFrameComponents'), context);

		await context.applyActiveFrameComponents(scenario.colors, 'Creature', 0);

		assert.equal(removedLayerCount, 1);
		assert.equal(card.frames.filter(frame => /power\s*\/\s*toughness/i.test(frame.name)).length, 1);
		assert.equal(card.frames[0].name, scenario.expected);
		assert.equal(card.frames[0].frameCustomizeSlot, 'power-toughness-variant');
		assert.match(card.frames[0].src, /m15NicknamePT[RC]\.png$/);
		assert.equal(card.frames[0].masks.length, 0);
		assert.equal(addedLayers.length, 1);
	});
}
