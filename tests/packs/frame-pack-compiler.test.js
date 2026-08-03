const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('every semantic component pack has a compiled declarative definition', () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../generated/frame-definitions/manifest.json'), 'utf8'));
	assert.equal(manifest.failed.length, 0);
	assert.ok(manifest.compiled.length >= 37);
	for (const item of manifest.compiled) {
		const payload = JSON.parse(fs.readFileSync(path.join(__dirname, `../../generated/frame-definitions/${item.pack}.json`), 'utf8'));
		assert.equal(payload.pack, item.pack);
		assert.ok(Array.isArray(payload.frames));
	}
});
