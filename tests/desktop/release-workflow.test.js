const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const zlib = require('node:zlib');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-app.yaml'), 'utf8');
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')).version;
const releaseNotes = path.join(__dirname, `../../docs/releases/v${packageVersion}.md`);

function pngAlphaBounds(file) {
  const png = fs.readFileSync(file);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  assert.notEqual(bytesPerPixel, 0, `${file} must use RGBA or grayscale-alpha pixels`);
  const idat = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bytesPerPixel;
  let previous = Buffer.alloc(stride);
  let inputOffset = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[inputOffset];
    inputOffset += 1;
    const row = Buffer.alloc(stride);
    for (let index = 0; index < stride; index += 1) {
      const raw = encoded[inputOffset + index];
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const above = previous[index];
      const upperLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2)
        : filter === 4 ? paeth(left, above, upperLeft)
        : NaN;
      assert.equal(Number.isNaN(predictor), false, `${file} uses unknown PNG filter ${filter}`);
      row[index] = (raw + predictor) & 0xff;
    }
    inputOffset += stride;
    const alphaOffset = colorType === 6 ? 3 : 1;
    for (let x = 0; x < width; x += 1) {
      if (row[(x * bytesPerPixel) + alphaOffset] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    previous = row;
  }
  return {width: maxX - minX + 1, height: maxY - minY + 1, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2};
}

test('application releases validate an existing tag and default to non-publishing mode', () => {
  assert.match(workflow, /publish:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(workflow, /actions\/checkout@v5[\s\S]*?ref: '\$\{\{ inputs\.tag \}\}'/);
  assert.match(workflow, /validate-release-request\.mjs/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /validate-app-pack-compatibility\.mjs/);
  assert.doesNotMatch(workflow, /npm run packs:compile/);
  assert.match(workflow, /options: \[required, auto, disabled\][\s\S]*?default: required/);
  assert.match(workflow, /Require signed Windows artifacts for publication[\s\S]*?if: inputs\.publish[\s\S]*?test "\$WINDOWS_SIGNING" = required/);
  assert.match(workflow, /release_note="docs\/releases\/\$\{\{ inputs\.tag \}\}\.md"/);
  assert.match(workflow, /cp "\$release_note" release-notes\.md/);
  assert.match(workflow, /find release-assets -type f ! -name SHA256SUMS/);
  assert.equal(fs.existsSync(releaseNotes), true, `missing reviewed release notes: ${releaseNotes}`);
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
  const betaBounds = pngAlphaBounds(path.join(__dirname, '../../resources/icons/set-conjurer-beta.png'));
  const devBounds = pngAlphaBounds(path.join(__dirname, '../../resources/icons/set-conjurer-dev.png'));
  assert.ok(Math.abs(betaBounds.width - devBounds.width) <= 4, `Beta and Dev Dock widths diverge: ${JSON.stringify({betaBounds, devBounds})}`);
  assert.ok(Math.abs(betaBounds.height - devBounds.height) <= 4, `Beta and Dev Dock heights diverge: ${JSON.stringify({betaBounds, devBounds})}`);
  assert.ok(Math.abs(betaBounds.centerX - devBounds.centerX) <= 4 && Math.abs(betaBounds.centerY - devBounds.centerY) <= 4, `Beta and Dev Dock centers diverge: ${JSON.stringify({betaBounds, devBounds})}`);
});

test('stable application releases require an immutable frame-pack catalog pin', () => {
  const validator = path.join(__dirname, '../../scripts/validate-app-pack-compatibility.mjs');
  const beta = spawnSync(process.execPath, [validator, 'beta'], {encoding: 'utf8'});
  assert.equal(beta.status, 0, beta.stderr);
  const stable = spawnSync(process.execPath, [validator, 'stable'], {encoding: 'utf8'});
  assert.notEqual(stable.status, 0);
  assert.match(stable.stderr, /require an immutable known-good frame-pack catalog pin/);
});

test('Windows publication requires Azure signing while previews retain explicit fallback modes', () => {
  assert.match(workflow, /options: \[required, auto, disabled\]/);
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

test('full-checkout packages exclude every legacy launcher variant', () => {
  const forge = fs.readFileSync(path.join(__dirname, '../../forge.config.ts'), 'utf8');
  assert.match(forge, /\^\\\/launcher\[\^\/\]\*\(\?:\\\/\|\$\)\//);
});
