const assert = require('node:assert/strict');
const {mkdtemp, rm} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

const baseState = () => ({phase:'idle', progress:0, message:'Up to date', availableVersion:null, includesApp:false, packIds:[], transactionId:null, totalBytes:0, completedBytes:0, lastCheckedAt:null, recoverable:false, items:[]});

class FakeAppUpdates {
  constructor(currentVersion, targetVersion) { this.currentVersion = currentVersion; this.targetVersion = targetVersion; this.listener = () => {}; }
  onState(listener) { this.listener = listener; }
  channel() { return 'stable'; }
  setChannel(channel) { return channel; }
  stagedInstaller() { return null; }
  async check() {
    if (!this.targetVersion) return baseState();
    const state = {...baseState(), phase:'available', message:'App update available', availableVersion:this.targetVersion, includesApp:true, totalBytes:100, items:[{kind:'app', id:'app', displayName:'Set Conjurer', currentVersion:this.currentVersion, targetVersion:this.targetVersion, bytes:100, phase:'available', error:null}]};
    this.listener(state); return state;
  }
  async begin() { const state = {...await this.check(), phase:'staged', progress:100}; this.listener(state); return state; }
}

class FakePacks {
  constructor() { this.activated = []; this.listener = () => {}; }
  onProgress(listener) { this.listener = listener; }
  async refreshCatalog() { return []; }
  installedUpdates() { return [
    {id:'set-symbols', displayName:'Set Symbols', installed:true, installedVersion:'1.0.0', availableVersion:'2.0.0', archiveBytes:10, updateAvailable:true},
    {id:'keywords', displayName:'Keywords', installed:true, installedVersion:'1.0.0', availableVersion:'2.0.0', archiveBytes:5, updateAvailable:true},
    {id:'standard', displayName:'Standard', installed:true, installedVersion:'1.0.0', availableVersion:'2.0.0', archiveBytes:50, updateAvailable:true}
  ]; }
  async stageUpdates(ids) { this.listener({phase:'downloading', percent:100, message:'Packs staged', receivedBytes:65, totalBytes:65}); return ids.map((id) => ({id, version:'2.0.0', sourceRoot:`inactive-${id}-2`, previousVersion:'1.0.0', previousSourceRoot:`active-${id}-1`})); }
  activateStaged(targets) { this.activated.push(...targets); }
}

test('coordinator exposes one installed-only plan and activates it only at startup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-coordinator-'));
  try {
    const {UpdateCoordinator} = await import(pathToFileURL(path.resolve('dist/desktop/services/update-coordinator.js')).href);
    const packs = new FakePacks();
    const storage = {restore: async () => { throw new Error('restore should not run'); }};
    const coordinator = new UpdateCoordinator({userDataPath:root, currentVersion:'1.0.0', packs, appUpdates:new FakeAppUpdates('1.0.0','2.0.0'), storage});
    const available = await coordinator.check();
    assert.equal(available.includesApp, true);
    assert.deepEqual(available.packIds, ['set-symbols', 'keywords', 'standard']);
    assert.equal(available.items.length, 4);
    const staged = await coordinator.begin('snapshot-path');
    assert.equal(staged.phase, 'staged');
    assert.equal(packs.activated.length, 0);

    const startup = new UpdateCoordinator({userDataPath:root, currentVersion:'2.0.0', packs, appUpdates:new FakeAppUpdates('2.0.0',null), storage});
    const committed = await startup.recoverAtStartup();
    assert.equal(committed.phase, 'idle');
    assert.equal(packs.activated.length, 3);
    assert.deepEqual(packs.activated.map((pack) => pack.id), ['set-symbols', 'keywords', 'standard']);
  } finally { await rm(root, {recursive: true, force: true}); }
});
