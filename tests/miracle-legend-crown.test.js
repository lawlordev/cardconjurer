const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
const frameSearch = fs.readFileSync(path.join(__dirname, '../js/frameSearch.js'), 'utf8');

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

function loadFrameRegistry() {
	const source = fs.readFileSync(path.join(__dirname, '../js/frameRegistry.js'), 'utf8');
	const context = vm.createContext({window: {}});
	vm.runInContext(source, context);
	return context.window.FRAME_REGISTRY;
}

test('Miracle declares its legendary crown incompatibility', () => {
	const registry = loadFrameRegistry();
	assert.equal(registry.components.M15Miracle.incompatibleLayer, 'legend-crown');
});

test('an active Miracle component suppresses automatic legendary crown layers', () => {
	const context = {
		activeFrameComponentOptions: {miracle: {pack: 'M15Miracle', frame: null}},
		FRAME_REGISTRY: loadFrameRegistry()
	};
	vm.createContext(context);
	vm.runInContext(functionSource(autoFrame, 'automaticFrameLayerAllowed'), context);

	assert.equal(context.automaticFrameLayerAllowed('legend-crown'), false);
	assert.equal(context.automaticFrameLayerAllowed('holo-stamp'), true);
	assert.match(
		functionSource(autoFrame, 'buildAutoFrames'),
		/config\.supportsCrown && isLegendary && automaticFrameLayerAllowed\('legend-crown'\)/
	);
});

test('Miracle is unavailable when a legendary crown is already active', () => {
	const context = {
		activeFrameComponentOptions: {},
		FRAME_REGISTRY: loadFrameRegistry(),
		frameHasCustomizableLayer: layer => layer === 'legend-crown'
	};
	vm.createContext(context);
	vm.runInContext(functionSource(frameSearch, 'frameComponentConflictsWithActiveLayer'), context);

	assert.equal(context.frameComponentConflictsWithActiveLayer('M15Miracle'), true);
	context.activeFrameComponentOptions.miracle = {pack: 'M15Miracle', frame: null};
	assert.equal(context.frameComponentConflictsWithActiveLayer('M15Miracle'), false);
});
