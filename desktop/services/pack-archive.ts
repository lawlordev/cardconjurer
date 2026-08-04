import {createHash} from 'node:crypto';
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, truncateSync, unlinkSync
} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import yauzl, {type Entry, type ZipFile} from 'yauzl';

const USER_AGENT = 'Set-Conjurer';
const RETRY_DELAYS_MS = [0, 300, 1_200];

export interface ArchiveDownload {
  url: string;
  sha256: string;
  archiveBytes: number;
}

export interface DownloadProgress {
  receivedBytes: number;
  resumedBytes: number;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function retryable(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return !/checksum|declared download size|safety limit|unsafe/i.test(error.message);
}

/** Download an archive to disk without ever retaining the archive in memory. */
export async function downloadArchive(
  archive: ArchiveDownload,
  destination: string,
  options: {maxBytes: number; onProgress: (progress: DownloadProgress) => void}
): Promise<void> {
  mkdirSync(path.dirname(destination), {recursive: true});
  const partial = `${destination}.partial`;
  let lastError: unknown = null;

  if (existsSync(destination)) {
    const complete = statSync(destination).size === archive.archiveBytes
      && (await hashFile(destination)).toLowerCase() === archive.sha256.toLowerCase();
    if (complete) {
      options.onProgress({receivedBytes: archive.archiveBytes, resumedBytes: archive.archiveBytes});
      return;
    }
    unlinkSync(destination);
  }

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt]) await delay(RETRY_DELAYS_MS[attempt]!);
    let offset = existsSync(partial) ? statSync(partial).size : 0;
    if (offset > archive.archiveBytes || offset >= options.maxBytes) {
      truncateSync(partial, 0);
      offset = 0;
    }
    options.onProgress({receivedBytes: offset, resumedBytes: offset});

    if (offset === archive.archiveBytes) {
      const existingHash = await hashFile(partial);
      if (existingHash.toLowerCase() === archive.sha256.toLowerCase()) {
        renameSync(partial, destination);
        return;
      }
      truncateSync(partial, 0);
      offset = 0;
    }

    try {
      const headers: Record<string, string> = {'User-Agent': USER_AGENT};
      if (offset) headers.Range = `bytes=${offset}-`;
      const response = await fetch(archive.url, {headers});
      if (!response.body) throw new Error('The frame-pack server returned an empty response.');

      if (offset && response.status !== 206) {
        // A server or proxy ignored Range. Restart cleanly so bytes are never duplicated.
        truncateSync(partial, 0);
        offset = 0;
        if (!response.ok) throw new Error(`Frame-pack download failed (${response.status}).`);
      } else if (!response.ok) {
        throw new Error(`Frame-pack download failed (${response.status}).`);
      }
      if (offset) {
        const contentRange = response.headers.get('content-range');
        if (!contentRange?.startsWith(`bytes ${offset}-`)) throw new Error('The frame-pack server returned an invalid resume range.');
      }

      let received = offset;
      const source = Readable.fromWeb(response.body as never);
      source.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > archive.archiveBytes || received >= options.maxBytes) source.destroy(new Error('The frame-pack download exceeded its safety limit.'));
        else options.onProgress({receivedBytes: received, resumedBytes: offset});
      });
      await pipeline(source, createWriteStream(partial, {flags: offset ? 'a' : 'w', mode: 0o600}));
      if (received !== archive.archiveBytes) throw new Error('The frame pack did not match its declared download size.');
      const actual = await hashFile(partial);
      if (actual.toLowerCase() !== archive.sha256.toLowerCase()) {
        truncateSync(partial, 0);
        throw new Error('The frame pack failed checksum verification.');
      }
      renameSync(partial, destination);
      return;
    } catch (error) {
      lastError = error;
      if (!retryable(error) || attempt === RETRY_DELAYS_MS.length - 1) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The frame-pack download failed.');
}

function openZip(filePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, {lazyEntries: true, validateEntrySizes: true, autoClose: true}, (error, zip) => {
      if (error || !zip) reject(error || new Error('The frame-pack archive could not be opened.'));
      else resolve(zip);
    });
  });
}

function entryStream(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error || new Error('A frame-pack file could not be read.'));
      else resolve(stream);
    });
  });
}

function safeEntryName(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('A frame pack attempted to write outside its install directory.');
  }
  return normalized;
}

/** Extract a ZIP lazily, validating every entry before it reaches the filesystem. */
export async function extractArchive(
  archivePath: string,
  destinationRoot: string,
  limits: {maxExpandedBytes: number; maxFiles: number; expandedBytes: number; files: number},
  onProgress: (expandedBytes: number) => void
): Promise<void> {
  const zip = await openZip(archivePath);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      zip.close();
      reject(error);
    };
    zip.on('error', fail);
    zip.on('end', () => { if (!settled) { settled = true; resolve(); } });
    zip.on('entry', (entry: Entry) => {
      void (async () => {
        const normalized = safeEntryName(entry.fileName);
        const unixMode = entry.externalFileAttributes >>> 16;
        if ((unixMode & 0o170000) === 0o120000) throw new Error('Frame-pack symbolic links are not allowed.');
        const target = path.resolve(destinationRoot, normalized);
        const root = path.resolve(destinationRoot);
        if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('A frame pack attempted to write outside its install directory.');
        if (/\/$/.test(normalized)) {
          mkdirSync(target, {recursive: true});
          zip.readEntry();
          return;
        }
        limits.files += 1;
        limits.expandedBytes += entry.uncompressedSize;
        if (limits.files > limits.maxFiles || limits.expandedBytes > limits.maxExpandedBytes) throw new Error('The frame pack expanded beyond its declared safety limits.');
        mkdirSync(path.dirname(target), {recursive: true});
        const source = await entryStream(zip, entry);
        await pipeline(source, createWriteStream(target, {flags: 'wx', mode: 0o600}));
        onProgress(limits.expandedBytes);
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}
