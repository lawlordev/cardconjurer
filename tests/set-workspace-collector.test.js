const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');

function functionSource(name) {
	const start = workspace.indexOf(`async function ${name}(`);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = workspace.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < workspace.length; index++) {
		if (workspace[index] === '{') depth++;
		else if (workspace[index] === '}' && --depth === 0) return workspace.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

test('renumbering synchronizes the active collector number before redrawing', () => {
	const sync = functionSource('syncActiveCollectorNumber');
	assert.match(sync, /input\.value = nextNumber/);
	assert.match(sync, /card\.infoNumber = nextNumber/);
	assert.match(sync, /await bottomInfoEdited\(\)/);
	assert.match(sync, /else if \(typeof drawCard === 'function'\) drawCard\(\)/);
});

test('card edit and rarity renumbering both refresh the live collector number', () => {
	const capture = functionSource('captureActiveCard');
	const detail = functionSource('updateCardDetail');
	assert.match(capture, /if \(listOrderChanged\)[\s\S]*await syncActiveCollectorNumber\(updatedRecord\)/);
	assert.match(detail, /renumberSet\(set\.id\);\s*await syncActiveCollectorNumber/);
});
