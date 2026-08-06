import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import type {PackId, PackProgress, PackStatus} from '../ipc/contracts.js';
import {PACK_IDS} from '../ipc/contracts.js';
import {downloadArchive, extractArchive} from './pack-archive.js';
import type {StagedPackTarget} from './update-transaction-store.js';

const PACK_DETAILS: Record<PackId, {displayName: string; description: string; required: boolean}> = {
  'set-symbols': {displayName: 'Set Symbols', description: 'Official and bundled custom set-symbol families.', required: true},
  keywords: {displayName: 'Keywords', description: 'Built-in keyword recognition, examples, and reminder text.', required: true},
  standard: {displayName: 'Standard', description: 'Modern frames and every linked standard variant.', required: true},
  'booster-fun': {displayName: 'Booster Fun', description: 'Showcase, borderless, and special-treatment frames.', required: false},
  tokens: {displayName: 'Tokens', description: 'Token, emblem, marker, and helper-card frames.', required: false},
  basics: {displayName: 'Basics', description: 'Full-art and specialty basic-land frames.', required: false},
  legacy: {displayName: 'Legacy', description: 'Classic, old-border, and historical frame families.', required: false},
  custom: {displayName: 'Custom', description: 'Bundled experimental and future user-imported frame families.', required: false}
};
const REQUIRED_PACK_IDS: PackId[] = ['set-symbols', 'keywords', 'standard'];
const RELEASES_URL = 'https://api.github.com/repos/lawlordev/cardconjurer/releases?per_page=30';
// GitHub Releases accepts individual assets up to 2 GiB. Keep the client aligned
// with that immutable-source boundary so legacy 1 GiB pack parts remain usable.
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PACK_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_PACK_FILES = 250_000;

interface InstalledPack {id: PackId; version: string; sourceRoot: string; installedAt: string}
interface InstallationState {schemaVersion: 1 | 2; packs: InstalledPack[]; previousPacks?: InstalledPack[]}
interface CatalogArchive {url: string; sha256: string; archiveBytes: number}
interface CatalogPack {id: PackId; version: string; archives: CatalogArchive[]; archiveBytes: number; installedBytes: number}
interface Catalog {schemaVersion: 2; packs: CatalogPack[]}
interface CatalogV3Version extends CatalogPack {packSchema: number; rendererApiVersion: number; minimumAppVersion: string; revoked?: boolean}
interface CatalogV3 {schemaVersion: 3; packs: Array<{id: PackId; versions: CatalogV3Version[]}>}

export class PackService {
  readonly #statePath: string;
  readonly #packRoot: string;
  readonly #developmentRoot: string | null;
  readonly #seedRoot: string | null;
  readonly #currentVersion: string;
  #state: InstallationState;
  #catalog: Catalog = {schemaVersion: 2, packs: []};
  #progressListeners = new Set<(value: PackProgress) => void>();
  #lastPercent = 0;

  constructor(options: {userDataPath: string; appRoot: string; resourcesPath: string; packaged: boolean; currentVersion?: string}) {
    this.#packRoot = path.join(options.userDataPath, 'packs');
    mkdirSync(this.#packRoot, {recursive: true});
    this.#statePath = path.join(this.#packRoot, 'active.json');
    this.#currentVersion = options.currentVersion || '0.0.0';
    const testPackRoot = process.env.SET_CONJURER_TEST_PACK_ROOT;
    this.#developmentRoot = testPackRoot ? path.resolve(testPackRoot) : (options.packaged ? null : options.appRoot);
    const seedRoot = path.join(options.resourcesPath, 'local-pack-seed');
    this.#seedRoot = existsSync(seedRoot) ? seedRoot : null;
    this.#state = this.#readState();
    try { this.#catalog = this.#validateCatalog(JSON.parse(readFileSync(path.join(this.#packRoot, 'catalog.json'), 'utf8'))); } catch {}
  }

  onProgress(listener: (value: PackProgress) => void): void { this.#progressListeners.add(listener); }

  #emit(progress: PackProgress): void {
    const percent = Math.max(this.#lastPercent, Math.min(100, progress.percent));
    this.#lastPercent = percent;
    for (const listener of this.#progressListeners) listener({...progress, percent});
  }

  #readState(): InstallationState {
    try {
      const value = JSON.parse(readFileSync(this.#statePath, 'utf8')) as InstallationState;
      if ((value.schemaVersion === 1 || value.schemaVersion === 2) && Array.isArray(value.packs)) return value;
    } catch {}
    return {schemaVersion: 1, packs: []};
  }

  #writeState(): void {
    this.#state.schemaVersion = 2;
    const temporary = `${this.#statePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.#state, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#statePath);
  }

  #installedPack(id: PackId): InstalledPack | null {
    const installed = this.#state.packs.find((item) => item.id === id) || null;
    if (!installed || !existsSync(installed.sourceRoot)) return null;
    const requiredPayload = id === 'set-symbols' ? 'img/setSymbols' : id === 'keywords' ? 'js/mseKeywordCatalog.js' : 'img/frames';
    if (!existsSync(path.join(installed.sourceRoot, requiredPayload))) return null;
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
    const raw = input as Catalog | CatalogV3;
    let value: Catalog;
    if (raw?.schemaVersion === 3 && Array.isArray(raw.packs)) {
      const packs = raw.packs.flatMap((history) => {
        if (!PACK_IDS.includes(history.id) || !Array.isArray(history.versions)) return [];
        const compatible = history.versions
          .filter((version) => !version.revoked && version.packSchema === 3 && version.rendererApiVersion === 1)
          .filter((version) => semver.valid(version.version) && semver.valid(version.minimumAppVersion) && semver.gte(this.#currentVersion, version.minimumAppVersion))
          .sort((left, right) => semver.rcompare(left.version, right.version));
        if (!compatible.length) return [];
        const selected = compatible[0]!;
        return [{id: history.id, version: selected.version, archives: selected.archives, archiveBytes: selected.archiveBytes, installedBytes: selected.installedBytes}];
      });
      value = {schemaVersion: 2, packs};
    } else if (raw?.schemaVersion === 2 && Array.isArray(raw.packs)) value = raw;
    else throw new Error('The content-pack catalog is invalid.');
    const seen = new Set<PackId>();
    for (const pack of value.packs) {
      if (!PACK_IDS.includes(pack.id) || seen.has(pack.id) || !Array.isArray(pack.archives) || pack.archives.length < 1) throw new Error('The content-pack catalog contains an unsafe entry.');
      seen.add(pack.id);
      for (const archive of pack.archives) {
        if (!/^https:\/\//.test(archive.url) || !/^[a-f0-9]{64}$/i.test(archive.sha256)) throw new Error('The content-pack catalog contains an unsafe entry.');
        if (archive.archiveBytes < 1 || archive.archiveBytes > MAX_ARCHIVE_BYTES) throw new Error('A content-pack archive exceeds the application safety limit.');
      }
      const declaredArchiveBytes = pack.archives.reduce((total, archive) => total + archive.archiveBytes, 0);
      if (pack.archiveBytes !== declaredArchiveBytes || pack.archiveBytes > MAX_PACK_BYTES || pack.installedBytes < 1 || pack.installedBytes > MAX_EXPANDED_BYTES) throw new Error('A content pack exceeds the application safety limit.');
    }
    return value;
  }

  async refreshCatalog(): Promise<PackStatus[]> {
    if (this.#developmentRoot || this.#seedRoot) return this.list();
    const response = await fetch(RELEASES_URL, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'Set-Conjurer'}});
    if (!response.ok) throw new Error(`Could not check content packs (${response.status}).`);
    const releases = await response.json() as Array<{draft?: boolean; assets?: Array<{name: string; browser_download_url: string}>}>;
    const assets = releases.filter((release) => !release.draft).flatMap((release) => release.assets || []);
    const asset = assets.find((item) => item.name === 'frame-pack-catalog-v3.json') || assets.find((item) => item.name === 'frame-packs.json');
    if (!asset) throw new Error('No content-pack catalog is published for this build yet.');
    const catalogResponse = await fetch(asset.browser_download_url, {headers: {'User-Agent': 'Set-Conjurer'}});
    if (!catalogResponse.ok) throw new Error('Could not download the content-pack catalog.');
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
            this.#emit({phase: 'downloading', percent, receivedBytes: received, totalBytes: operation.networkTotal, message: 'Downloading selected packs…'});
          }
        });
        await extractArchive(archivePath, temporary, limits, (expandedBytes) => {
          const expanded = operation.expandedDone + expandedBytes;
          const received = operation.networkDone + priorArchives + archive.archiveBytes;
          const totalWork = operation.networkTotal + operation.expandedTotal;
          const percent = totalWork ? (received + expanded) / totalWork * 99 : 99;
          this.#emit({phase: 'extracting', percent, receivedBytes: received, totalBytes: operation.networkTotal, message: 'Installing selected packs…'});
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
    this.#emit({phase: 'preparing', percent: 0, receivedBytes: 0, totalBytes: operation.networkTotal, message: 'Preparing selected packs…'});

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
    this.#emit({phase: 'activating', percent: 100, receivedBytes: operation.networkTotal, totalBytes: operation.networkTotal, message: 'Packs are ready'});
    return this.list();
  }

  installedUpdates(): PackStatus[] {
    return this.list().filter((pack) => pack.installed && pack.updateAvailable);
  }

  async stageUpdates(ids: PackId[]): Promise<StagedPackTarget[]> {
    this.#lastPercent = 0;
    const requested = [...new Set(ids)].filter((id) => Boolean(this.#installedPack(id)));
    const catalogs = requested.map((id) => {
      const installed = this.#installedPack(id);
      const catalog = this.#catalog.packs.find((item) => item.id === id);
      if (!installed || !catalog || installed.version === catalog.version) return null;
      return {id, installed, catalog};
    }).filter((item): item is {id: PackId; installed: InstalledPack; catalog: CatalogPack} => Boolean(item));
    const operation = {
      networkDone: 0, expandedDone: 0,
      networkTotal: catalogs.reduce((total, item) => total + item.catalog.archiveBytes, 0),
      expandedTotal: catalogs.reduce((total, item) => total + item.catalog.installedBytes, 0)
    };
    const staged: StagedPackTarget[] = [];
    for (const {id, installed, catalog} of catalogs) {
      const sourceRoot = await this.#installRemote(id, catalog, operation);
      staged.push({id, version: catalog.version, sourceRoot, previousVersion: installed.version, previousSourceRoot: installed.sourceRoot});
    }
    return staged;
  }

  activateStaged(targets: StagedPackTarget[]): void {
    const prior = JSON.parse(JSON.stringify(this.#state)) as InstallationState;
    for (const target of targets) {
      if (!existsSync(target.sourceRoot)) throw new Error(`The staged ${PACK_DETAILS[target.id].displayName} pack is missing.`);
      const health = JSON.parse(readFileSync(path.join(target.sourceRoot, '.set-conjurer-pack.json'), 'utf8')) as {id?: string; version?: string};
      if (health.id !== target.id || health.version !== target.version) throw new Error(`The staged ${PACK_DETAILS[target.id].displayName} pack failed its health check.`);
    }
    try {
      this.#state.previousPacks = prior.packs;
      for (const target of targets) {
        const installed = {id: target.id, version: target.version, sourceRoot: target.sourceRoot, installedAt: new Date().toISOString()};
        const index = this.#state.packs.findIndex((item) => item.id === target.id);
        if (index >= 0) this.#state.packs[index] = installed;
        else this.#state.packs.push(installed);
      }
      this.#writeState();
    } catch (error) {
      this.#state = prior;
      throw error;
    }
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
    if (!clean.startsWith('img/frames/') && !clean.startsWith('img/setSymbols/') && clean !== 'js/mseKeywordCatalog.js') return null;
    for (const pack of this.#state.packs) {
      if (clean === 'js/mseKeywordCatalog.js' && pack.id !== 'keywords') continue;
      if (clean.startsWith('img/setSymbols/') && pack.id !== 'set-symbols') continue;
      const candidate = path.resolve(pack.sourceRoot, clean);
      const root = path.resolve(pack.sourceRoot);
      if ((candidate === root || candidate.startsWith(`${root}${path.sep}`)) && existsSync(candidate)) return candidate;
    }
    return null;
  }
}
