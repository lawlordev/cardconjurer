import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { WorkspaceState } from '../ipc/contracts.js';

export class StorageService {
  readonly #worker: Worker;
  #requestId = 0;
  #pending = new Map<number, {resolve(value: unknown): void; reject(error: Error): void}>();

  constructor(userDataPath: string) {
    this.#worker = new Worker(path.join(__dirname, 'storage-worker.js'), {
      workerData: {
        databasePath: path.join(userDataPath, 'database', 'set-conjurer.sqlite3'),
        backupRoot: path.join(userDataPath, 'backups', 'pre-update'),
        assetRoot: path.join(userDataPath, 'assets', 'sha256')
      }
    });
    this.#worker.on('message', (message: {id: number; ok: boolean; value?: unknown; error?: string}) => {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.ok) pending.resolve(message.value);
      else pending.reject(new Error(message.error || 'Local storage failed.'));
    });
    this.#worker.on('error', (error) => {
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
  }

  #request(action: string, payload?: unknown): Promise<unknown> {
    const id = ++this.#requestId;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, {resolve, reject});
      this.#worker.postMessage({id, action, payload});
    });
  }

  load(): Promise<WorkspaceState> {
    return this.#request('load') as Promise<WorkspaceState>;
  }

  save(state: WorkspaceState): Promise<WorkspaceState> {
    return this.#request('save', state) as Promise<WorkspaceState>;
  }

  async flush(): Promise<void> {
    await this.#request('flush');
  }

  snapshot(label: string): Promise<string> {
    return this.#request('snapshot', label) as Promise<string>;
  }

  async restore(snapshotPath: string): Promise<void> {
    await this.#request('restore', snapshotPath);
  }

  async close(): Promise<void> {
    await this.#request('close');
    await this.#worker.terminate();
  }
}
