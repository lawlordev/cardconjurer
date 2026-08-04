const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('frame-pack releases build from the requested immutable tag', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-frame-packs.yaml'), 'utf8');
  assert.match(workflow, /actions\/checkout@v5[\s\S]*?ref: \$\{\{ inputs\.tag \}\}/);
});

test('frame-pack release archives are split and checked below GitHub limits', () => {
  const builder = fs.readFileSync(path.join(__dirname, '../../scripts/build-frame-pack-release.mjs'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-service.ts'), 'utf8');
  assert.match(builder, /GITHUB_RELEASE_ASSET_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/);
  assert.match(builder, /archiveBytes >= GITHUB_RELEASE_ASSET_LIMIT_BYTES/);
  assert.match(builder, /schemaVersion: 2, packs: \[\]/);
  assert.match(builder, /archives\.push/);
  assert.match(service, /interface CatalogPack .*archives: CatalogArchive\[\]/);
  assert.match(service, /archive\.archiveBytes >= MAX_ARCHIVE_BYTES/);
});
