import { parentPort, workerData } from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

interface RequestMessage {
  id: number;
  action: 'load' | 'save' | 'mutate' | 'ingest' | 'materialize' | 'flush' | 'snapshot' | 'restore' | 'close';
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
  CREATE TABLE IF NOT EXISTS workspace_sets (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workspace_cards (
    id TEXT PRIMARY KEY,
    set_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (set_id) REFERENCES workspace_sets(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS workspace_cards_set_id ON workspace_cards(set_id);
  CREATE TABLE IF NOT EXISTS workspace_histories (
    set_id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workspace_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_set_id TEXT,
    revision INTEGER NOT NULL
  );
  PRAGMA user_version = 2;
`);

const emptyState = {sets: [], cards: [], histories: {}, activeSetId: null, revision: 0};
const loadStatement = database.prepare('SELECT payload_json FROM app_state WHERE id = 1');
const saveStatement = database.prepare(`
  INSERT INTO app_state (id, revision, payload_json, updated_at)
  VALUES (1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, payload_json = excluded.payload_json, updated_at = excluded.updated_at
`);
const loadPreferenceStatement = database.prepare('SELECT active_set_id, revision FROM workspace_preferences WHERE id = 1');
const loadSetsStatement = database.prepare('SELECT payload_json FROM workspace_sets ORDER BY rowid');
const loadCardsStatement = database.prepare('SELECT payload_json FROM workspace_cards ORDER BY rowid');
const loadHistoriesStatement = database.prepare('SELECT set_id, payload_json FROM workspace_histories');
const upsertSetStatement = database.prepare('INSERT INTO workspace_sets (id, payload_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json');
const upsertCardStatement = database.prepare('INSERT INTO workspace_cards (id, set_id, payload_json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET set_id = excluded.set_id, payload_json = excluded.payload_json');
const upsertHistoryStatement = database.prepare('INSERT INTO workspace_histories (set_id, payload_json) VALUES (?, ?) ON CONFLICT(set_id) DO UPDATE SET payload_json = excluded.payload_json');
const upsertPreferenceStatement = database.prepare('INSERT INTO workspace_preferences (id, active_set_id, revision) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET active_set_id = excluded.active_set_id, revision = excluded.revision');
const deleteSetStatement = database.prepare('DELETE FROM workspace_sets WHERE id = ?');
const deleteCardStatement = database.prepare('DELETE FROM workspace_cards WHERE id = ?');
const deleteHistoryStatement = database.prepare('DELETE FROM workspace_histories WHERE set_id = ?');

function replaceNormalized(payload: unknown): void {
  const state = payload as {sets?: unknown[]; cards?: unknown[]; histories?: Record<string, unknown>; activeSetId?: string | null; revision?: number};
  database.prepare('DELETE FROM workspace_cards').run();
  database.prepare('DELETE FROM workspace_histories').run();
  database.prepare('DELETE FROM workspace_sets').run();
  for (const value of state.sets || []) {
	const set = value as {id?: unknown};
	if (typeof set.id !== 'string') throw new Error('A workspace set is missing its ID.');
	upsertSetStatement.run(set.id, JSON.stringify(value));
  }
  for (const value of state.cards || []) {
	const card = value as {id?: unknown; setId?: unknown};
	if (typeof card.id !== 'string' || typeof card.setId !== 'string') throw new Error('A workspace card is missing its ID or set ID.');
	upsertCardStatement.run(card.id, card.setId, JSON.stringify(value));
  }
  for (const [setId, history] of Object.entries(state.histories || {})) upsertHistoryStatement.run(setId, JSON.stringify(history));
  upsertPreferenceStatement.run(state.activeSetId || null, Number(state.revision || 0));
}

function loadState(): unknown {
  const preference = loadPreferenceStatement.get() as {active_set_id?: string | null; revision?: number} | undefined;
  if (preference) {
	try {
	  const sets = (loadSetsStatement.all() as Array<{payload_json: string}>).map((row) => JSON.parse(row.payload_json));
	  const cards = (loadCardsStatement.all() as Array<{payload_json: string}>).map((row) => JSON.parse(row.payload_json));
	  const histories = Object.fromEntries((loadHistoriesStatement.all() as Array<{set_id: string; payload_json: string}>).map((row) => [row.set_id, JSON.parse(row.payload_json)]));
	  return runtimeAssets({sets, cards, histories, activeSetId: preference.active_set_id || null, revision: Number(preference.revision || 0)});
	} catch { return emptyState; }
  }
  const row = loadStatement.get() as {payload_json?: string} | undefined;
  if (!row?.payload_json) return emptyState;
  try {
    const parsed = JSON.parse(row.payload_json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyState;
	database.exec('BEGIN IMMEDIATE');
	try { replaceNormalized(parsed); database.exec('COMMIT'); }
	catch (error) { database.exec('ROLLBACK'); throw error; }
    return runtimeAssets(parsed);
  } catch { return emptyState; }
}

function saveState(payload: unknown): unknown {
  const state = payload as {revision?: number};
  const persisted = extractAssets(payload);
  database.exec('BEGIN IMMEDIATE');
  try {
    saveStatement.run(Number(state.revision || Date.now()), JSON.stringify(persisted), new Date().toISOString());
	replaceNormalized(persisted);
    database.exec('COMMIT');
    return payload;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const imageExtensions: Record<string, string> = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'};
const verifiedAssets = new Set<string>();
function validImageBytes(mimeType: string, data: Buffer): boolean {
	if (mimeType === 'image/png') return data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
	if (mimeType === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
	if (mimeType === 'image/webp') return data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
	if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'));
	if (mimeType === 'image/svg+xml') return /^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(data.subarray(0, Math.min(data.length, 4096)).toString('utf8').trimStart());
	return false;
}
function extractAssets(value: unknown): unknown {
  if (typeof value === 'string') {
    const match = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([a-z0-9+/=]+)$/i.exec(value);
    if (!match) return value;
    const mimeType = match[1]!.toLowerCase(); const data = Buffer.from(match[2]!, 'base64');
    if (data.byteLength > 128 * 1024 * 1024) throw new Error('An uploaded image exceeds the 128 MB safety limit.');
	if (!validImageBytes(mimeType, data)) throw new Error('An uploaded image does not match its declared image type.');
    const hash = createHash('sha256').update(data).digest('hex'); const extension = imageExtensions[mimeType]!;
    const directory = path.join(assetRoot, hash.slice(0,2)); const destination = path.join(directory, `${hash}.${extension}`);
    if (!existsSync(destination)) { mkdirSync(directory, {recursive:true}); const temporary = `${destination}.${process.pid}.tmp`; writeFileSync(temporary, data, {mode:0o600}); renameSync(temporary, destination); }
    return {__setConjurerAsset:hash, mimeType, extension};
  }
  if (Array.isArray(value)) return value.map(extractAssets);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, extractAssets(item)]));
  return value;
}

function runtimeAssets(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(runtimeAssets);
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		if (typeof record.__setConjurerAsset === 'string' && typeof record.mimeType === 'string' && typeof record.extension === 'string') {
			const hash = record.__setConjurerAsset;
			if (!/^[a-f0-9]{64}$/.test(hash) || !imageExtensions[record.mimeType]) throw new Error('Stored user asset metadata is invalid.');
			const source = path.join(assetRoot, hash.slice(0,2), `${hash}.${record.extension}`);
			if (!verifiedAssets.has(hash)) {
				const data = readFileSync(source); if (createHash('sha256').update(data).digest('hex') !== hash) throw new Error('A stored user asset failed its integrity check.');
				verifiedAssets.add(hash);
			}
			return `set-conjurer://user-asset/${hash}.${record.extension}`;
		}
		return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, runtimeAssets(item)]));
	}
	return value;
}

function applyMutation(payload: unknown): void {
  const mutation = payload as {sets?: unknown[]; cards?: unknown[]; histories?: Record<string, unknown>; deletedSetIds?: string[]; deletedCardIds?: string[]; activeSetId?: string | null; revision?: number};
  database.exec('BEGIN IMMEDIATE');
  try {
	for (const id of mutation.deletedCardIds || []) deleteCardStatement.run(id);
	for (const id of mutation.deletedSetIds || []) { deleteHistoryStatement.run(id); deleteSetStatement.run(id); }
	for (const value of mutation.sets || []) {
	  const persisted = extractAssets(value); const set = persisted as {id?: unknown};
	  if (typeof set.id !== 'string') throw new Error('A workspace set mutation is missing its ID.');
	  upsertSetStatement.run(set.id, JSON.stringify(persisted));
	}
	for (const value of mutation.cards || []) {
	  const persisted = extractAssets(value); const card = persisted as {id?: unknown; setId?: unknown};
	  if (typeof card.id !== 'string' || typeof card.setId !== 'string') throw new Error('A workspace card mutation is missing its ID or set ID.');
	  upsertCardStatement.run(card.id, card.setId, JSON.stringify(persisted));
	}
	for (const [setId, history] of Object.entries(mutation.histories || {})) upsertHistoryStatement.run(setId, JSON.stringify(extractAssets(history)));
	const previous = loadPreferenceStatement.get() as {active_set_id?: string | null} | undefined;
	const activeSetId = Object.prototype.hasOwnProperty.call(mutation, 'activeSetId') ? mutation.activeSetId || null : previous?.active_set_id || null;
	upsertPreferenceStatement.run(activeSetId, Number(mutation.revision || Date.now()));
	database.exec('COMMIT');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

function materializeAssets(value: unknown): unknown {
	if (typeof value === 'string') {
		const match = /^set-conjurer:\/\/user-asset\/([a-f0-9]{64})\.(png|jpg|webp|gif|svg)$/.exec(value);
		if (!match) return value;
		const hash = match[1]!; const extension = match[2]!;
		const source = path.join(assetRoot, hash.slice(0, 2), `${hash}.${extension}`);
		const data = readFileSync(source);
		if (createHash('sha256').update(data).digest('hex') !== hash) throw new Error('A stored user asset failed its integrity check.');
		const mimeType = Object.entries(imageExtensions).find(([, value]) => value === extension)?.[0];
		if (!mimeType) throw new Error('A stored user asset has an unsupported image type.');
		return `data:${mimeType};base64,${data.toString('base64')}`;
	}
	if (Array.isArray(value)) return value.map(materializeAssets);
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializeAssets(item)]));
	return value;
}

function snapshot(label: string): string {
	const preference = loadPreferenceStatement.get() as {active_set_id?: string | null; revision?: number} | undefined;
	if (preference) {
		const sets = (loadSetsStatement.all() as Array<{payload_json: string}>).map((row) => JSON.parse(row.payload_json));
		const cards = (loadCardsStatement.all() as Array<{payload_json: string}>).map((row) => JSON.parse(row.payload_json));
		const histories = Object.fromEntries((loadHistoriesStatement.all() as Array<{set_id: string; payload_json: string}>).map((row) => [row.set_id, JSON.parse(row.payload_json)]));
		saveStatement.run(Number(preference.revision || 0), JSON.stringify({sets, cards, histories, activeSetId: preference.active_set_id || null, revision: Number(preference.revision || 0)}), new Date().toISOString());
	}
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

function restore(snapshotPath: string): void {
  const normalizedRoot = path.resolve(backupRoot);
  const normalizedSnapshot = path.resolve(snapshotPath);
  if (!normalizedSnapshot.startsWith(`${normalizedRoot}${path.sep}`)) throw new Error('The requested recovery snapshot is outside the managed backup directory.');
  const sourcePath = path.join(normalizedSnapshot, path.basename(databasePath));
  const backup = new DatabaseSync(sourcePath, {readOnly: true});
  try {
    const integrity = backup.prepare('PRAGMA integrity_check').get() as {integrity_check?: string};
    if (integrity.integrity_check !== 'ok') throw new Error('The recovery snapshot failed its integrity check.');
    const row = backup.prepare('SELECT revision, payload_json, updated_at FROM app_state WHERE id = 1').get() as {revision?: number; payload_json?: string; updated_at?: string} | undefined;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare('DELETE FROM app_state WHERE id = 1').run();
	  if (row?.payload_json) {
		saveStatement.run(Number(row.revision || 0), row.payload_json, row.updated_at || new Date().toISOString());
		replaceNormalized(JSON.parse(row.payload_json));
	  }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally { backup.close(); }
}

port.on('message', (message: RequestMessage) => {
  try {
    let value: unknown;
    if (message.action === 'load') value = loadState();
    if (message.action === 'save') value = saveState(message.payload);
	if (message.action === 'mutate') { applyMutation(message.payload); value = null; }
	if (message.action === 'ingest') value = runtimeAssets(extractAssets(message.payload));
	if (message.action === 'materialize') value = materializeAssets(message.payload);
    if (message.action === 'flush') {
      database.exec('PRAGMA wal_checkpoint(PASSIVE)');
      value = null;
    }
    if (message.action === 'snapshot') value = snapshot(String(message.payload || 'pre-update'));
    if (message.action === 'restore') {
      restore(String(message.payload || ''));
      value = null;
    }
    if (message.action === 'close') {
      database.close();
      value = null;
    }
    port.postMessage({id: message.id, ok: true, value});
  } catch (error) {
    port.postMessage({id: message.id, ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});
