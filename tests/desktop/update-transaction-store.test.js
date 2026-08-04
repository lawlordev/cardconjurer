const assert = require('node:assert/strict');
const {mkdtemp, readFile, rm} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

test('update transactions are durable and retain inactive pack targets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-transaction-'));
  try {
    const {UpdateTransactionStore} = await import(pathToFileURL(path.resolve('dist/desktop/services/update-transaction-store.js')).href);
    const store = new UpdateTransactionStore(root);
    const transaction = store.begin({
      currentAppVersion: '1.0.0', targetAppVersion: '2.0.0', includesApp: true,
      packIds: ['standard'], snapshotPath: path.join(root, 'backups', 'snapshot')
    });
    store.write({...transaction, phase: 'staged', stagedPacks: [{id: 'standard', version: '2.0.0', sourceRoot: path.join(root, 'packs', 'standard', '2.0.0'), previousVersion: '1.0.0', previousSourceRoot: path.join(root, 'packs', 'standard', '1.0.0')}]});
    const recovered = store.read();
    assert.equal(recovered.phase, 'staged');
    assert.equal(recovered.stagedPacks[0].version, '2.0.0');
    const onDisk = JSON.parse(await readFile(path.join(root, 'staging', 'updates', 'transaction.json'), 'utf8'));
    assert.equal(onDisk.id, transaction.id);
  } finally { await rm(root, {recursive: true, force: true}); }
});
