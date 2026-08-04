const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-app.yaml'), 'utf8');

test('application releases validate an existing tag and default to non-publishing mode', () => {
  assert.match(workflow, /publish:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(workflow, /actions\/checkout@v5[\s\S]*?ref: '\$\{\{ inputs\.tag \}\}'/);
  assert.match(workflow, /validate-release-request\.mjs/);
});

test('release request validation locks the tag and channel to package metadata', () => {
  const validator = path.join(__dirname, '../../scripts/validate-release-request.mjs');
  const valid = spawnSync(process.execPath, [validator, 'v0.1.0-beta.1', 'beta'], {encoding: 'utf8'});
  assert.equal(valid.status, 0, valid.stderr);
  const mismatched = spawnSync(process.execPath, [validator, 'v0.1.0-beta.2', 'beta'], {encoding: 'utf8'});
  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /does not match package version/);
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
