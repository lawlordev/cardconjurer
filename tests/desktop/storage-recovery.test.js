const assert = require('node:assert/strict');
const {mkdtemp, rm} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

test('pre-update snapshots restore the prior workspace atomically', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-storage-recovery-'));
  const {StorageService} = await import(pathToFileURL(path.resolve('dist/desktop/services/storage-service.js')).href);
  const storage = new StorageService(root);
  try {
    const before = {sets:[{id:'before'}], cards:[], histories:{}, activeSetId:'before', revision:1};
    const after = {sets:[{id:'after'}], cards:[], histories:{}, activeSetId:'after', revision:2};
    await storage.save(before);
    const snapshot = await storage.snapshot('coordinated-update');
    await storage.save(after);
    await storage.restore(snapshot);
    assert.deepEqual(await storage.load(), before);
  } finally {
    await storage.close();
    await rm(root, {recursive: true, force: true});
  }
});
