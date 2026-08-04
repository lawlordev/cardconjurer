const test = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, rmSync} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const LEGACY_ARCHIVE_BYTES = 1_040_748_469;
const MAX_GITHUB_RELEASE_ASSET_BYTES = 2 * 1024 * 1024 * 1024;

function catalog(archiveBytes) {
  return {
    schemaVersion: 2,
    packs: [{
      id: 'standard',
      version: '0.1.0',
      archives: [{
        url: 'https://github.com/lawlordev/cardconjurer/releases/download/packs-v0.1.0/standard.zip',
        sha256: '0'.repeat(64),
        archiveBytes
      }],
      archiveBytes,
      installedBytes: 1024
    }]
  };
}

async function refreshWithCatalog(context, value) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'set-conjurer-pack-service-test-'));
  context.after(() => rmSync(root, {recursive: true, force: true}));
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes('/releases?')
      ? [{draft: false, assets: [{name: 'frame-packs.json', browser_download_url: 'https://example.test/frame-packs.json'}]}]
      : value
  });
  const {PackService} = await import(pathToFileURL(path.resolve('dist/desktop/services/pack-service.js')).href);
  const service = new PackService({
    userDataPath: path.join(root, 'user-data'),
    appRoot: root,
    resourcesPath: path.join(root, 'resources'),
    packaged: true,
    currentVersion: '0.1.0-beta.3'
  });
  return service.refreshCatalog();
}

test('catalog accepts legacy one-gigabyte archive parts from packs-v0.1.0', async (context) => {
  const statuses = await refreshWithCatalog(context, catalog(LEGACY_ARCHIVE_BYTES));
  const standard = statuses.find((item) => item.id === 'standard');
  assert.equal(standard.available, true);
  assert.equal(standard.archiveBytes, LEGACY_ARCHIVE_BYTES);
});

test('catalog still rejects archives beyond GitHub release asset limits', async (context) => {
  await assert.rejects(
    refreshWithCatalog(context, catalog(MAX_GITHUB_RELEASE_ASSET_BYTES + 1)),
    /archive exceeds the application safety limit/
  );
});
