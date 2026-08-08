const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('frame-pack releases build from the requested immutable tag', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release-frame-packs.yaml'), 'utf8');
  const materializer = fs.readFileSync(path.join(__dirname, '../../scripts/materialize-ci-pack-assets.mjs'), 'utf8');
  assert.match(workflow, /actions\/checkout@v5[\s\S]*?ref: \$\{\{ inputs\.tag \}\}/);
  assert.match(workflow, /materialize-ci-pack-assets\.mjs/);
  assert.match(materializer, /sparse-checkout', 'add', '--stdin'/);
  assert.doesNotMatch(materializer, /--no-cone/);
  assert.match(workflow, /validate-frame-packs\.mjs[\s\S]*?--assets/);
  assert.match(workflow, /test -n "\$PREVIOUS_V2"/);
  assert.match(workflow, /test -n "\$PREVIOUS_V3" \|\| test "\$BOOTSTRAP_V3" = true/);
  assert.match(workflow, /--bootstrap-v3-from-v2/);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /set-symbols,keywords,standard/);
});

test('frame-pack release archives are split and checked below GitHub limits', () => {
  const builder = fs.readFileSync(path.join(__dirname, '../../scripts/build-frame-pack-release.mjs'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '../../desktop/services/pack-service.ts'), 'utf8');
  assert.match(builder, /GITHUB_RELEASE_ASSET_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/);
  assert.match(builder, /archiveBytes >= GITHUB_RELEASE_ASSET_LIMIT_BYTES/);
  assert.match(builder, /ARCHIVE_SOURCE_TARGET_BYTES = 256 \* 1024 \* 1024/);
  assert.match(builder, /frame-pack-ownership\.json/);
  assert.match(builder, /ids\.length > 1/);
  assert.match(builder, /schemaVersion: 2, packs: \[\]/);
  assert.match(builder, /schemaVersion: 3/);
  assert.match(builder, /bootstrapCatalogV3FromV2/);
  assert.match(builder, /does not carry every schema-2 pack history/);
  assert.match(builder, /selectedPackIds/);
  assert.match(builder, /fileMetadata/);
  assert.match(builder, /archives\.push/);
  assert.match(builder, /id === 'keywords'[\s\S]{0,100}\['js\/mseKeywordCatalog\.js'\]/);
  assert.match(service, /interface CatalogPack .*archives: CatalogArchive\[\]/);
  assert.match(service, /MAX_ARCHIVE_BYTES = 2 \* 1024 \* 1024 \* 1024/);
  assert.match(service, /archive\.archiveBytes > MAX_ARCHIVE_BYTES/);
});

test('legacy schema-2 catalogs bootstrap a complete, explicitly marked schema-3 history', async () => {
  const {bootstrapCatalogV3FromV2, minimumAppVersionForPack} = await import('../../scripts/lib/pack-catalog.mjs');
  const archive = {url: 'https://example.test/packs/part-01.zip', sha256: 'a'.repeat(64), archiveBytes: 123};
  const legacy = {schemaVersion: 2, packs: [{id: 'standard', version: '0.1.0', archives: [archive], archiveBytes: 123, installedBytes: 456}]};
  const result = bootstrapCatalogV3FromV2(legacy, '2026-08-08T00:00:00.000Z');

  assert.deepEqual(result, {
    schemaVersion: 3,
    generatedAt: '2026-08-08T00:00:00.000Z',
    rendererApiVersion: 1,
    packs: [{id: 'standard', versions: [{
      version: '0.1.0', packSchema: 3, rendererApiVersion: 1, minimumAppVersion: '0.1.0-beta.1', revoked: false,
      archives: [archive], archiveBytes: 123, installedBytes: 456,
      legacySource: {catalogSchemaVersion: 2, manifestDigestAvailable: false}
    }]}]
  });
  assert.notStrictEqual(result.packs[0].versions[0].archives[0], archive);
  assert.equal(minimumAppVersionForPack('keywords'), '0.1.0-beta.5');
  assert.equal(minimumAppVersionForPack('standard'), '0.1.0-beta.1');
});

test('schema-3 bootstrap rejects duplicate or incomplete legacy pack records', async () => {
  const {bootstrapCatalogV3FromV2} = await import('../../scripts/lib/pack-catalog.mjs');
  const pack = {id: 'standard', version: '0.1.0', archives: [{}], archiveBytes: 1, installedBytes: 1};
  assert.throws(() => bootstrapCatalogV3FromV2({schemaVersion: 2, packs: [pack, pack]}), /cannot be bootstrapped safely/);
  assert.throws(() => bootstrapCatalogV3FromV2({schemaVersion: 2, packs: [{...pack, archives: []}]}), /cannot be bootstrapped safely/);
});
