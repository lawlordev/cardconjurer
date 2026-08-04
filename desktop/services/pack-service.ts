import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type {PackId, PackStatus} from '../ipc/contracts.js';
import {PACK_IDS} from '../ipc/contracts.js';

const PACK_DETAILS: Record<PackId, {displayName: string; description: string; required: boolean}> = {
  'set-symbols': {displayName: 'Set Symbols', description: 'Official and bundled custom set-symbol families.', required: true},
  standard: {displayName: 'Standard', description: 'Modern frames and every linked standard variant.', required: true},
  'booster-fun': {displayName: 'Booster Fun', description: 'Showcase, borderless, and special-treatment frames.', required: false},
  tokens: {displayName: 'Tokens', description: 'Token, emblem, marker, and helper-card frames.', required: false},
  basics: {displayName: 'Basics', description: 'Full-art and specialty basic-land frames.', required: false},
  legacy: {displayName: 'Legacy', description: 'Classic, old-border, and historical frame families.', required: false},
  custom: {displayName: 'Custom', description: 'Bundled experimental and future user-imported frame families.', required: false}
};
const REQUIRED_PACK_IDS: PackId[] = ['set-symbols', 'standard'];
const RELEASES_URL = 'https://api.github.com/repos/lawlordev/cardconjurer/releases?per_page=30';
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PACK_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024;

interface InstalledPack {id: PackId; version: string; sourceRoot: string; installedAt: string}
interface InstallationState {schemaVersion: 1; packs: InstalledPack[]}
interface CatalogArchive {url: string; sha256: string; archiveBytes: number}
interface CatalogPack {id: PackId; version: string; archives: CatalogArchive[]; archiveBytes: number; installedBytes: number}
interface Catalog {schemaVersion: 2; packs: CatalogPack[]}

export class PackService {
  readonly #statePath: string;
  readonly #packRoot: string;
  readonly #developmentRoot: string | null;
  readonly #seedRoot: string | null;
  #state: InstallationState;
  #catalog: Catalog = {schemaVersion: 2, packs: []};
  #progress: (value: {id: PackId; percent: number; message: string}) => void = () => {};

  constructor(options: {userDataPath: string; appRoot: string; resourcesPath: string; packaged: boolean}) {
    this.#packRoot = path.join(options.userDataPath, 'packs');
    mkdirSync(this.#packRoot, {recursive: true});
    this.#statePath = path.join(this.#packRoot, 'active.json');
    this.#developmentRoot = options.packaged ? null : options.appRoot;
    const seedRoot = path.join(options.resourcesPath, 'local-pack-seed');
    this.#seedRoot = existsSync(seedRoot) ? seedRoot : null;
    this.#state = this.#readState();
    try { this.#catalog = JSON.parse(readFileSync(path.join(this.#packRoot, 'catalog.json'), 'utf8')) as Catalog; } catch {}
  }

  onProgress(listener: (value: {id: PackId; percent: number; message: string}) => void): void { this.#progress = listener; }
  #readState(): InstallationState {
    try { const value = JSON.parse(readFileSync(this.#statePath, 'utf8')) as InstallationState; if (value.schemaVersion === 1 && Array.isArray(value.packs)) return value; } catch {}
    return {schemaVersion: 1, packs: []};
  }
  #writeState(): void {
    const temporary = `${this.#statePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.#state, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#statePath);
  }
  #sourceFor(id: PackId): {root: string; source: PackStatus['source']} | null {
    if (this.#developmentRoot) return {root: this.#developmentRoot, source: 'development'};
    if (this.#seedRoot && existsSync(path.join(this.#seedRoot, id))) {
      const seed = path.join(this.#seedRoot, id);
      const localPointer = path.join(seed, 'source-root.txt');
      if (existsSync(localPointer)) {
        const localRoot = readFileSync(localPointer, 'utf8').trim();
        if (existsSync(localRoot)) return {root: localRoot, source: 'bundled-seed'};
      }
      return {root: seed, source: 'bundled-seed'};
    }
    const installed = this.#state.packs.find((item) => item.id === id);
    return installed && existsSync(installed.sourceRoot) ? {root: installed.sourceRoot, source: 'github'} : null;
  }
  list(): PackStatus[] {
    return PACK_IDS.map((id) => {
      const details = PACK_DETAILS[id];
      const installed = this.#state.packs.find((item) => item.id === id) || null;
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      const source = this.#sourceFor(id);
      return {id, ...details, installed: Boolean(installed), installedVersion: installed?.version || null, availableVersion: catalog?.version || '1.0.0', archiveBytes: catalog?.archiveBytes || 0, installedBytes: catalog?.installedBytes || 0, available: Boolean(source || catalog), source: source?.source || (catalog ? 'github' : 'unavailable')};
    });
  }

  async #refreshCatalog(): Promise<void> {
    const response = await fetch(RELEASES_URL, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'Set-Conjurer'}});
    if (!response.ok) throw new Error(`Could not check frame packs (${response.status}).`);
    const releases = await response.json() as Array<{draft?: boolean; assets?: Array<{name: string; browser_download_url: string}>}>;
    const asset = releases.filter((release) => !release.draft).flatMap((release) => release.assets || []).find((item) => item.name === 'frame-packs.json');
    if (!asset) throw new Error('No frame-pack catalog is published for this build yet.');
    const catalogResponse = await fetch(asset.browser_download_url, {headers: {'User-Agent': 'Set-Conjurer'}});
    if (!catalogResponse.ok) throw new Error('Could not download the frame-pack catalog.');
    const value = await catalogResponse.json() as Catalog;
    if (value.schemaVersion !== 2 || !Array.isArray(value.packs)) throw new Error('The frame-pack catalog is invalid.');
    for (const pack of value.packs) {
      if (!PACK_IDS.includes(pack.id) || !Array.isArray(pack.archives) || pack.archives.length < 1) throw new Error('The frame-pack catalog contains an unsafe entry.');
      for (const archive of pack.archives) {
        if (!/^https:\/\//.test(archive.url) || !/^[a-f0-9]{64}$/i.test(archive.sha256)) throw new Error('The frame-pack catalog contains an unsafe entry.');
        if (archive.archiveBytes < 1 || archive.archiveBytes >= MAX_ARCHIVE_BYTES) throw new Error('A frame-pack archive exceeds the application safety limit.');
      }
      const declaredArchiveBytes = pack.archives.reduce((total, archive) => total + archive.archiveBytes, 0);
      if (pack.archiveBytes !== declaredArchiveBytes || pack.archiveBytes > MAX_PACK_BYTES || pack.installedBytes > MAX_EXPANDED_BYTES) throw new Error('A frame pack exceeds the application safety limit.');
    }
    this.#catalog = value;
    writeFileSync(path.join(this.#packRoot, 'catalog.json'), `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  }

  async #installRemote(id: PackId, catalog: CatalogPack): Promise<string> {
    const temporary = path.join(this.#packRoot, `.install-${id}-${Date.now()}`); const destination = path.join(this.#packRoot, id, catalog.version);
    mkdirSync(temporary, {recursive: true}); let expandedBytes = 0; let receivedForPack = 0;
    try {
      for (const [archiveIndex, catalogArchive] of catalog.archives.entries()) {
        const label = catalog.archives.length > 1 ? ` (${archiveIndex + 1}/${catalog.archives.length})` : '';
        this.#progress({id, percent: Math.min(70, 5 + (receivedForPack / Math.max(catalog.archiveBytes, 1)) * 65), message: `Downloading ${PACK_DETAILS[id].displayName}${label}…`});
        const response = await fetch(catalogArchive.url, {headers: {'User-Agent': 'Set-Conjurer'}});
        if (!response.ok || !response.body) throw new Error(`Could not download ${PACK_DETAILS[id].displayName}.`);
        const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let receivedForArchive = 0;
        for (;;) {
          const {done, value} = await reader.read(); if (done) break; receivedForArchive += value.byteLength; receivedForPack += value.byteLength;
          if (receivedForArchive >= MAX_ARCHIVE_BYTES || receivedForPack > MAX_PACK_BYTES) throw new Error('The frame-pack download exceeded its safety limit.');
          chunks.push(value); this.#progress({id, percent: Math.min(70, 5 + (receivedForPack / Math.max(catalog.archiveBytes, 1)) * 65), message: `Downloading ${PACK_DETAILS[id].displayName}${label}…`});
        }
        if (receivedForArchive !== catalogArchive.archiveBytes) throw new Error(`${PACK_DETAILS[id].displayName} did not match its declared download size.`);
        const archive = Buffer.concat(chunks);
        if (createHash('sha256').update(archive).digest('hex').toLowerCase() !== catalogArchive.sha256.toLowerCase()) throw new Error(`${PACK_DETAILS[id].displayName} failed checksum verification.`);
        this.#progress({id, percent: 76, message: `Verifying ${PACK_DETAILS[id].displayName}${label}…`});
        const zip = await JSZip.loadAsync(archive, {checkCRC32: true});
        for (const [name, entry] of Object.entries(zip.files)) {
          const normalized = name.replace(/\\/g, '/');
          if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('A frame pack attempted to write outside its install directory.');
          const permissions = typeof entry.unixPermissions === 'number' ? entry.unixPermissions : 0;
          if ((permissions & 0o170000) === 0o120000) throw new Error('Frame-pack symbolic links are not allowed.');
          const target = path.join(temporary, normalized);
          if (entry.dir) { mkdirSync(target, {recursive: true}); continue; }
          const data = await entry.async('nodebuffer'); expandedBytes += data.byteLength;
          if (expandedBytes > MAX_EXPANDED_BYTES || expandedBytes > Math.max(catalog.installedBytes * 1.1, catalog.installedBytes + 1024 * 1024)) throw new Error('The frame pack expanded beyond its declared size.');
          mkdirSync(path.dirname(target), {recursive: true}); writeFileSync(target, data, {mode: 0o600});
        }
      }
      mkdirSync(path.dirname(destination), {recursive: true}); rmSync(destination, {recursive: true, force: true}); renameSync(temporary, destination);
      return destination;
    } catch (error) { rmSync(temporary, {recursive: true, force: true}); throw error; }
  }

  async install(ids: PackId[]): Promise<PackStatus[]> {
    const missingRequired = REQUIRED_PACK_IDS.filter((id) => !this.#state.packs.some((item) => item.id === id));
    const uniqueIds = [...new Set([...missingRequired, ...ids])];
    if (!this.#developmentRoot && uniqueIds.some((id) => !this.#sourceFor(id))) await this.#refreshCatalog();
    for (const id of uniqueIds) {
      let source = this.#sourceFor(id); let version = '1.0.0';
      if (!source) {
        const catalog = this.#catalog.packs.find((item) => item.id === id); if (!catalog) throw new Error(`${PACK_DETAILS[id].displayName} is not published yet.`);
        source = {root: await this.#installRemote(id, catalog), source: 'github'}; version = catalog.version;
      }
      this.#progress({id, percent: 95, message: `Activating ${PACK_DETAILS[id].displayName}…`});
      const existing = this.#state.packs.find((item) => item.id === id);
      if (existing) Object.assign(existing, {version, sourceRoot: source.root, installedAt: new Date().toISOString()});
      else this.#state.packs.push({id, version, sourceRoot: source.root, installedAt: new Date().toISOString()});
      this.#progress({id, percent: 100, message: `${PACK_DETAILS[id].displayName} installed`});
    }
    this.#writeState(); return this.list();
  }
  remove(id: PackId): PackStatus[] {
    if (REQUIRED_PACK_IDS.includes(id)) throw new Error(`The ${PACK_DETAILS[id].displayName} pack is required and cannot be removed.`);
    this.#state.packs = this.#state.packs.filter((item) => item.id !== id); this.#writeState(); return this.list();
  }
  hasRequiredPacks(): boolean { return REQUIRED_PACK_IDS.every((id) => this.#state.packs.some((item) => item.id === id)); }
  resolvePackAsset(relativePath: string): string | null {
    const clean = relativePath.replace(/^\/+/, '');
    if (!clean.startsWith('img/frames/') && !clean.startsWith('img/setSymbols/')) return null;
    for (const pack of this.#state.packs) {
      const candidate = path.resolve(pack.sourceRoot, clean); const root = path.resolve(pack.sourceRoot);
      if ((candidate === root || candidate.startsWith(`${root}${path.sep}`)) && existsSync(candidate)) return candidate;
    }
    return null;
  }
}
