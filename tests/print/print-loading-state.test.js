const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bridge = fs.readFileSync(path.join(__dirname, '../../js/desktopBridge.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../../css/style-9.css'), 'utf8');

function functionSource(name) {
	const functionStart = bridge.indexOf(`function ${name}(`);
	assert.notEqual(functionStart, -1, `${name} should exist`);
	const start = bridge.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
		? functionStart - 6
		: functionStart;
	const bodyStart = bridge.indexOf('{', functionStart);
	let depth = 0;
	for (let index = bodyStart; index < bridge.length; index++) {
		if (bridge[index] === '{') depth++;
		else if (bridge[index] === '}' && --depth === 0) return bridge.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

test('print rendering uses a blocking ZIP-style loading dialog', () => {
	const shell = functionSource('shell');
	const open = functionSource('openPrint');
	const show = functionSource('showPrintLoading');
	const hide = functionSource('hidePrintLoading');
	const close = functionSource('closePrint');

	assert.match(shell, /id="desktop-print-loading" class="sets-dialog sets-zip-dialog desktop-print-loading"/);
	assert.match(shell, /class="desktop-settings-loading"><span class="creator-loading-spinner" aria-hidden="true"><\/span>/);
	assert.match(shell, /class="desktop-inline-status desktop-settings-loading-copy" role="status">Loading Pages\.\.\.<\/p>/);
	assert.match(shell, /desktop-print-loading'\)\.addEventListener\('cancel', function\(event\) \{ event\.preventDefault\(\); \}\)/);
	assert.match(styles, /\.desktop-print-loading \.desktop-settings-loading \{ position: static; inset: auto; \}/);
	assert.match(show, /dialog\.showModal\(\)/);
	assert.match(hide, /dialog\.close\(\)/);
	assert.ok(open.indexOf('showPrintLoading()') < open.indexOf('captureActiveCard()'), 'the loading dialog should paint before card capture starts');
	assert.match(open, /finally \{\s*if \(token === printJobToken\) hidePrintLoading\(\);\s*\}/);
	assert.match(close, /hidePrintLoading\(\)/);
});
