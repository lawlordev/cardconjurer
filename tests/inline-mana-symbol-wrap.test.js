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

test('inline mana symbols wrap when their full advance reaches the text boundary', () => {
	const context = {};
	vm.createContext(context);
	vm.runInContext(functionSource('inlineManaSymbolWouldOverflow'), context);

	assert.equal(context.inlineManaSymbolWouldOverflow(70, 20, 4, 100), false);
	assert.equal(context.inlineManaSymbolWouldOverflow(72, 20, 4, 100), true);
	assert.equal(context.inlineManaSymbolWouldOverflow(80, 20, 0, 100), true);
});

test('the text renderer defers an overflowing inline symbol until after the line flush', () => {
	const writeText = functionSource('writeText');
	assert.match(writeText, /inlineManaSymbolWouldOverflow\(currentX, manaSymbolWidth, manaSymbolSpacing, textWidth\)/);
	assert.match(writeText, /newLine = true;[\s\S]*pendingManaSymbol =/);
	assert.match(writeText, /if \(pendingManaSymbol\)[\s\S]*manaSymbolsToRender\.push\(pendingManaSymbol\.renderData\)/);
});
