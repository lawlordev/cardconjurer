const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Scryfall import applies the rarity-specific set symbol to the live card', () => {
	const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');
	const start = workspace.indexOf('async function importScryfallCard()');
	const end = workspace.indexOf('\n\tfunction readFile(', start);
	assert.notEqual(start, -1);
	assert.notEqual(end, -1);
	const importer = workspace.slice(start, end);

	assert.match(importer, /record\.rarity = importedRarity/);
	assert.match(importer, /symbolRarityInput\.value = hydrated\.infoRarity/);
	assert.match(importer, /uploadSetSymbol\(hydrated\.setSymbolSource\)/);
	assert.match(importer, /await waitForRenderableImage\(setSymbol\)/);
});
