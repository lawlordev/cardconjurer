import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {PackId} from '../ipc/contracts.js';

export interface StagedPackTarget {
  id: PackId;
  version: string;
  sourceRoot: string;
  previousVersion: string | null;
  previousSourceRoot: string | null;
}

export interface UpdateTransaction {
  schemaVersion: 1;
  id: string;
  phase: 'preparing' | 'downloading' | 'staged' | 'activating' | 'committed' | 'failed' | 'recovery-required';
  createdAt: string;
  updatedAt: string;
  currentAppVersion: string;
  targetAppVersion: string | null;
  includesApp: boolean;
  packIds: PackId[];
  stagedPacks: StagedPackTarget[];
  snapshotPath: string | null;
  error: string | null;
}

export class UpdateTransactionStore {
  readonly #path: string;

  constructor(userDataPath: string) {
    const root = path.join(userDataPath, 'staging', 'updates');
    mkdirSync(root, {recursive: true});
    this.#path = path.join(root, 'transaction.json');
  }

  read(): UpdateTransaction | null {
    try {
      const value = JSON.parse(readFileSync(this.#path, 'utf8')) as UpdateTransaction;
      if (value.schemaVersion !== 1 || typeof value.id !== 'string' || !Array.isArray(value.packIds) || !Array.isArray(value.stagedPacks)) return null;
      return value;
    } catch { return null; }
  }

  write(transaction: UpdateTransaction): UpdateTransaction {
    const value = {...transaction, updatedAt: new Date().toISOString()};
    const temporary = `${this.#path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#path);
    return value;
  }

  begin(input: Omit<UpdateTransaction, 'schemaVersion' | 'id' | 'phase' | 'createdAt' | 'updatedAt' | 'stagedPacks' | 'error'>): UpdateTransaction {
    const createdAt = new Date().toISOString();
    return this.write({
      schemaVersion: 1,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      phase: 'preparing',
      createdAt,
      updatedAt: createdAt,
      stagedPacks: [],
      error: null,
      ...input
    });
  }

  exists(): boolean { return existsSync(this.#path); }
}
