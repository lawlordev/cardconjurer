import {readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {BrowserWindow} from 'electron';
import type {PackProgress, ReleaseChannel, UpdateState} from '../ipc/contracts.js';
import {PackService} from './pack-service.js';
import {UpdateService as AppUpdateService} from './update-service.js';
import {UpdateTransactionStore, type UpdateTransaction} from './update-transaction-store.js';
import {StorageService} from './storage-service.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const initialState = (): UpdateState => ({
  phase: 'idle', progress: 0, message: 'Up to date', availableVersion: null, includesApp: false, packIds: [],
  transactionId: null, totalBytes: 0, completedBytes: 0, lastCheckedAt: null, recoverable: false, items: []
});

export class UpdateCoordinator {
  #state = initialState();
  #window: BrowserWindow | null = null;
  #checking = false;
  readonly #packs: PackService;
  readonly #appUpdates: AppUpdateService;
  readonly #transactions: UpdateTransactionStore;
  readonly #currentVersion: string;
  readonly #checkStatePath: string;
  readonly #storage: StorageService;

  constructor(options: {userDataPath: string; currentVersion: string; packs: PackService; appUpdates: AppUpdateService; storage: StorageService}) {
    this.#packs = options.packs;
    this.#appUpdates = options.appUpdates;
    this.#currentVersion = options.currentVersion;
    this.#storage = options.storage;
    this.#transactions = new UpdateTransactionStore(options.userDataPath);
    this.#checkStatePath = path.join(options.userDataPath, 'update-check.json');
    this.#appUpdates.onState((state) => this.#onAppState(state));
    this.#packs.onProgress((progress) => this.#onPackProgress(progress));
    const transaction = this.#transactions.read();
    if (transaction?.phase === 'staged' || transaction?.phase === 'failed') this.#state = this.#stateFromTransaction(transaction);
    if (transaction?.phase === 'recovery-required') this.#state = {...this.#stateFromTransaction(transaction), phase: 'recovery-required', recoverable: true};
  }

  attachWindow(window: BrowserWindow): void { this.#window = window; }
  channel(): ReleaseChannel { return this.#appUpdates.channel(); }
  setChannel(channel: ReleaseChannel): ReleaseChannel { return this.#appUpdates.setChannel(channel); }
  stagedInstaller(): string | null { return this.#appUpdates.stagedInstaller(this.#transactions.read()?.targetAppVersion); }
  state(): UpdateState { return {...this.#state, packIds: [...this.#state.packIds], items: this.#state.items.map((item) => ({...item}))}; }

  #emit(state: UpdateState): UpdateState {
    this.#state = state;
    this.#window?.webContents.send('desktop:update-changed', this.state());
    return this.state();
  }

  #lastCheck(): number {
    try { return Date.parse(JSON.parse(readFileSync(this.#checkStatePath, 'utf8')).checkedAt) || 0; } catch { return 0; }
  }

  #recordCheck(checkedAt: string): void {
    const temporary = `${this.#checkStatePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify({checkedAt}, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#checkStatePath);
  }

  async check(options: {background?: boolean} = {}): Promise<UpdateState> {
    if (options.background && Date.now() - this.#lastCheck() < CHECK_INTERVAL_MS) return this.state();
    this.#checking = true;
    this.#emit({...initialState(), phase: 'checking', message: 'Checking for updates…'});
    const [appResult, packResult] = await Promise.allSettled([this.#appUpdates.check(), this.#packs.refreshCatalog()]);
    this.#checking = false;
    const checkedAt = new Date().toISOString();
    this.#recordCheck(checkedAt);
    const appState = appResult.status === 'fulfilled' ? appResult.value : initialState();
    const packUpdates = this.#packs.installedUpdates();
    const packItems: UpdateState['items'] = packUpdates.map((pack) => ({
      kind: 'pack', id: pack.id, displayName: pack.displayName, currentVersion: pack.installedVersion,
      targetVersion: pack.availableVersion!, bytes: pack.archiveBytes, phase: 'available', error: null
    }));
    const appItems = appState.phase === 'available' ? appState.items : [];
    const items = [...appItems, ...packItems];
    if (!items.length) {
      const failure = appState.phase === 'failed' || packResult.status === 'rejected';
      const message = failure ? 'Could not refresh update metadata. Your installed app and packs were not changed.' : 'Up to date';
      return this.#emit({...initialState(), phase: failure && !options.background ? 'failed' : 'idle', message, lastCheckedAt: checkedAt});
    }
    const includesApp = appItems.length > 0;
    const totalBytes = items.reduce((total, item) => total + item.bytes, 0);
    return this.#emit({
      phase: 'available', progress: 0, message: includesApp && packItems.length ? 'App and frame-pack updates are available' : includesApp ? appState.message : `${packItems.length} installed frame-pack update${packItems.length === 1 ? '' : 's'} available`,
      availableVersion: appState.availableVersion, includesApp, packIds: packUpdates.map((pack) => pack.id),
      transactionId: null, totalBytes, completedBytes: 0, lastCheckedAt: checkedAt, recoverable: false, items
    });
  }

  async begin(snapshotPath: string | null = null): Promise<UpdateState> {
    if (this.#state.phase !== 'available' && this.#state.phase !== 'failed') await this.check();
    if (!this.#state.items.length) return this.state();
    const plan = this.state();
    const transaction = this.#transactions.begin({
      currentAppVersion: this.#currentVersion,
      targetAppVersion: plan.includesApp ? plan.availableVersion : null,
      includesApp: plan.includesApp,
      packIds: [...plan.packIds],
      snapshotPath
    });
    this.#emit({...plan, phase: 'downloading', transactionId: transaction.id, message: 'Downloading app and installed frame-pack updates…', items: plan.items.map((item) => ({...item, phase: 'downloading'}))});
    try {
      const [appState, stagedPacks] = await Promise.all([
        plan.includesApp ? this.#appUpdates.begin() : Promise.resolve(null),
        this.#packs.stageUpdates(plan.packIds)
      ]);
      if (appState && appState.phase !== 'staged') throw new Error(appState.message || 'The application update could not be staged.');
      const staged = this.#transactions.write({...transaction, phase: 'staged', stagedPacks, error: null});
      return this.#emit({...plan, phase: 'staged', transactionId: staged.id, progress: 100, completedBytes: plan.totalBytes, message: 'Updates are ready — restart to apply', items: plan.items.map((item) => ({...item, phase: 'staged'}))});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The update transaction failed.';
      this.#transactions.write({...transaction, phase: 'failed', error: message});
      return this.#emit({...plan, phase: 'failed', transactionId: transaction.id, message, recoverable: true, items: plan.items.map((item) => item.phase === 'staged' ? item : {...item, phase: 'failed', error: message})});
    }
  }

  async recoverAtStartup(): Promise<UpdateState> {
    const transaction = this.#transactions.read();
    if (!transaction || transaction.phase !== 'staged') return this.state();
    if (transaction.includesApp && transaction.targetAppVersion !== this.#currentVersion) return this.#emit(this.#stateFromTransaction(transaction));
    try {
      const activating = this.#transactions.write({...transaction, phase: 'activating'});
      this.#packs.activateStaged(activating.stagedPacks);
      this.#transactions.write({...activating, phase: 'committed', error: null});
      return this.#emit({...initialState(), message: 'Update applied successfully'});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Staged packs could not be activated.';
      if (transaction.snapshotPath) {
        try { await this.#storage.restore(transaction.snapshotPath); } catch (restoreError) {
          console.error('The update snapshot could not be restored.', restoreError);
        }
      }
      const failed = this.#transactions.write({...transaction, phase: 'recovery-required', error: message});
      return this.#emit({...this.#stateFromTransaction(failed), phase: 'recovery-required', message, recoverable: true});
    }
  }

  #stateFromTransaction(transaction: UpdateTransaction): UpdateState {
    const phase = transaction.phase === 'staged' ? 'staged' : transaction.phase === 'recovery-required' ? 'recovery-required' : 'failed';
    return {
      ...initialState(), phase, transactionId: transaction.id, includesApp: transaction.includesApp,
      availableVersion: transaction.targetAppVersion, packIds: [...transaction.packIds],
      progress: transaction.phase === 'staged' ? 100 : 0, message: transaction.error || (transaction.phase === 'staged' ? 'Updates are ready — restart to apply' : 'Update staging can be retried'),
      recoverable: transaction.phase !== 'staged',
      items: [
        ...(transaction.includesApp && transaction.targetAppVersion ? [{kind: 'app' as const, id: 'app', displayName: 'Set Conjurer', currentVersion: transaction.currentAppVersion, targetVersion: transaction.targetAppVersion, bytes: 0, phase: transaction.phase === 'staged' ? 'staged' as const : 'failed' as const, error: transaction.error}] : []),
        ...transaction.packIds.map((id) => ({kind: 'pack' as const, id, displayName: id, currentVersion: null, targetVersion: transaction.stagedPacks.find((pack) => pack.id === id)?.version || 'pending', bytes: 0, phase: transaction.phase === 'staged' ? 'staged' as const : 'failed' as const, error: transaction.error}))
      ]
    };
  }

  #onAppState(state: UpdateState): void {
    if (this.#checking || !this.#state.transactionId) return;
    const appItem = this.#state.items.find((item) => item.kind === 'app');
    if (!appItem) return;
    const items = this.#state.items.map((item) => item.kind === 'app' ? {...item, phase: state.phase === 'staged' ? 'staged' as const : state.phase === 'verifying' ? 'verifying' as const : state.phase === 'failed' ? 'failed' as const : 'downloading' as const, error: state.phase === 'failed' ? state.message : null} : item);
    const appBytes = appItem.bytes * state.progress / 100;
    this.#emit({...this.#state, progress: this.#state.totalBytes ? Math.round((this.#state.completedBytes + appBytes) / this.#state.totalBytes * 100) : state.progress, message: state.message, items});
  }

  #onPackProgress(progress: PackProgress): void {
    if (!this.#state.transactionId) return;
    const packBytes = this.#state.items.filter((item) => item.kind === 'pack').reduce((total, item) => total + item.bytes, 0);
    const completedBytes = Math.round(packBytes * progress.percent / 100);
    const progressPercent = this.#state.totalBytes ? Math.min(99, Math.round(completedBytes / this.#state.totalBytes * 100)) : progress.percent;
    this.#emit({...this.#state, progress: Math.max(this.#state.progress, progressPercent), completedBytes, message: progress.message});
  }
}
