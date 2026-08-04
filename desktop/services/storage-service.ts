import { Worker } from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import type { WorkspaceMutation, WorkspaceState } from '../ipc/contracts.js';

export class StorageService {
  readonly #worker: Worker;
  readonly #assetRoot: string;
  #requestId = 0;
  #pending = new Map<number, {resolve(value: unknown): void; reject(error: Error): void}>();

  constructor(userDataPath: string) {
	this.#assetRoot = path.join(userDataPath, 'assets', 'sha256');
    this.#worker = new Worker(path.join(__dirname, 'storage-worker.js'), {
      workerData: {
        databasePath: path.join(userDataPath, 'database', 'set-conjurer.sqlite3'),
        backupRoot: path.join(userDataPath, 'backups', 'pre-update'),
        assetRoot: this.#assetRoot
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

  async applyMutation(mutation: WorkspaceMutation): Promise<void> {
	await this.#request('mutate', mutation);
  }

  ingestAssets<T>(value: T): Promise<T> {
	return this.#request('ingest', value) as Promise<T>;
  }

  materializeAssets<T>(value: T): Promise<T> {
	return this.#request('materialize', value) as Promise<T>;
  }

  resolveAsset(requestPath: string): string | null {
	const match = /^\/([a-f0-9]{64})\.(png|jpg|webp|gif|svg)$/.exec(requestPath);
	if (!match) return null;
	const [, hash, extension] = match;
	const source = path.join(this.#assetRoot, hash!.slice(0, 2), `${hash}.${extension}`);
	if (!existsSync(source)) return null;
	const data = readFileSync(source);
	return createHash('sha256').update(data).digest('hex') === hash ? source : null;
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
