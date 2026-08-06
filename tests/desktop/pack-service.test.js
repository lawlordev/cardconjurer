const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {mkdirSync, mkdtempSync, rmSync, writeFileSync} = require('node:fs');
const JSZip = require('jszip');
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

test('required keyword pack installs independently and owns the runtime catalog', async (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'set-conjurer-keyword-pack-test-'));
  context.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(path.join(root, 'app', 'img', 'setSymbols'), {recursive: true});
  mkdirSync(path.join(root, 'app', 'img', 'frames'), {recursive: true});
  mkdirSync(path.join(root, 'app', 'js'), {recursive: true});
  writeFileSync(path.join(root, 'app', 'js', 'mseKeywordCatalog.js'), 'window.MSE_KEYWORD_CATALOG = [];\n');
  const {PackService} = await import(pathToFileURL(path.resolve('dist/desktop/services/pack-service.js')).href);
  const service = new PackService({
    userDataPath: path.join(root, 'user-data'),
    appRoot: path.join(root, 'app'),
    resourcesPath: path.join(root, 'resources'),
    packaged: false,
    currentVersion: '0.1.0-beta.4'
  });
  await service.install([]);
  assert.equal(service.hasRequiredPacks(), true);
  assert.deepEqual(service.list().filter((pack) => pack.required && pack.installed).map((pack) => pack.id), ['set-symbols', 'keywords', 'standard']);
  assert.equal(service.resolvePackAsset('/js/mseKeywordCatalog.js'), path.join(root, 'app', 'js', 'mseKeywordCatalog.js'));
});

test('keyword and set-symbol packs download, stage, and activate through the shared update lifecycle', async (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'set-conjurer-content-pack-update-test-'));
  context.after(() => rmSync(root, {recursive: true, force: true}));
  const userDataPath = path.join(root, 'user-data');
  const existingSetSymbols = path.join(root, 'existing-set-symbols');
  const existingStandard = path.join(root, 'existing-standard');
  mkdirSync(path.join(existingSetSymbols, 'img', 'setSymbols'), {recursive: true});
  mkdirSync(path.join(existingStandard, 'img', 'frames'), {recursive: true});
  mkdirSync(path.join(userDataPath, 'packs'), {recursive: true});
  writeFileSync(path.join(existingSetSymbols, 'img', 'setSymbols', 'old.svg'), '<svg>old</svg>');
  writeFileSync(path.join(userDataPath, 'packs', 'active.json'), `${JSON.stringify({schemaVersion: 2, packs: [
    {id: 'set-symbols', version: '1.0.0', sourceRoot: existingSetSymbols, installedAt: new Date().toISOString()},
    {id: 'standard', version: '1.0.0', sourceRoot: existingStandard, installedAt: new Date().toISOString()}
  ]})}\n`);

  async function archive(id, version, file, content) {
    const zip = new JSZip();
    zip.file(file, content);
    const body = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
    return {
      id, version, body,
      catalog: {
        id, version,
        archives: [{url: `https://example.test/${id}-${version}.zip`, sha256: createHash('sha256').update(body).digest('hex'), archiveBytes: body.length}],
        archiveBytes: body.length,
        installedBytes: Buffer.byteLength(content)
      }
    };
  }

  const keywordV1 = await archive('keywords', '1.0.0', 'js/mseKeywordCatalog.js', 'window.MSE_KEYWORD_CATALOG = [{name:"v1"}];\n');
  const keywordV2 = await archive('keywords', '1.1.0', 'js/mseKeywordCatalog.js', 'window.MSE_KEYWORD_CATALOG = [{name:"v2"}];\n');
  const symbolsV2 = await archive('set-symbols', '1.1.0', 'img/setSymbols/test/common.svg', '<svg>new</svg>');
  const archives = new Map([keywordV1, keywordV2, symbolsV2].map((item) => [item.catalog.archives[0].url, item.body]));
  const installedCatalog = (id) => ({id, version: '1.0.0', archives: [{url: `https://example.test/${id}-1.0.0.zip`, sha256: '0'.repeat(64), archiveBytes: 1}], archiveBytes: 1, installedBytes: 1});
  let currentCatalog = {schemaVersion: 2, packs: [installedCatalog('set-symbols'), keywordV1.catalog, installedCatalog('standard')]};
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/releases?')) return new Response(JSON.stringify([{draft: false, assets: [{name: 'frame-packs.json', browser_download_url: 'https://example.test/frame-packs.json'}]}]), {status: 200, headers: {'content-type': 'application/json'}});
    if (value.endsWith('/frame-packs.json')) return new Response(JSON.stringify(currentCatalog), {status: 200, headers: {'content-type': 'application/json'}});
    const body = archives.get(value);
    return body ? new Response(body, {status: 200, headers: {'content-length': String(body.length)}}) : new Response('missing', {status: 404});
  };

  const {PackService} = await import(pathToFileURL(path.resolve('dist/desktop/services/pack-service.js')).href);
  const service = new PackService({userDataPath, appRoot: path.join(root, 'app'), resourcesPath: path.join(root, 'resources'), packaged: true, currentVersion: '0.1.0-beta.4'});
  await service.refreshCatalog();
  await service.install(['keywords']);
  assert.match(require('node:fs').readFileSync(service.resolvePackAsset('/js/mseKeywordCatalog.js'), 'utf8'), /v1/);

  currentCatalog = {schemaVersion: 2, packs: [symbolsV2.catalog, keywordV2.catalog]};
  await service.refreshCatalog();
  assert.deepEqual(service.installedUpdates().map((pack) => pack.id), ['set-symbols', 'keywords']);
  const staged = await service.stageUpdates(['set-symbols', 'keywords']);
  assert.match(require('node:fs').readFileSync(service.resolvePackAsset('/js/mseKeywordCatalog.js'), 'utf8'), /v1/);
  assert.match(require('node:fs').readFileSync(service.resolvePackAsset('/img/setSymbols/old.svg'), 'utf8'), /old/);
  service.activateStaged(staged);
  assert.match(require('node:fs').readFileSync(service.resolvePackAsset('/js/mseKeywordCatalog.js'), 'utf8'), /v2/);
  assert.match(require('node:fs').readFileSync(service.resolvePackAsset('/img/setSymbols/test/common.svg'), 'utf8'), /new/);
});
