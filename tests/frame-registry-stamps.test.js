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
