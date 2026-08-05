const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');
const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');
const creatorHtml = fs.readFileSync(path.join(__dirname, '../creator/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../css/style-9.css'), 'utf8');

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

test('the primary title field is presented before mana cost without disturbing other fields', () => {
	const context = {};
	vm.createContext(context);
	vm.runInContext(functionSource(creator, 'orderedTextFieldEntries'), context);

	const fields = {
		mana: {name: 'Mana Cost'},
		title: {name: 'Title'},
		type: {name: 'Type Line'},
		rules: {name: 'Rules Text'},
	};
	assert.deepEqual(
		Array.from(context.orderedTextFieldEntries(fields), entry => entry[0]),
		['title', 'mana', 'type', 'rules'],
	);
	assert.deepEqual(Object.keys(fields), ['mana', 'title', 'type', 'rules']);
});

test('rarity is rendered in the Text tab immediately after the Type Line field', () => {
	const renderTextFieldForm = functionSource(creator, 'renderTextFieldForm');
	const renderCardDetailsSummary = functionSource(workspace, 'renderCardDetailsSummary');
	assert.match(creatorHtml, /id='text-field-form'[\s\S]*id='text-rarity-field'/);
	assert.doesNotMatch(creatorHtml, /id='sets-card-details-summary'/);
	assert.match(renderTextFieldForm, /typeField\.after\(rarityField\)/);
	assert.match(renderCardDetailsSummary, /querySelector\('#text-rarity-field'\)/);
	assert.match(renderCardDetailsSummary, /data-card-detail="rarity"/);
	assert.match(styles, /\.creator-workspace \.text-field-card > \.workspace-select\s*{\s*grid-column:\s*1 \/ -1;/);
});
