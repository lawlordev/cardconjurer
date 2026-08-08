const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-app.yaml'), 'utf8');
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')).version;

test('application releases validate an existing tag and default to non-publishing mode', () => {
  assert.match(workflow, /publish:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(workflow, /actions\/checkout@v5[\s\S]*?ref: '\$\{\{ inputs\.tag \}\}'/);
  assert.match(workflow, /validate-release-request\.mjs/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /validate-app-pack-compatibility\.mjs/);
  assert.doesNotMatch(workflow, /npm run packs:compile/);
});

test('release request validation locks the tag and channel to package metadata', () => {
  const validator = path.join(__dirname, '../../scripts/validate-release-request.mjs');
  const valid = spawnSync(process.execPath, [validator, `v${packageVersion}`, 'beta'], {encoding: 'utf8'});
  assert.equal(valid.status, 0, valid.stderr);
  const mismatched = spawnSync(process.execPath, [validator, `v${packageVersion}-mismatch`, 'beta'], {encoding: 'utf8'});
  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /does not match package version/);
});

test('packaged release branding follows the validated package prerelease channel', () => {
  const branding = require('../../dist/desktop/app-branding.js');
  assert.equal(branding.resolveAppBuildChannel(false, packageVersion), 'dev');
  assert.equal(branding.resolveAppBuildChannel(true, '1.2.3-beta.4'), 'beta');
  assert.equal(branding.resolveAppBuildChannel(true, '1.2.3'), 'stable');
  assert.equal(branding.appIconBaseName('dev'), 'set-conjurer-dev');
  assert.equal(branding.appIconBaseName('beta'), 'set-conjurer-beta');
  assert.equal(branding.appIconBaseName('stable'), 'set-conjurer');

  const forge = fs.readFileSync(path.join(__dirname, '../../forge.config.ts'), 'utf8');
  assert.match(forge, /resolveAppBuildChannel\(true, packageMetadata\.version\)/);
  assert.match(forge, /icon: packagedIcon/);
  assert.match(forge, /setupIcon: `\$\{packagedIcon\}\.ico`/);
});

test('channel icon sources use transparent PNGs with native macOS and Windows variants', () => {
  for (const name of ['set-conjurer', 'set-conjurer-beta', 'set-conjurer-dev']) {
    const base = path.join(__dirname, '../../resources/icons', name);
    const png = fs.readFileSync(`${base}.png`);
    assert.equal(png.readUInt32BE(16), 1024, `${name}.png width`);
    assert.equal(png.readUInt32BE(20), 1024, `${name}.png height`);
    assert.equal(png[25], 6, `${name}.png must use RGBA pixels`);
    assert.equal(fs.readFileSync(`${base}.icns`).subarray(0, 4).toString('ascii'), 'icns');
    assert.equal(fs.readFileSync(`${base}.ico`).readUInt16LE(0), 0);
    assert.equal(fs.readFileSync(`${base}.ico`).readUInt16LE(2), 1);
  }
});

test('stable application releases require an immutable frame-pack catalog pin', () => {
  const validator = path.join(__dirname, '../../scripts/validate-app-pack-compatibility.mjs');
  const beta = spawnSync(process.execPath, [validator, 'beta'], {encoding: 'utf8'});
  assert.equal(beta.status, 0, beta.stderr);
  const stable = spawnSync(process.execPath, [validator, 'stable'], {encoding: 'utf8'});
  assert.notEqual(stable.status, 0);
  assert.match(stable.stderr, /require an immutable known-good frame-pack catalog pin/);
});

test('Windows previews fall back explicitly until Azure signing is available', () => {
  assert.match(workflow, /options: \[auto, required, disabled\]/);
  assert.match(workflow, /AZURE_ARTIFACT_SIGNING_PROFILE is not configured/);
  assert.match(workflow, /UNSIGNED PREVIEW: Windows trust warnings are expected/);
  assert.match(workflow, /steps\.signing\.outputs\.enabled == 'true'/);
  assert.match(workflow, /Get-ChildItem -Path \$installerDir -Filter '\*\.nupkg'/);
  assert.match(workflow, /embedded signed Squirrel updater/);
});

test('macOS release artifacts are signed, notarized, stapled, and assessed', () => {
  assert.match(workflow, /codesign --verify --deep --strict/);
  assert.match(workflow, /notarytool submit/);
  assert.match(workflow, /stapler staple/);
  assert.match(workflow, /spctl --assess --type open/);
});
