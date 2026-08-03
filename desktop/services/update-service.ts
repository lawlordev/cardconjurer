import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import semver from 'semver';
import type { BrowserWindow } from 'electron';
import type { PackId, ReleaseChannel, UpdateState } from '../ipc/contracts.js';

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

const INITIAL_STATE: UpdateState = {
  phase: 'idle', progress: 0, message: 'Up to date', availableVersion: null, includesApp: false, packIds: []
};

export class UpdateService {
  #state: UpdateState = {...INITIAL_STATE};
  #channel: ReleaseChannel;
  #release: GitHubRelease | null = null;
  #window: BrowserWindow | null = null;
  readonly #stagingRoot: string;
  readonly #currentVersion: string;
  readonly #preferencesPath: string;

  constructor(options: {userDataPath: string; currentVersion: string}) {
    this.#stagingRoot = path.join(options.userDataPath, 'staging', 'updates');
    this.#preferencesPath = path.join(options.userDataPath, 'update-preferences.json');
    this.#currentVersion = options.currentVersion;
    mkdirSync(this.#stagingRoot, {recursive: true});
    this.#channel = this.#readChannel();
  }

  attachWindow(window: BrowserWindow): void {
    this.#window = window;
  }

  #readChannel(): ReleaseChannel {
    try {
      const value = JSON.parse(readFileSync(this.#preferencesPath, 'utf8')) as {channel?: ReleaseChannel};
      return value.channel === 'beta' ? 'beta' : 'stable';
    } catch {
      return 'stable';
    }
  }

  #emit(state: UpdateState): UpdateState {
    this.#state = state;
    this.#window?.webContents.send('desktop:update-changed', state);
    return state;
  }

  state(): UpdateState {
    return {...this.#state, packIds: [...this.#state.packIds] as PackId[]};
  }

  channel(): ReleaseChannel {
    return this.#channel;
  }

  setChannel(channel: ReleaseChannel): ReleaseChannel {
    this.#channel = channel;
    const temporary = `${this.#preferencesPath}.tmp`;
    require('node:fs').writeFileSync(temporary, `${JSON.stringify({channel}, null, 2)}\n`, {mode: 0o600});
    renameSync(temporary, this.#preferencesPath);
    return channel;
  }

  async check(): Promise<UpdateState> {
    this.#emit({...INITIAL_STATE, phase: 'checking', message: 'Checking for updates…'});
    try {
      const response = await fetch('https://api.github.com/repos/lawlordev/cardconjurer/releases?per_page=30', {
        headers: {'Accept': 'application/vnd.github+json', 'User-Agent': `Set-Conjurer/${this.#currentVersion}`}
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
      const releases = await response.json() as GitHubRelease[];
      const eligible = releases
        .filter((release) => !release.draft && /^v\d/.test(release.tag_name))
        .filter((release) => this.#channel === 'beta' || !release.prerelease)
        .filter((release) => semver.valid(release.tag_name.slice(1)))
        .filter((release) => semver.gt(release.tag_name.slice(1), this.#currentVersion))
        .sort((left, right) => semver.rcompare(left.tag_name.slice(1), right.tag_name.slice(1)));
      this.#release = eligible[0] || null;
      if (!this.#release) return this.#emit({...INITIAL_STATE});
      return this.#emit({
        phase: 'available', progress: 0, message: `Set Conjurer ${this.#release.tag_name.slice(1)} is available`,
        availableVersion: this.#release.tag_name.slice(1), includesApp: true, packIds: []
      });
    } catch (error) {
      return this.#emit({...INITIAL_STATE, phase: 'failed', message: error instanceof Error ? error.message : 'Update check failed.'});
    }
  }

  #assetForCurrentPlatform(): GitHubAsset | null {
    if (!this.#release) return null;
    const arch = process.arch;
    const candidates = process.platform === 'darwin'
      ? this.#release.assets.filter((asset) => asset.name.endsWith('.dmg') && asset.name.includes(arch))
      : this.#release.assets.filter((asset) => /Setup\.exe$/i.test(asset.name) && (asset.name.includes('x64') || !asset.name.includes('arm64')));
    return candidates[0] || null;
  }

  async begin(): Promise<UpdateState> {
    if (!this.#release) await this.check();
    if (!this.#release) return this.state();
    const asset = this.#assetForCurrentPlatform();
    if (!asset) return this.#emit({...this.#state, phase: 'failed', message: 'This release has no installer for this computer.'});
    const checksumAsset = this.#release.assets.find((item) => item.name === `${asset.name}.sha256` || item.name === 'SHA256SUMS');
    if (!checksumAsset) return this.#emit({...this.#state, phase: 'failed', message: 'The release is missing signed checksum metadata.'});
    const operationRoot = path.join(this.#stagingRoot, this.#release.tag_name.slice(1));
    mkdirSync(operationRoot, {recursive: true});
    const destination = path.join(operationRoot, asset.name);
    const temporary = `${destination}.partial`;
    try {
      this.#emit({...this.#state, phase: 'downloading', progress: 0, message: 'Downloading update…'});
      const response = await fetch(asset.browser_download_url, {headers: {'User-Agent': `Set-Conjurer/${this.#currentVersion}`}});
      if (!response.ok || !response.body) throw new Error(`Update download failed (${response.status}).`);
      const output = createWriteStream(temporary, {flags: 'w', mode: 0o600});
      const hash = createHash('sha256');
      let received = 0;
      const source = Readable.fromWeb(response.body as never);
      source.on('data', (chunk: Buffer) => {
        received += chunk.length;
        hash.update(chunk);
        this.#emit({...this.#state, phase: 'downloading', progress: Math.min(99, Math.round(received / asset.size * 100)), message: 'Downloading update…'});
      });
      await new Promise<void>((resolve, reject) => {
        source.pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
        source.on('error', reject);
      });
      renameSync(temporary, destination);
      this.#emit({...this.#state, phase: 'verifying', progress: 100, message: 'Verifying update…'});
      const checksumResponse = await fetch(checksumAsset.browser_download_url, {headers: {'User-Agent': `Set-Conjurer/${this.#currentVersion}`}});
      if (!checksumResponse.ok) throw new Error('Could not download the release checksum.');
      const checksums = await checksumResponse.text();
      const expected = checksums.split(/\r?\n/).find((line) => line.includes(asset.name))?.trim().split(/\s+/)[0];
      const actual = hash.digest('hex');
      if (!expected || expected.toLowerCase() !== actual.toLowerCase()) throw new Error('The downloaded update did not match its checksum.');
      return this.#emit({...this.#state, phase: 'staged', progress: 100, message: 'Update ready — restart to install'});
    } catch (error) {
      return this.#emit({...this.#state, phase: 'failed', message: error instanceof Error ? error.message : 'Update failed.'});
    }
  }

  stagedInstaller(): string | null {
    if (this.#state.phase !== 'staged' || !this.#release) return null;
    const asset = this.#assetForCurrentPlatform();
    if (!asset) return null;
    const candidate = path.join(this.#stagingRoot, this.#release.tag_name.slice(1), asset.name);
    return existsSync(candidate) ? candidate : null;
  }
}
