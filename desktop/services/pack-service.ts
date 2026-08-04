import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {PackId, PackProgress, PackStatus} from '../ipc/contracts.js';
import {PACK_IDS} from '../ipc/contracts.js';
import {downloadArchive, extractArchive} from './pack-archive.js';

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
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_PACK_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_PACK_FILES = 250_000;

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
  #progress: (value: PackProgress) => void = () => {};
  #lastPercent = 0;

  constructor(options: {userDataPath: string; appRoot: string; resourcesPath: string; packaged: boolean}) {
    this.#packRoot = path.join(options.userDataPath, 'packs');
    mkdirSync(this.#packRoot, {recursive: true});
    this.#statePath = path.join(this.#packRoot, 'active.json');
    this.#developmentRoot = options.packaged ? null : options.appRoot;
    const seedRoot = path.join(options.resourcesPath, 'local-pack-seed');
    this.#seedRoot = existsSync(seedRoot) ? seedRoot : null;
    this.#state = this.#readState();
    try { this.#catalog = this.#validateCatalog(JSON.parse(readFileSync(path.join(this.#packRoot, 'catalog.json'), 'utf8'))); } catch {}
  }

  onProgress(listener: (value: PackProgress) => void): void { this.#progress = listener; }

  #emit(progress: PackProgress): void {
    const percent = Math.max(this.#lastPercent, Math.min(100, progress.percent));
    this.#lastPercent = percent;
    this.#progress({...progress, percent});
  }

  #readState(): InstallationState {
    try {
      const value = JSON.parse(readFileSync(this.#statePath, 'utf8')) as InstallationState;
      if (value.schemaVersion === 1 && Array.isArray(value.packs)) return value;
    } catch {}
    return {schemaVersion: 1, packs: []};
  }

  #writeState(): void {
    const temporary = `${this.#statePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.#state, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#statePath);
  }

  #installedPack(id: PackId): InstalledPack | null {
    const installed = this.#state.packs.find((item) => item.id === id) || null;
    if (!installed || !existsSync(installed.sourceRoot)) return null;
    const requiredDirectory = id === 'set-symbols' ? 'img/setSymbols' : 'img/frames';
    if (!existsSync(path.join(installed.sourceRoot, requiredDirectory))) return null;
    const root = path.resolve(installed.sourceRoot);
    const managedRoot = path.resolve(this.#packRoot);
    if (root.startsWith(`${managedRoot}${path.sep}`)) {
      try {
        const health = JSON.parse(readFileSync(path.join(root, '.set-conjurer-pack.json'), 'utf8')) as {id?: string; version?: string};
        if (health.id !== id || health.version !== installed.version) return null;
      } catch { return null; }
    }
    return installed;
  }

  #sourceFor(id: PackId): {root: string; source: PackStatus['source']; version: string} | null {
    const catalogVersion = this.#catalog.packs.find((item) => item.id === id)?.version || 'development';
    if (this.#developmentRoot) return {root: this.#developmentRoot, source: 'development', version: catalogVersion};
    if (this.#seedRoot && existsSync(path.join(this.#seedRoot, id))) {
      const seed = path.join(this.#seedRoot, id);
      const localPointer = path.join(seed, 'source-root.txt');
      if (existsSync(localPointer)) {
        const localRoot = readFileSync(localPointer, 'utf8').trim();
        if (existsSync(localRoot)) return {root: localRoot, source: 'bundled-seed', version: catalogVersion};
      }
      return {root: seed, source: 'bundled-seed', version: catalogVersion};
    }
    const installed = this.#installedPack(id);
    return installed ? {root: installed.sourceRoot, source: 'github', version: installed.version} : null;
  }

  list(): PackStatus[] {
    return PACK_IDS.map((id) => {
      const details = PACK_DETAILS[id];
      const installed = this.#installedPack(id);
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      const source = this.#sourceFor(id);
      return {
        id, ...details, installed: Boolean(installed), installedVersion: installed?.version || null,
        availableVersion: catalog?.version || null, archiveBytes: catalog?.archiveBytes || 0,
        installedBytes: catalog?.installedBytes || 0, available: Boolean(source || catalog),
        updateAvailable: Boolean(installed && catalog && installed.version !== catalog.version),
        source: source?.source || (catalog ? 'github' : 'unavailable')
      };
    });
  }

  #validateCatalog(input: unknown): Catalog {
    const value = input as Catalog;
    if (value?.schemaVersion !== 2 || !Array.isArray(value.packs)) throw new Error('The frame-pack catalog is invalid.');
    const seen = new Set<PackId>();
    for (const pack of value.packs) {
      if (!PACK_IDS.includes(pack.id) || seen.has(pack.id) || !Array.isArray(pack.archives) || pack.archives.length < 1) throw new Error('The frame-pack catalog contains an unsafe entry.');
      seen.add(pack.id);
      for (const archive of pack.archives) {
        if (!/^https:\/\//.test(archive.url) || !/^[a-f0-9]{64}$/i.test(archive.sha256)) throw new Error('The frame-pack catalog contains an unsafe entry.');
        if (archive.archiveBytes < 1 || archive.archiveBytes > MAX_ARCHIVE_BYTES) throw new Error('A frame-pack archive exceeds the application safety limit.');
      }
      const declaredArchiveBytes = pack.archives.reduce((total, archive) => total + archive.archiveBytes, 0);
      if (pack.archiveBytes !== declaredArchiveBytes || pack.archiveBytes > MAX_PACK_BYTES || pack.installedBytes < 1 || pack.installedBytes > MAX_EXPANDED_BYTES) throw new Error('A frame pack exceeds the application safety limit.');
    }
    return value;
  }

  async refreshCatalog(): Promise<PackStatus[]> {
    if (this.#developmentRoot || this.#seedRoot) return this.list();
    const response = await fetch(RELEASES_URL, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'Set-Conjurer'}});
    if (!response.ok) throw new Error(`Could not check frame packs (${response.status}).`);
    const releases = await response.json() as Array<{draft?: boolean; assets?: Array<{name: string; browser_download_url: string}>}>;
    const asset = releases.filter((release) => !release.draft).flatMap((release) => release.assets || []).find((item) => item.name === 'frame-packs.json');
    if (!asset) throw new Error('No frame-pack catalog is published for this build yet.');
    const catalogResponse = await fetch(asset.browser_download_url, {headers: {'User-Agent': 'Set-Conjurer'}});
    if (!catalogResponse.ok) throw new Error('Could not download the frame-pack catalog.');
    const value = this.#validateCatalog(await catalogResponse.json());
    this.#catalog = value;
    const destination = path.join(this.#packRoot, 'catalog.json');
    const temporary = `${destination}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, destination);
    return this.list();
  }

  #activate(id: PackId, version: string, sourceRoot: string): void {
    const installed = {id, version, sourceRoot, installedAt: new Date().toISOString()};
    const index = this.#state.packs.findIndex((item) => item.id === id);
    if (index >= 0) this.#state.packs[index] = installed;
    else this.#state.packs.push(installed);
    // Commit each healthy pack independently. A later pack failure cannot create ghost installs.
    this.#writeState();
  }

  async #installRemote(
    id: PackId,
    catalog: CatalogPack,
    operation: {networkDone: number; expandedDone: number; networkTotal: number; expandedTotal: number}
  ): Promise<string> {
    const temporary = path.join(this.#packRoot, `.install-${id}-${Date.now()}`);
    const destination = path.join(this.#packRoot, id, catalog.version);
    const downloadRoot = path.join(this.#packRoot, 'downloads', id, catalog.version);
    mkdirSync(temporary, {recursive: true});
    const limits = {
      maxExpandedBytes: Math.min(MAX_EXPANDED_BYTES, Math.max(Math.ceil(catalog.installedBytes * 1.1), catalog.installedBytes + 1024 * 1024)),
      maxFiles: MAX_PACK_FILES, expandedBytes: 0, files: 0
    };
    try {
      for (const [index, archive] of catalog.archives.entries()) {
        const archivePath = path.join(downloadRoot, `part-${String(index + 1).padStart(3, '0')}.zip`);
        const priorArchives = catalog.archives.slice(0, index).reduce((total, item) => total + item.archiveBytes, 0);
        await downloadArchive(archive, archivePath, {
          maxBytes: MAX_ARCHIVE_BYTES + 1,
          onProgress: ({receivedBytes}) => {
            const received = operation.networkDone + priorArchives + receivedBytes;
            const totalWork = operation.networkTotal + operation.expandedTotal;
            const percent = totalWork ? (received + operation.expandedDone + limits.expandedBytes) / totalWork * 99 : 99;
            this.#emit({phase: 'downloading', percent, receivedBytes: received, totalBytes: operation.networkTotal, message: 'Downloading selected frame packs…'});
          }
        });
        await extractArchive(archivePath, temporary, limits, (expandedBytes) => {
          const expanded = operation.expandedDone + expandedBytes;
          const received = operation.networkDone + priorArchives + archive.archiveBytes;
          const totalWork = operation.networkTotal + operation.expandedTotal;
          const percent = totalWork ? (received + expanded) / totalWork * 99 : 99;
          this.#emit({phase: 'extracting', percent, receivedBytes: received, totalBytes: operation.networkTotal, message: 'Installing selected frame packs…'});
        });
      }
      if (limits.expandedBytes < 1) throw new Error(`${PACK_DETAILS[id].displayName} did not contain any files.`);
      writeFileSync(path.join(temporary, '.set-conjurer-pack.json'), `${JSON.stringify({id, version: catalog.version, installedBytes: limits.expandedBytes}, null, 2)}\n`, {mode: 0o600});
      mkdirSync(path.dirname(destination), {recursive: true});
      rmSync(destination, {recursive: true, force: true});
      renameSync(temporary, destination);
      operation.networkDone += catalog.archiveBytes;
      operation.expandedDone += limits.expandedBytes;
      rmSync(downloadRoot, {recursive: true, force: true});
      return destination;
    } catch (error) {
      rmSync(temporary, {recursive: true, force: true});
      throw error;
    }
  }

  async install(ids: PackId[]): Promise<PackStatus[]> {
    this.#lastPercent = 0;
    const requested = [...new Set([...REQUIRED_PACK_IDS, ...ids])];
    if (!this.#developmentRoot && !this.#seedRoot && this.#catalog.packs.length === 0) await this.refreshCatalog();
    const targets = requested.filter((id) => {
      const source = this.#sourceFor(id);
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      return !source || (source.source === 'github' && catalog?.version !== source.version);
    });
    const catalogs = targets.map((id) => {
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      if (!catalog && !this.#developmentRoot && !this.#seedRoot) throw new Error(`${PACK_DETAILS[id].displayName} is not published yet.`);
      return catalog;
    }).filter((item): item is CatalogPack => Boolean(item));
    const operation = {
      networkDone: 0, expandedDone: 0,
      networkTotal: catalogs.reduce((total, pack) => total + pack.archiveBytes, 0),
      expandedTotal: catalogs.reduce((total, pack) => total + pack.installedBytes, 0)
    };
    this.#emit({phase: 'preparing', percent: 0, receivedBytes: 0, totalBytes: operation.networkTotal, message: 'Preparing selected frame packs…'});

    for (const id of requested) {
      const existing = this.#sourceFor(id);
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      if (existing && (existing.source !== 'github' || !catalog || existing.version === catalog.version)) {
        if (!this.#installedPack(id)) this.#activate(id, existing.version, existing.root);
        continue;
      }
      if (!catalog) throw new Error(`${PACK_DETAILS[id].displayName} is not published yet.`);
      const root = await this.#installRemote(id, catalog, operation);
      this.#activate(id, catalog.version, root);
    }
    this.#emit({phase: 'activating', percent: 100, receivedBytes: operation.networkTotal, totalBytes: operation.networkTotal, message: 'Frame packs are ready'});
    return this.list();
  }

  remove(id: PackId): PackStatus[] {
    if (REQUIRED_PACK_IDS.includes(id)) throw new Error(`The ${PACK_DETAILS[id].displayName} pack is required and cannot be removed.`);
    this.#state.packs = this.#state.packs.filter((item) => item.id !== id);
    this.#writeState();
    return this.list();
  }

  hasRequiredPacks(): boolean { return REQUIRED_PACK_IDS.every((id) => Boolean(this.#installedPack(id))); }

  resolvePackAsset(relativePath: string): string | null {
    const clean = relativePath.replace(/^\/+/, '');
    if (!clean.startsWith('img/frames/') && !clean.startsWith('img/setSymbols/')) return null;
    for (const pack of this.#state.packs) {
      const candidate = path.resolve(pack.sourceRoot, clean);
      const root = path.resolve(pack.sourceRoot);
      if ((candidate === root || candidate.startsWith(`${root}${path.sep}`)) && existsSync(candidate)) return candidate;
    }
    return null;
  }
}
