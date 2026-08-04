const assert = require('node:assert/strict');
const {mkdtemp, readFile, readdir, rm} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

test('one thousand cards share content-addressed art without hydrating base64 on load', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-card-scaling-'));
  const {StorageService} = await import(pathToFileURL(path.resolve('dist/desktop/services/storage-service.js')).href);
  const storage = new StorageService(root);
  try {
	const sourcePng = await readFile(path.resolve('core/favicon-32x32.png'));
    const bytes = Buffer.concat([sourcePng, Buffer.alloc(2 * 1024 * 1024 - sourcePng.length, 0x5a)]);
    const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
    const ingested = await storage.ingestAssets({artSource: dataUrl, duplicate: dataUrl});
    assert.match(ingested.artSource, /^set-conjurer:\/\/user-asset\/[a-f0-9]{64}\.png$/);
    assert.equal(ingested.duplicate, ingested.artSource);
	await assert.rejects(() => storage.ingestAssets({artSource: 'data:image/png;base64,' + Buffer.alloc(64, 0x5a).toString('base64')}), /does not match/);

    const cards = Array.from({length: 1000}, (_, index) => ({
      id: `card-${index}`,
      setId: 'set-1',
      cardData: {artSource: ingested.artSource, text: {title: {text: `Card ${index}`}}},
      thumbnail: ''
    }));
    const state = {sets: [{id: 'set-1', activeCardId: 'card-0'}], cards, histories: {'set-1': {entries: [], cursor: 0}}, activeSetId: 'set-1', revision: 1};
    await storage.save(state);
	const edited = {...cards[0], cardData: {...cards[0].cardData, text: {title: {text: 'Edited card'}}}};
	await storage.applyMutation({sets: [], cards: [edited], histories: {'set-1': {entries: [{label: 'Edit', delta: {kind: 'workspace-delta-v1', sets: [], cards: [{id: 'card-0', before: cards[0], after: edited}]}}], cursor: 1}}, deletedSetIds: [], deletedCardIds: [], activeSetId: 'set-1', revision: 2});
    const loaded = await storage.load();
    assert.equal(loaded.cards.length, 1000);
	assert.equal(loaded.cards[0].cardData.text.title.text, 'Edited card');
    assert.equal(loaded.cards[999].cardData.artSource, ingested.artSource);
    assert.equal(JSON.stringify(loaded).includes('data:image'), false);

    const materialized = await storage.materializeAssets({artSource: ingested.artSource});
    assert.equal(materialized.artSource, dataUrl);
    assert.equal(storage.resolveAsset(new URL(ingested.artSource).pathname) !== null, true);
    assert.equal(storage.resolveAsset('/../../secrets.png'), null);

    const assetDirectories = await readdir(path.join(root, 'assets', 'sha256'));
    assert.equal(assetDirectories.length, 1);
    const assetFiles = await readdir(path.join(root, 'assets', 'sha256', assetDirectories[0]));
    assert.equal(assetFiles.length, 1);
  } finally {
    await storage.close();
    await rm(root, {recursive: true, force: true});
  }
});
