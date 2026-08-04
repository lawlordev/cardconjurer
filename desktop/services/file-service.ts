import { dialog } from 'electron';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportRequestSchema } from '../ipc/contracts.js';

const MAX_IMPORT_BYTES = 128 * 1024 * 1024;

function safeName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 180) || 'Set-Conjurer-Export';
}

export class FileService {
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
