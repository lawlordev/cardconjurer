const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');

function functionSource(name) {
	const asyncStart = workspace.indexOf(`async function ${name}(`);
	const start = asyncStart === -1 ? workspace.indexOf(`function ${name}(`) : asyncStart;
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = workspace.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < workspace.length; index++) {
		if (workspace[index] === '{') depth++;
		else if (workspace[index] === '}' && --depth === 0) return workspace.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

test('card creation and deletion reuse the preview switch transition', () => {
	const transition = functionSource('runCardPreviewTransition');
	assert.match(transition, /beginCardPreviewTransition\(\)/);
	assert.match(transition, /await waitForCardPreviewTransitionPaint\(\)/);
	assert.match(transition, /finally[\s\S]*await finishCardPreviewTransition\(\)/);
	assert.match(functionSource('newCard'), /runCardPreviewTransition/);
	assert.match(functionSource('deleteCardAction'), /runCardPreviewTransition/);
});
