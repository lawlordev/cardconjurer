import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, open, readFile, rename, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { archiveBeginSchema, archiveIdSchema, exportRequestSchema } from '../ipc/contracts.js';

const MAX_IMPORT_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_CHUNK_BYTES = 4 * 1024 * 1024;

interface ArchiveSession {
  directory: string;
  filePath: string;
  handle: FileHandle;
  suggestedName: string;
  complete: boolean;
  writes: Promise<void>;
}

function safeName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 180) || 'Set-Conjurer-Export';
}

export class FileService {
  private readonly archives = new Map<string, ArchiveSession>();

  async saveExport(input: unknown): Promise<{canceled: boolean; path: string | null}> {
    const request = exportRequestSchema.parse(input);
    const extension = request.extension;
    const defaultName = safeName(request.suggestedName.endsWith(`.${extension}`) ? request.suggestedName : `${request.suggestedName}.${extension}`);
    const filterName = extension === 'cardconjurer-card' ? 'Set Conjurer Card' : extension === 'cardconjurer-set' ? 'Set Conjurer Set' : extension === 'png' ? 'PNG Image' : extension === 'jpg' ? 'JPEG Image' : 'JSON';
    const result = await dialog.showSaveDialog({
      title: 'Export from Set Conjurer',
      defaultPath: defaultName,
      filters: [{name: filterName, extensions: [extension]}]
    });
    if (result.canceled || !result.filePath) return {canceled: true, path: null};
    const temporary = `${result.filePath}.set-conjurer-partial`;
    if (request.encoding === 'base64') await writeFile(temporary, Buffer.from(request.content, 'base64'), {mode: 0o600});
    else await writeFile(temporary, request.content, {encoding: 'utf8', mode: 0o600});
    await rename(temporary, result.filePath);
    return {canceled: false, path: result.filePath};
  }

  async beginArchive(input: unknown): Promise<{id: string}> {
    const request = archiveBeginSchema.parse(input);
    const id = randomUUID();
    const directory = await mkdtemp(path.join(tmpdir(), 'set-conjurer-export-'));
    const filePath = path.join(directory, `${id}.zip`);
    const handle = await open(filePath, 'wx', 0o600);
    this.archives.set(id, {
      directory,
      filePath,
      handle,
      suggestedName: safeName(request.suggestedName.endsWith('.zip') ? request.suggestedName : `${request.suggestedName}.zip`),
      complete: false,
      writes: Promise.resolve()
    });
    return {id};
  }

  async appendArchive(idInput: unknown, chunkInput: unknown): Promise<void> {
    const id = archiveIdSchema.parse(idInput);
    const session = this.archives.get(id);
    if (!session || session.complete) throw new Error('That ZIP export session is no longer writable.');
    if (!(chunkInput instanceof Uint8Array)) throw new Error('ZIP export chunks must be binary data.');
    if (chunkInput.byteLength === 0 || chunkInput.byteLength > MAX_ARCHIVE_CHUNK_BYTES) throw new Error('ZIP export chunk size is invalid.');
    const chunk = Buffer.from(chunkInput);
    session.writes = session.writes.then(async () => { await session.handle.writeFile(chunk); });
    await session.writes;
  }

  async completeArchive(idInput: unknown): Promise<void> {
    const id = archiveIdSchema.parse(idInput);
    const session = this.archives.get(id);
    if (!session || session.complete) throw new Error('That ZIP export session cannot be completed.');
    await session.writes;
    await session.handle.sync();
    await session.handle.close();
    session.complete = true;
  }

  async saveArchive(idInput: unknown): Promise<{canceled: boolean; path: string | null}> {
    const id = archiveIdSchema.parse(idInput);
    const session = this.archives.get(id);
    if (!session || !session.complete) throw new Error('That ZIP export session is not ready to save.');
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export from Set Conjurer',
        defaultPath: session.suggestedName,
        filters: [{name: 'ZIP Archive', extensions: ['zip']}]
      });
      if (result.canceled || !result.filePath) return {canceled: true, path: null};
      const temporary = `${result.filePath}.set-conjurer-partial`;
      await rm(temporary, {force: true});
      await copyFile(session.filePath, temporary);
      await rename(temporary, result.filePath);
      return {canceled: false, path: result.filePath};
    } finally {
      await this.removeArchive(id);
    }
  }

  async cancelArchive(idInput: unknown): Promise<void> {
    const id = archiveIdSchema.parse(idInput);
    if (this.archives.has(id)) await this.removeArchive(id);
  }

  private async removeArchive(id: string): Promise<void> {
    const session = this.archives.get(id);
    if (!session) return;
    this.archives.delete(id);
    try { await session.writes; } catch {}
    if (!session.complete) {
      try { await session.handle.close(); } catch {}
    }
    await rm(session.directory, {recursive: true, force: true});
  }

  async chooseImport(kind: 'card' | 'set'): Promise<{canceled: boolean; name: string | null; content: string | null}> {
    const extension = kind === 'card' ? 'cardconjurer-card' : 'cardconjurer-set';
    const result = await dialog.showOpenDialog({
      title: kind === 'card' ? 'Import a Set Conjurer card' : 'Import a Set Conjurer set',
      properties: ['openFile'],
      filters: [{name: kind === 'card' ? 'Set Conjurer Card' : 'Set Conjurer Set', extensions: [extension]}]
    });
    if (result.canceled || !result.filePaths[0]) return {canceled: true, name: null, content: null};
    const filePath = result.filePaths[0];
    const content = await readFile(filePath, {encoding: 'utf8'});
    if (Buffer.byteLength(content) > MAX_IMPORT_BYTES) throw new Error('That Set Conjurer file is larger than the 128 MB import limit.');
    return {canceled: false, name: path.basename(filePath), content};
  }

  async readAssociatedFile(filePath: string): Promise<{name: string; content: string}> {
    const extension = path.extname(filePath).toLowerCase();
    if (!['.cardconjurer-card', '.cardconjurer-set'].includes(extension)) throw new Error('Unsupported Set Conjurer file type.');
    const content = await readFile(filePath, {encoding: 'utf8'});
    if (Buffer.byteLength(content) > MAX_IMPORT_BYTES) throw new Error('That Set Conjurer file is larger than the 128 MB import limit.');
    return {name: path.basename(filePath), content};
  }
}
