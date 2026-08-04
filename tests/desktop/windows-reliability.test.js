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
  assert.match(main, /--squirrel-/);
  assert.match(main, /--createShortcut/);
  assert.match(main, /--removeShortcut/);
  assert.match(main, /setAppUserModelId\('com\.squirrel\.set_conjurer\.set-conjurer'\)/);
});

test('base package retains renderer-global frame assets', () => {
  const forge = source('forge.config.ts');
  for (const asset of ['cornerCutout', 'maskRightHalf', 'maskMiddleThird', 'serial']) assert.match(forge, new RegExp(asset));
});

test('update action is absent unless the current state is actionable', () => {
  const bridge = source('js/desktopBridge.js');
  const css = source('css/style-9.css');
  assert.match(bridge, /\['available','downloading','verifying','staged'\]/);
  assert.doesNotMatch(bridge, /\['available','downloading','verifying','staged','failed'\]/);
  assert.match(css, /\.desktop-update-action\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('damaged beta cards are snapshotted and repaired without touching valid frameless cards', () => {
  const workspace = source('js/setWorkspace.js');
  const creator = source('js/creator-23.js');
  assert.match(workspace, /repair-beta-card-layouts/);
  assert.match(workspace, /!record\.cardData\.text/);
  assert.match(workspace, /!Array\.isArray\(current\.frames\) \|\| !current\.frames\.length/);
  assert.match(creator, /textObject = textObject && typeof textObject === 'object'/);
});
