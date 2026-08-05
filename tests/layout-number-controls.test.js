const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controls = require('../js/layoutNumberControls.js');
const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');
const creatorHtml = fs.readFileSync(path.join(__dirname, '../creator/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../css/style-9.css'), 'utf8');

function fakeNumberInput(value, step = '1') {
	return {
		value: String(value),
		step,
		min: '',
		max: '',
		disabled: false,
		readOnly: false,
		events: [],
		ownerDocument: {defaultView: {Event}},
		stepUp(amount) { this.value = String(Number(this.value) + Number(this.step) * amount); },
		stepDown(amount) { this.value = String(Number(this.value) - Number(this.step) * amount); },
		dispatchEvent(event) { this.events.push(event.type); }
	};
}

test('layout number steps emit live input events and respect exact step sizes', () => {
	const input = fakeNumberInput('100', '0.1');
	assert.equal(controls.stepInput(input, 1, 10), true);
	assert.equal(input.value, '101');
	assert.deepEqual(input.events, ['input']);
});

test('held layout adjustments stay sequential while Shift explicitly applies 10x steps', () => {
	assert.equal(controls.holdMultiplier(0, false), 1);
	assert.equal(controls.holdMultiplier(900, false), 1);
	assert.equal(controls.holdMultiplier(1800, false), 1);
	assert.equal(controls.holdMultiplier(0, true), 10);
});

test('held steps leave enough time for every debounced text preview to render', () => {
	const match = creator.match(/function drawTextBuffer\(delay=(\d+)\)/);
	assert.ok(match, 'drawTextBuffer should declare its live-render delay');
	assert.ok(
		controls.repeatIntervalMs > Number(match[1]),
		`the ${controls.repeatIntervalMs}ms repeat cadence must exceed the ${match[1]}ms text-render debounce`,
	);
});

test('static and card-specific layout inputs use the shared control and live text updates', () => {
	assert.match(creatorHtml, /\/js\/layoutNumberControls\.js\?v=20260805-issue-43-2/);
	assert.match(creator, /CardConjurerLayoutNumbers\?\.enhance\(document\)/);
	assert.match(creator, /CardConjurerLayoutNumbers\?\.enhance\(drawerBody\)/);
	assert.doesNotMatch(creator, /#textbox-editor-(?:x|y|width|height)'\)\.onchange/);
	assert.doesNotMatch(creator, /#frame-editor-(?:x|y|width|height|opacity)'\)\.onchange/);
	assert.match(creator, /sliderInput\.oninput = update/);
	assert.match(styles, /\.layout-number-stepper/);
	assert.match(styles, /\.layout-input-shell-standalone/);
	assert.match(styles, /::-webkit-inner-spin-button/);
});
