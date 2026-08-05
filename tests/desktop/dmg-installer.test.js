const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const forgeConfig = fs.readFileSync(path.join(root, 'forge.config.ts'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function pngDimensions(relativePath) {
  const image = fs.readFileSync(path.join(root, relativePath));
  assert.deepEqual(image.subarray(1, 4), Buffer.from('PNG'));
  return {width: image.readUInt32BE(16), height: image.readUInt32BE(20)};
}

test('macOS DMG uses the branded installer background and deliberate icon layout', () => {
  assert.match(forgeConfig, /background: path\.resolve\('resources\/dmg\/set-conjurer-background\.png'\)/);
  assert.match(forgeConfig, /iconSize: 112/);
  assert.match(forgeConfig, /x: 476, y: 326, type: 'link', path: '\/Applications'/);
  assert.match(forgeConfig, /x: 182, y: 326, type: 'file', path: options\.appPath/);
  assert.deepEqual(pngDimensions('resources/dmg/set-conjurer-background.png'), {width: 658, height: 498});
  assert.deepEqual(pngDimensions('resources/dmg/set-conjurer-background@2x.png'), {width: 1316, height: 996});
});

test('macOS installer preview builds only the DMG and opens the resulting disk image', () => {
  assert.equal(packageJson.scripts['preview:mac-installer'], 'node scripts/preview-mac-installer.mjs');
  const previewScript = fs.readFileSync(path.join(root, 'scripts/preview-mac-installer.mjs'), 'utf8');
  assert.match(previewScript, /requires Node 24 or 25/);
  assert.match(previewScript, /--targets=dmg/);
  assert.match(previewScript, /spawnSync\('open', \[diskImage\]/);
});
