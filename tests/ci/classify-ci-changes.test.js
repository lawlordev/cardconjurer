const assert = require('node:assert/strict');
const test = require('node:test');

const ownership = import('../../scripts/lib/pack-ownership.mjs');

const graph = {
  packIds: ['set-symbols', 'standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom'],
  baseRuntimeAssets: ['img/frames/cornerCutout.png'],
  packs: [],
  sourceConsumers: {'js/frames/packM15Regular-1.js': ['standard']},
  prefixConsumers: {'img/frames/m15/': ['standard'], 'img/frames/shared/': ['standard', 'tokens'], 'img/setSymbols/': ['set-symbols']}
};

test('classifies ordinary application and packaging-sensitive changes', async () => {
  const {classifyPaths} = await ownership;
  assert.deepEqual(classifyPaths(['css/style-9.css'], graph).packs, []);
  assert.equal(classifyPaths(['css/style-9.css'], graph).app, true);
  assert.equal(classifyPaths(['desktop/main.ts'], graph).package, true);
});

test('routes frame definitions and payloads through logical ownership', async () => {
  const {classifyPaths} = await ownership;
  assert.deepEqual(classifyPaths(['js/frames/packM15Regular-1.js'], graph).packs, ['standard']);
  assert.deepEqual(classifyPaths(['img/frames/shared/file.png'], graph).packs, ['standard', 'tokens']);
  assert.deepEqual(classifyPaths(['img/setSymbols/ABC/common.svg'], graph).packs, ['set-symbols']);
});

test('keeps base runtime assets in the application lane and fails unknown payloads closed', async () => {
  const {classifyPaths} = await ownership;
  const base = classifyPaths(['img/frames/cornerCutout.png'], graph);
  assert.equal(base.package, true);
  assert.deepEqual(base.packs, []);
  const unknown = classifyPaths(['img/frames/new-family/file.png'], graph);
  assert.equal(unknown.unknownPackPath, true);
  assert.equal(unknown.allPacks, true);
});

test('classifies both sides of a rename supplied by the caller', async () => {
  const {classifyPaths} = await ownership;
  const result = classifyPaths(['img/frames/m15/old.png', 'img/frames/shared/new.png'], graph);
  assert.deepEqual(result.packs, ['standard', 'tokens']);
});
