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

test('renumbering synchronizes the active collector number before redrawing', async () => {
	const input = {value: '0001'};
	const card = {infoNumber: '0001'};
	let renderCount = 0;
	const syncActiveCollectorNumber = new Function('document', 'card', 'bottomInfoEdited', 'drawCard',
		`${functionSource('syncActiveCollectorNumber')}; return syncActiveCollectorNumber;`
	)(
		{querySelector: selector => selector === '#info-number' ? input : null},
		card,
		async () => { card.infoNumber = input.value; renderCount++; },
		() => { renderCount++; }
	);

	assert.equal(await syncActiveCollectorNumber({collectorNumber: '0002'}), true);
	assert.equal(input.value, '0002');
	assert.equal(card.infoNumber, '0002');
	assert.equal(renderCount, 1);
});

test('card edit and rarity renumbering both refresh the live collector number', () => {
	const capture = functionSource('captureActiveCard');
	const detail = functionSource('updateCardDetail');
	assert.match(capture, /if \(listOrderChanged\)[\s\S]*await syncActiveCollectorNumber\(updatedRecord\)/);
	assert.match(detail, /renumberSet\(set\.id\);\s*await syncActiveCollectorNumber/);
});
