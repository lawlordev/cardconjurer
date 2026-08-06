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
	assert.match(main, /SET_CONJURER_ALLOW_TEST_INSTANCE.*!app\.isPackaged/);
});

test('macOS folds the workspace app bar into hover-revealed native window controls', () => {
	const main = fs.readFileSync(path.join(__dirname, '../../desktop/main.ts'), 'utf8');
	const preload = fs.readFileSync(path.join(__dirname, '../../desktop/preload.ts'), 'utf8');
	const styles = fs.readFileSync(path.join(__dirname, '../../css/style-9.css'), 'utf8');
	assert.match(main, /process\.platform === 'darwin'[\s\S]{0,180}titleBarStyle: 'customButtonsOnHover'/);
	assert.match(main, /trafficLightPosition: \{x: 14, y: 22\}/);
	assert.match(preload, /document\.documentElement\.dataset\.desktopPlatform = desktopPlatform/);
	assert.match(styles, /grid-template-rows: 3\.65rem minmax\(0, 1fr\)/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\] \.creator-app-bar\s*\{[\s\S]{0,120}padding-left: 6\.75rem;[\s\S]{0,120}-webkit-app-region: drag;/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\] \.desktop-print-toolbar\s*\{[\s\S]{0,120}padding-left: 6\.75rem;[\s\S]{0,120}-webkit-app-region: drag;/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\] \.desktop-print-toolbar :is\([^)]+\)\s*\{\s*-webkit-app-region: no-drag;/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\] \.textbox-editor\s*\{\s*padding-top: 2\.5rem;/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\]::before[\s\S]{0,120}position: fixed;[\s\S]{0,120}top: 22px;[\s\S]{0,120}z-index: 6000;[\s\S]{0,180}box-shadow: 23px 0 #4a4a4d, 46px 0 #4a4a4d;/);
	assert.match(styles, /html\[data-desktop-platform='darwin'\] \.creator-app-bar :is\([^)]+\)\s*\{\s*-webkit-app-region: no-drag;/);
	assert.match(styles, /\.desktop-menu-action \{[^}]*top: var\(--workspace-panel-gutter\);[^}]*right: var\(--workspace-panel-gutter\);/);
});

test('desktop binary exports use validated native save bridges', () => {
	const contracts = fs.readFileSync(path.join(__dirname, '../../desktop/ipc/contracts.ts'), 'utf8');
	const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/file-service.ts'), 'utf8');
	const creator = fs.readFileSync(path.join(__dirname, '../../js/creator-23.js'), 'utf8');
	const workspace = fs.readFileSync(path.join(__dirname, '../../creator/index.html'), 'utf8');
	assert.match(contracts, /'png', 'jpg'/);
	assert.match(contracts, /Only binary exports may use base64 encoding/);
	assert.match(contracts, /archiveIdSchema = z\.string\(\)\.uuid\(\)/);
	assert.match(service, /Buffer\.from\(request\.content, 'base64'\)/);
	assert.match(service, /MAX_ARCHIVE_CHUNK_BYTES/);
	assert.match(service, /await session\.handle\.writeFile\(chunk\)/);
	assert.match(service, /filters: \[\{name: 'ZIP Archive'/);
	assert.doesNotMatch(service, /Buffer\.concat/);
	assert.match(creator, /setConjurerDesktop\.files\.saveExport/);
	assert.doesNotMatch(workspace, /Open in new tab/);
	assert.match(workspace, /<summary><span aria-hidden='true'>↑<\/span>Import Card/);
	assert.doesNotMatch(workspace, /class='textbox-editor-close'[^>]*onclick=/);
	assert.match(creator, /function closeTextboxEditorFromControl\(button\)/);
	assert.match(creator, /document\.addEventListener\('click',[\s\S]{0,180}closest\('\.textbox-editor-close'\)/);
	assert.match(workspace, /data-card-import-action='file'/);
	assert.match(workspace, /data-card-import-action='search'/);
	assert.doesNotMatch(workspace, /onclick=["'][^"']*(?:sets-card-import|openCardSearch)/);
	assert.doesNotMatch(workspace, /moveOrCopy\('copy'\)/);
});

test('downloaded packs verify checksums and block unsafe archive paths', () => {
	const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-service.ts'), 'utf8');
	const archive = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-archive.ts'), 'utf8');
	assert.match(archive, /createWriteStream/);
	assert.match(archive, /headers\.Range/);
	assert.match(archive, /hashFile\(partial\)/);
	assert.match(archive, /validateEntrySizes:\s*true/);
	assert.match(archive, /split\('\/'\)\.includes\('\.\.'\)/);
	assert.match(archive, /symbolic links are not allowed/);
	assert.doesNotMatch(service, /Buffer\.concat|JSZip/);
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
	const index = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
	const workspace = fs.readFileSync(path.join(__dirname, '../../js/setWorkspace.js'), 'utf8');
	assert.match(boot, /desktop-booting/);
	assert.match(boot, /SetConjurerBoot/);
	assert.match(index, /hx-trigger="doCreate from:body"/);
	assert.doesNotMatch(index, /Welcome to Card Conjurer/);
	assert.match(workspace, /SetConjurerBoot\.finish\(\)/);
});

test('set workspace tabs use CSP-safe delegated navigation', () => {
	const workspace = fs.readFileSync(path.join(__dirname, '../../js/setWorkspace.js'), 'utf8');
	assert.match(workspace, /data-set-tab=/);
	assert.match(workspace, /closest\('\[data-set-tab\]'\)/);
	assert.doesNotMatch(workspace, /onclick="CardConjurerSets\.selectTab/);
});

test('set and card workspace controls do not rely on CSP-blocked inline handlers', () => {
	const workspace = fs.readFileSync(path.join(__dirname, '../../js/setWorkspace.js'), 'utf8');
	assert.match(workspace, /data-set-field=/);
	assert.match(workspace, /data-set-action=/);
	assert.match(workspace, /addEventListener\('focusout'/);
	assert.doesNotMatch(workspace, /on(?:click|change|input|blur|submit|keydown|keyup|load|error)=["']/);
});

test('local developer packages seed every selectable content pack', () => {
	const seed = fs.readFileSync(path.join(__dirname, '../../scripts/build-local-pack-seed.mjs'), 'utf8');
	for (const id of ['set-symbols', 'keywords', 'standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom']) assert.match(seed, new RegExp(`['\"]${id}['\"]`));
	assert.match(seed, /requested === 'all'/);
});

test('set symbols and keywords are required independently released content packs', () => {
	const contracts = fs.readFileSync(path.join(__dirname, '../../desktop/ipc/contracts.ts'), 'utf8');
	const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-service.ts'), 'utf8');
	const main = fs.readFileSync(path.join(__dirname, '../../desktop/main.ts'), 'utf8');
	const release = fs.readFileSync(path.join(__dirname, '../../scripts/build-frame-pack-release.mjs'), 'utf8');
	const forge = fs.readFileSync(path.join(__dirname, '../../forge.config.ts'), 'utf8');
	assert.match(contracts, /PACK_IDS = \['set-symbols', 'keywords', 'standard'/);
	assert.match(service, /'set-symbols': \{displayName: 'Set Symbols'.*required: true/);
	assert.match(service, /keywords: \{displayName: 'Keywords'.*required: true/);
	assert.match(service, /REQUIRED_PACK_IDS: PackId\[\] = \['set-symbols', 'keywords', 'standard'\]/);
	assert.match(main, /relative\.startsWith\('\/img\/setSymbols\/'\)/);
	assert.match(main, /relative === '\/js\/mseKeywordCatalog\.js'/);
	assert.match(release, /id === 'set-symbols'/);
	assert.match(release, /path\.join\(root, 'img', 'setSymbols'\)/);
	assert.match(release, /id === 'keywords'[\s\S]{0,100}\['js\/mseKeywordCatalog\.js'\]/);
	assert.match(forge, /img\\\/setSymbols/);
	assert.match(forge, /mseKeywordCatalog/);
});

test('set-symbol controls use CSP-safe delegated handlers', () => {
	const workspace = fs.readFileSync(path.join(__dirname, '../../js/setWorkspace.js'), 'utf8');
	assert.match(workspace, /data-symbol-load-all/);
	assert.match(workspace, /data-symbol-upload/);
	assert.match(workspace, /data-symbol-clear/);
	assert.doesNotMatch(workspace, /onclick="CardConjurerSets\.loadSymbolsByCode/);
	assert.doesNotMatch(workspace, /onclick="CardConjurerSets\.clearSymbols/);
});
