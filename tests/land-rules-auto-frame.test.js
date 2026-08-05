const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('land rules text edits schedule automatic frame color updates', () => {
	const edit = functionSource('textEdited');
	assert.match(edit, /landRulesColorEdited = key === 'rules'/);
	assert.match(edit, /card\.text\?\.type\?\.text[\s\S]*\.toLowerCase\(\)\.includes\('land'\)/);
	assert.match(edit, /flipsideColorEdited \|\| landRulesColorEdited\)[\s\S]*autoFrameBuffer/);
});
