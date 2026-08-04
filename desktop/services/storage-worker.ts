import { parentPort, workerData } from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

interface RequestMessage {
  id: number;
  action: 'load' | 'save' | 'flush' | 'snapshot' | 'close';
  payload?: unknown;
}

const port = parentPort;
if (!port) throw new Error('Storage worker requires a parent port.');

const databasePath = String(workerData.databasePath);
const backupRoot = String(workerData.backupRoot);
const assetRoot = String(workerData.assetRoot);
mkdirSync(path.dirname(databasePath), {recursive: true});
mkdirSync(backupRoot, {recursive: true});
mkdirSync(assetRoot, {recursive: true});

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
  PRAGMA user_version = 1;
`);

const emptyState = {sets: [], cards: [], histories: {}, activeSetId: null, revision: 0};
const loadStatement = database.prepare('SELECT payload_json FROM app_state WHERE id = 1');
const saveStatement = database.prepare(`
  INSERT INTO app_state (id, revision, payload_json, updated_at)
  VALUES (1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, payload_json = excluded.payload_json, updated_at = excluded.updated_at
`);

function loadState(): unknown {
  const row = loadStatement.get() as {payload_json?: string} | undefined;
  if (!row?.payload_json) return emptyState;
  try {
    const parsed = JSON.parse(row.payload_json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyState;
    return hydrateAssets(parsed);
  } catch {
    return emptyState;
  }
}

function saveState(payload: unknown): unknown {
  const state = payload as {revision?: number};
  const persisted = extractAssets(payload);
  database.exec('BEGIN IMMEDIATE');
  try {
    saveStatement.run(Number(state.revision || Date.now()), JSON.stringify(persisted), new Date().toISOString());
    database.exec('COMMIT');
    return payload;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const imageExtensions: Record<string, string> = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'};
function extractAssets(value: unknown): unknown {
  if (typeof value === 'string') {
    const match = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([a-z0-9+/=]+)$/i.exec(value);
    if (!match) return value;
    const mimeType = match[1]!.toLowerCase(); const data = Buffer.from(match[2]!, 'base64');
    if (data.byteLength > 128 * 1024 * 1024) throw new Error('An uploaded image exceeds the 128 MB safety limit.');
    const hash = createHash('sha256').update(data).digest('hex'); const extension = imageExtensions[mimeType]!;
    const directory = path.join(assetRoot, hash.slice(0,2)); const destination = path.join(directory, `${hash}.${extension}`);
    if (!existsSync(destination)) { mkdirSync(directory, {recursive:true}); const temporary = `${destination}.${process.pid}.tmp`; writeFileSync(temporary, data, {mode:0o600}); renameSync(temporary, destination); }
    return {__setConjurerAsset:hash, mimeType, extension};
  }
  if (Array.isArray(value)) return value.map(extractAssets);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, extractAssets(item)]));
  return value;
}

function hydrateAssets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hydrateAssets);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.__setConjurerAsset === 'string' && typeof record.mimeType === 'string' && typeof record.extension === 'string') {
      const hash = record.__setConjurerAsset;
      if (!/^[a-f0-9]{64}$/.test(hash) || !imageExtensions[record.mimeType]) throw new Error('Stored user asset metadata is invalid.');
      const source = path.join(assetRoot, hash.slice(0,2), `${hash}.${record.extension}`);
      const data = readFileSync(source); if (createHash('sha256').update(data).digest('hex') !== hash) throw new Error('A stored user asset failed its integrity check.');
      return `data:${record.mimeType};base64,${data.toString('base64')}`;
    }
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, hydrateAssets(item)]));
  }
  return value;
}

function snapshot(label: string): string {
  database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const safeLabel = label.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 60) || 'snapshot';
  const destination = path.join(backupRoot, `${Date.now()}-${safeLabel}`);
  mkdirSync(destination, {recursive: true});
  if (existsSync(databasePath)) cpSync(databasePath, path.join(destination, path.basename(databasePath)));
  const verification = new DatabaseSync(path.join(destination, path.basename(databasePath)), {readOnly:true});
  const integrity = verification.prepare('PRAGMA integrity_check').get() as {integrity_check?: string}; verification.close();
  if (integrity.integrity_check !== 'ok') throw new Error('The pre-update database snapshot failed its integrity check.');
  return destination;
}

port.on('message', (message: RequestMessage) => {
  try {
    let value: unknown;
    if (message.action === 'load') value = loadState();
    if (message.action === 'save') value = saveState(message.payload);
    if (message.action === 'flush') {
      database.exec('PRAGMA wal_checkpoint(PASSIVE)');
      value = null;
    }
    if (message.action === 'snapshot') value = snapshot(String(message.payload || 'pre-update'));
    if (message.action === 'close') {
      database.close();
      value = null;
    }
    port.postMessage({id: message.id, ok: true, value});
  } catch (error) {
    port.postMessage({id: message.id, ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});
