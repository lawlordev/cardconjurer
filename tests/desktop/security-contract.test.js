const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('desktop window is sandboxed and preload is context-isolated', () => {
	const main = fs.readFileSync(path.join(__dirname, '../../desktop/main.ts'), 'utf8');
	assert.match(main, /nodeIntegration:\s*false/);
	assert.match(main, /contextIsolation:\s*true/);
	assert.match(main, /sandbox:\s*true/);
	assert.match(main, /setWindowOpenHandler/);
	assert.match(main, /validateSender/);
});

test('downloaded packs verify checksums and block unsafe archive paths', () => {
	const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-service.ts'), 'utf8');
	assert.match(service, /sha256/);
	assert.match(service, /checkCRC32:\s*true/);
	assert.match(service, /split\('\/'\)\.includes\('\.\.'\)/);
	assert.match(service, /symbolic links are not allowed/);
});

test('unpublished optional frame packs cannot be selected in desktop UI', () => {
	const bridge = fs.readFileSync(path.join(__dirname, '../../js/desktopBridge.js'), 'utf8');
	assert.match(bridge, /pack\.required \|\| !pack\.available/);
	assert.match(bridge, /Not available in this build yet/);
});

test('development mode reloads renderer changes without weakening packaged builds', () => {
	const main = fs.readFileSync(path.join(__dirname, '../../desktop/main.ts'), 'utf8');
	assert.match(main, /if \(app\.isPackaged\) return/);
	assert.match(main, /reloadIgnoringCache/);
});

test('desktop boot hides the legacy page until the Sets workspace is ready', () => {
	const boot = fs.readFileSync(path.join(__dirname, '../../js/desktopBoot.js'), 'utf8');
	const workspace = fs.readFileSync(path.join(__dirname, '../../js/setWorkspace.js'), 'utf8');
	assert.match(boot, /desktop-booting/);
	assert.match(boot, /SetConjurerBoot/);
	assert.match(workspace, /SetConjurerBoot\.finish\(\)/);
});

test('local developer packages seed every selectable frame pack', () => {
	const seed = fs.readFileSync(path.join(__dirname, '../../scripts/build-local-pack-seed.mjs'), 'utf8');
	for (const id of ['standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom']) assert.match(seed, new RegExp(`['\"]${id}['\"]`));
	assert.match(seed, /requested === 'all'/);
});
