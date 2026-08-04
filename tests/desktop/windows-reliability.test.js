const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(relative) {
  return fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');
}

test('onboarding obtains the public catalog before rendering selectable packs', () => {
  const bridge = source('js/desktopBridge.js');
  const contracts = source('desktop/ipc/contracts.ts');
  assert.match(contracts, /refresh\(\): Promise<PackStatus\[\]>/);
  assert.match(bridge, /await api\.packs\.refresh\(\)/);
  assert.match(bridge, /Retry pack list/);
  assert.match(bridge, /pack\.archiveBytes/);
  assert.match(bridge, /Total download:/);
});

test('onboarding presents one aggregate operation progress bar', () => {
  const bridge = source('js/desktopBridge.js');
  const contracts = source('desktop/ipc/contracts.ts');
  const service = source('desktop/services/pack-service.ts');
  assert.match(contracts, /receivedBytes: number;\s*totalBytes: number;/);
  assert.doesNotMatch(contracts, /PackProgress[\s\S]{0,240}id: PackId/);
  assert.match(bridge, /progress\.receivedBytes/);
  assert.match(bridge, /progress\.totalBytes/);
  assert.match(service, /#lastPercent/);
  assert.match(service, /Math\.max\(this\.#lastPercent/);
});

test('Windows Squirrel lifecycle creates launch shortcuts and uses a stable AUMID', () => {
  const main = source('desktop/main.ts');
  const forge = source('forge.config.ts');
  assert.match(main, /--squirrel-/);
  assert.match(main, /--createShortcut/);
  assert.match(main, /--removeShortcut/);
  assert.doesNotMatch(main, /startsWith\('--squirrel-'\)/);
  assert.match(main, /setTimeout\(\(\) => app\.quit\(\), 1_000\)/);
  assert.match(main, /WINDOWS_APP_USER_MODEL_ID = 'com\.squirrel\.set_conjurer\.set-conjurer'/);
  assert.match(forge, /SquirrelAwareVersion: '1'/);
  assert.match(forge, /markSquirrelAware/);
});

test('base package retains renderer-global frame assets', () => {
	const forge = source('forge.config.ts');
	const config = JSON.parse(source('packs/config.json'));
	for (const asset of ['cornerCutout.png', 'maskRightHalf.png', 'maskMiddleThird.png', 'serial.png']) assert.ok(config.baseRuntimeAssets.some((value) => value.endsWith(asset)));
	assert.match(forge, /packConfig\.baseRuntimeAssets/);
});

test('sparse Electron fixture supplies derived frame thumbnails', () => {
  const smoke = source('scripts/test-electron.mjs');
  assert.match(smoke, /asset\.replace\(\/\\\.png\$\/i, 'Thumb\.png'\)/);
});

test('update action is absent unless the current state is actionable', () => {
  const bridge = source('js/desktopBridge.js');
  const css = source('css/style-9.css');
  assert.match(bridge, /\['available','downloading','verifying','staged'\]/);
  assert.doesNotMatch(bridge, /\['available','downloading','verifying','staged','failed'\]/);
  assert.match(css, /\.desktop-update-action\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('installed pack updates are presented only through the consolidated transaction', () => {
  const bridge = source('js/desktopBridge.js');
  const main = source('desktop/main.ts');
  const coordinator = source('desktop/services/update-coordinator.ts');
  assert.match(bridge, /pack\.installed && pack\.updateAvailable[\s\S]{0,160}Update available/);
  assert.doesNotMatch(bridge, /pack\.updateAvailable[\s\S]{0,300}data-install-pack/);
  assert.match(main, /new UpdateCoordinator/);
  assert.match(coordinator, /stageUpdates/);
  assert.match(coordinator, /activateStaged/);
  assert.match(main, /storage!\.snapshot\(`update-\$\{Date\.now\(\)\}`\)/);
});

test('damaged beta cards are snapshotted and repaired without touching valid frameless cards', () => {
  const workspace = source('js/setWorkspace.js');
  const creator = source('js/creator-23.js');
  assert.match(workspace, /repair-beta-card-layouts/);
  assert.match(workspace, /!record\.cardData\.text/);
  assert.match(workspace, /!Array\.isArray\(current\.frames\) \|\| !current\.frames\.length/);
  assert.match(creator, /textObject = textObject && typeof textObject === 'object'/);
});
