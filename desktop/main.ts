import {
  app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell
} from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, watch, writeFileSync, renameSync, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  channelSchema, externalUrlSchema, IPC, packIdSchema, printRequestSchema, saveStateSchema
} from './ipc/contracts.js';
import { FileService } from './services/file-service.js';
import { PackService } from './services/pack-service.js';
import { StorageService } from './services/storage-service.js';
import { UpdateService } from './services/update-service.js';

protocol.registerSchemesAsPrivileged([{
  scheme: 'set-conjurer',
  privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true}
}]);

let mainWindow: BrowserWindow | null = null;
let storage: StorageService | null = null;
let packs: PackService | null = null;
let updates: UpdateService | null = null;
const liveReloadWatchers: FSWatcher[] = [];
const files = new FileService();
const pendingAssociatedFiles: string[] = [];
let rendererReady = false;

function associatedFileFromArguments(values: string[]): string | null {
  return values.find((value) => /\.cardconjurer-(?:card|set)$/i.test(value) && existsSync(value)) || null;
}

const initialAssociatedFile = process.platform === 'win32' ? associatedFileFromArguments(process.argv) : null;
if (initialAssociatedFile) pendingAssociatedFiles.push(initialAssociatedFile);

if (process.env.SET_CONJURER_USER_DATA) app.setPath('userData', path.resolve(process.env.SET_CONJURER_USER_DATA));
const allowIsolatedTestInstance = process.env.SET_CONJURER_ALLOW_TEST_INSTANCE === '1' && !app.isPackaged;
const singleInstance = allowIsolatedTestInstance || app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.setPath('sessionData', path.join(app.getPath('userData'), 'Chromium'));

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  } as Record<string, string>)[extension] || 'application/octet-stream';
}

function containedPath(root: string, relativePath: string): string | null {
  const normalizedRoot = path.resolve(root);
  const candidate = path.resolve(normalizedRoot, relativePath.replace(/^\/+/, ''));
  return candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}${path.sep}`) ? candidate : null;
}

function decodeHandlerSource(source: string): string {
  return source.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function collectInlineHandlerHashes(root: string): string[] {
  const hashes = new Set<string>();
  const allowedExtensions = new Set(['.html', '.js']);
  const ignored = new Set(['node_modules', 'img', 'data', '.git', 'out', 'build']);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      if (ignored.has(entry)) continue;
      const fullPath = path.join(directory, entry);
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }
      if (stat.isDirectory()) visit(fullPath);
      else if (allowedExtensions.has(path.extname(entry))) {
        const source = readFileSync(fullPath, 'utf8');
        const expression = /on(?:click|change|input|submit|keydown|keyup|load|error)\s*=\s*(['"])(.*?)\1/gs;
        for (const match of source.matchAll(expression)) {
          const body = decodeHandlerSource(match[2] || '');
          if (body && !body.includes('${')) hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
        }
      }
    }
  };
  visit(root);
  return [...hashes].sort();
}

function installContentSecurityPolicy(appRoot: string): void {
  const handlerHashes = collectInlineHandlerHashes(appRoot).join(' ');
  const policy = [
    `default-src 'self' set-conjurer:`,
    `script-src 'self' set-conjurer: 'unsafe-hashes' ${handlerHashes}`,
    `script-src-attr 'unsafe-hashes' ${handlerHashes}`,
    `style-src 'self' set-conjurer: 'unsafe-inline'`,
    `img-src 'self' set-conjurer: data: blob: https:`,
    `font-src 'self' set-conjurer: data:`,
    `connect-src 'self' set-conjurer: https://api.scryfall.com https://api.github.com https://github.com https://objects.githubusercontent.com`,
    `media-src 'none'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith('set-conjurer://app/')) {
      return details.responseHeaders ? callback({responseHeaders: details.responseHeaders}) : callback({});
    }
    callback({responseHeaders: {...details.responseHeaders, 'Content-Security-Policy': [policy]}});
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.on('will-download', (event) => event.preventDefault());
}

async function registerApplicationProtocol(appRoot: string): Promise<void> {
  await protocol.handle('set-conjurer', async (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'app') {
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const isPackAsset = relative.startsWith('/img/frames/') || relative.startsWith('/img/setSymbols/');
      let target = isPackAsset ? packs?.resolvePackAsset(relative) || null : null;
      if (!target) target = containedPath(appRoot, relative);
      if (!target || !existsSync(target) || statSync(target).isDirectory()) return new Response('Not found', {status: 404});
      const response = await net.fetch(pathToFileURL(target).toString());
      const body = await response.arrayBuffer();
      return new Response(body, {status: response.status, headers: {'Content-Type': contentType(target), 'Cache-Control': 'no-store'}});
    }
    if (url.hostname === 'user-asset') return new Response('User asset not found', {status: 404});
    return new Response('Unsupported Set Conjurer resource', {status: 404});
  });
}

function validateSender(event: Electron.IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents || !event.senderFrame?.url.startsWith('set-conjurer://app/')) {
    throw new Error('Rejected an untrusted Set Conjurer request.');
  }
}

function preferencePath(): string {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function readOnboardingComplete(): boolean {
  try { return JSON.parse(readFileSync(preferencePath(), 'utf8')).onboardingComplete === true && Boolean(packs?.hasRequiredPacks()); }
  catch { return false; }
}

function writeOnboardingComplete(): void {
  const destination = preferencePath();
  const temporary = `${destination}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({onboardingComplete: true}, null, 2)}\n`, {mode: 0o600});
  renameSync(temporary, destination);
}

async function dispatchAssociatedFiles(): Promise<void> {
  if (!rendererReady || !mainWindow) return;
  while (pendingAssociatedFiles.length) {
    const filePath = pendingAssociatedFiles.shift();
    if (!filePath) continue;
    try { mainWindow.webContents.send(IPC.associatedFile, await files.readAssociatedFile(filePath)); }
    catch (error) { await dialog.showMessageBox(mainWindow, {type: 'error', message: 'Set Conjurer could not open that file.', detail: error instanceof Error ? error.message : String(error)}); }
  }
}

function createWindow(appRoot: string): BrowserWindow {
  const window = new BrowserWindow({
    title: 'Set Conjurer',
    width: 1665,
    height: 1040,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0f16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });
  window.webContents.setWindowOpenHandler(({url}) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return {action: 'deny'};
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('set-conjurer://app/')) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL('set-conjurer://app/index.html?desktop=1');
  updates?.attachWindow(window);
  return window;
}

function installLiveReload(appRoot: string): void {
  if (app.isPackaged) return;
  const targets = ['index.html', 'creator', 'css', 'js', 'core', 'data', 'fonts', 'generated/frame-definitions', 'img/frames', 'img/setSymbols'];
  let reloadTimer: NodeJS.Timeout | null = null;
  const reload = () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      rendererReady = false;
      mainWindow?.webContents.reloadIgnoringCache();
    }, 120);
  };
  for (const relativePath of targets) {
    const target = path.join(appRoot, relativePath);
    if (!existsSync(target)) continue;
    try {
      const watcher = watch(target, statSync(target).isDirectory() ? {recursive: true} : {}, reload);
      liveReloadWatchers.push(watcher);
    } catch (error) {
      console.warn(`Live reload could not watch ${relativePath}:`, error);
    }
  }
}

function registerIPC(): void {
  const trusted = <T extends unknown[], R>(handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => R | Promise<R>) =>
    async (event: Electron.IpcMainInvokeEvent, ...args: T): Promise<R> => { validateSender(event); return handler(event, ...args); };

  ipcMain.handle(IPC.appInfo, trusted(() => ({name: 'Set Conjurer', version: app.getVersion(), platform: process.platform, arch: process.arch, channel: updates?.channel() || 'stable'})));
  ipcMain.handle(IPC.onboardingStatus, trusted(() => readOnboardingComplete()));
  ipcMain.handle(IPC.onboardingComplete, trusted(() => { if (!packs?.hasRequiredPacks()) throw new Error('Install Set Symbols and Standard before continuing.'); writeOnboardingComplete(); }));
  ipcMain.handle(IPC.storageLoad, trusted(() => storage!.load()));
  ipcMain.handle(IPC.storageSave, trusted((_event, value) => storage!.save(saveStateSchema.parse(value))));
  ipcMain.handle(IPC.storageFlush, trusted(() => storage!.flush()));
  ipcMain.handle(IPC.storageSnapshot, trusted((_event, label: string) => storage!.snapshot(String(label || 'pre-update').slice(0, 80))));
  ipcMain.handle(IPC.exportSave, trusted((_event, request) => files.saveExport(request)));
  ipcMain.handle(IPC.importChoose, trusted((_event, kind: 'card' | 'set') => files.chooseImport(kind)));
  ipcMain.handle(IPC.packsList, trusted(() => packs!.list()));
  ipcMain.handle(IPC.packsInstall, trusted((_event, ids: unknown[]) => packs!.install(ids.map((id) => packIdSchema.parse(id)))));
  ipcMain.handle(IPC.packsRemove, trusted((_event, id: unknown) => packs!.remove(packIdSchema.parse(id))));
  ipcMain.handle(IPC.updateState, trusted(() => updates!.state()));
  ipcMain.handle(IPC.updateCheck, trusted(() => updates!.check()));
  ipcMain.handle(IPC.updateBegin, trusted(async () => { await storage!.flush(); await storage!.snapshot(`update-${Date.now()}`); return updates!.begin(); }));
  ipcMain.handle(IPC.updateChannel, trusted(() => updates!.channel()));
  ipcMain.handle(IPC.updateSetChannel, trusted((_event, channel: unknown) => updates!.setChannel(channelSchema.parse(channel))));
  ipcMain.handle(IPC.externalOpen, trusted(async (_event, value: unknown) => { await shell.openExternal(externalUrlSchema.parse(value)); }));
  ipcMain.handle(IPC.reportIssue, trusted(async () => {
    const packSummary = packs!.list().filter((pack) => pack.installed).map((pack) => `${pack.displayName} ${pack.installedVersion}`).join(', ') || 'Standard not installed';
    const body = [`App: ${app.getVersion()}`, `OS: ${process.platform} ${process.arch}`, `Frame packs: ${packSummary}`, '', 'What happened?', ''].join('\n');
    const url = `https://github.com/lawlordev/cardconjurer/issues/new?title=${encodeURIComponent('[Set Conjurer] ')}&body=${encodeURIComponent(body)}`;
    await shell.openExternal(url);
  }));
  ipcMain.handle(IPC.printRun, trusted(async (_event, input: unknown) => {
    const request = printRequestSchema.parse(input);
    return new Promise<{success: boolean; failureReason?: string}>((resolve) => {
      mainWindow!.webContents.print({
        silent: false,
        printBackground: true,
        deviceName: '',
        color: true,
        landscape: true,
        scaleFactor: 100,
        duplexMode: request.backMode === 'standard' ? 'shortEdge' : 'simplex',
        pageSize: request.paper === 'a4' ? 'A4' : 'Letter'
      }, (success, failureReason) => resolve(success ? {success} : {success, failureReason}));
    });
  }));
  ipcMain.handle(IPC.restart, trusted(async () => {
    await storage!.flush();
    const installer = updates!.stagedInstaller();
    if (installer) {
      const error = await shell.openPath(installer);
      if (error) throw new Error(error);
    }
    app.relaunch();
    app.exit(0);
  }));
  ipcMain.on('desktop:renderer-ready', (event) => {
    try { validateSender(event as unknown as Electron.IpcMainInvokeEvent); rendererReady = true; void dispatchAssociatedFiles(); } catch {}
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingAssociatedFiles.push(filePath);
  void dispatchAssociatedFiles();
});

app.on('second-instance', (_event, argv) => {
  const filePath = associatedFileFromArguments(argv);
  if (filePath) pendingAssociatedFiles.push(filePath);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  void dispatchAssociatedFiles();
});

app.whenReady().then(async () => {
  app.setName('Set Conjurer');
  const userDataPath = app.getPath('userData');
  mkdirSync(userDataPath, {recursive: true});
  const appRoot = app.getAppPath();
  storage = new StorageService(userDataPath);
  packs = new PackService({userDataPath, appRoot, resourcesPath: process.resourcesPath, packaged: app.isPackaged});
  updates = new UpdateService({userDataPath, currentVersion: app.getVersion()});
  packs.onProgress((value) => mainWindow?.webContents.send(IPC.packsProgress, value));
  installContentSecurityPolicy(appRoot);
  await registerApplicationProtocol(appRoot);
  registerIPC();
  mainWindow = createWindow(appRoot);
  installLiveReload(appRoot);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow(appRoot); });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { for (const watcher of liveReloadWatchers) watcher.close(); void storage?.flush(); });
