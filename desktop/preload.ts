import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, PackId, ReleaseChannel, UpdateState, WorkspaceMutation, WorkspaceState } from './ipc/contracts.js';

// Sandboxed preloads cannot load local CommonJS modules at runtime. Keep this
// frozen channel table self-contained; contracts.ts remains the typed source
// of truth used by the privileged main process.
const IPC = Object.freeze({
  appInfo: 'desktop:app-info', onboardingStatus: 'desktop:onboarding-status', onboardingComplete: 'desktop:onboarding-complete', restart: 'desktop:restart', reportIssue: 'desktop:report-issue',
  storageLoad: 'desktop:storage-load', storageSave: 'desktop:storage-save', storageFlush: 'desktop:storage-flush', storageSnapshot: 'desktop:storage-snapshot',
  storageIngestAssets: 'desktop:storage-ingest-assets', storageMaterializeAssets: 'desktop:storage-materialize-assets',
  storageApplyMutation: 'desktop:storage-apply-mutation',
  exportSave: 'desktop:export-save', archiveBegin: 'desktop:archive-begin', archiveAppend: 'desktop:archive-append', archiveComplete: 'desktop:archive-complete', archiveSave: 'desktop:archive-save', archiveCancel: 'desktop:archive-cancel', importChoose: 'desktop:import-choose', associatedFile: 'desktop:associated-file',
  packsList: 'desktop:packs-list', packsRefresh: 'desktop:packs-refresh', packsInstall: 'desktop:packs-install', packsRemove: 'desktop:packs-remove', packsProgress: 'desktop:packs-progress',
  updateState: 'desktop:update-state', updateCheck: 'desktop:update-check', updateBegin: 'desktop:update-begin', updateChannel: 'desktop:update-channel', updateSetChannel: 'desktop:update-set-channel', updateChanged: 'desktop:update-changed',
  printRun: 'desktop:print-run', externalOpen: 'desktop:external-open'
});

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: DesktopAPI = Object.freeze({
  version: 1,
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    onboardingComplete: () => ipcRenderer.invoke(IPC.onboardingStatus),
    completeOnboarding: () => ipcRenderer.invoke(IPC.onboardingComplete),
    restart: () => ipcRenderer.invoke(IPC.restart),
    reportIssue: () => ipcRenderer.invoke(IPC.reportIssue)
  },
  storage: {
    loadState: () => ipcRenderer.invoke(IPC.storageLoad),
    saveState: (state: WorkspaceState) => ipcRenderer.invoke(IPC.storageSave, state),
		applyMutation: (mutation: WorkspaceMutation) => ipcRenderer.invoke(IPC.storageApplyMutation, mutation),
		ingestAssets: <T>(value: T) => ipcRenderer.invoke(IPC.storageIngestAssets, value),
		materializeAssets: <T>(value: T) => ipcRenderer.invoke(IPC.storageMaterializeAssets, value),
    flush: () => ipcRenderer.invoke(IPC.storageFlush),
    createPreUpdateSnapshot: (label: string) => ipcRenderer.invoke(IPC.storageSnapshot, label)
  },
  files: {
    saveExport: (request: Parameters<DesktopAPI['files']['saveExport']>[0]) => ipcRenderer.invoke(IPC.exportSave, request),
    beginArchive: (request: Parameters<DesktopAPI['files']['beginArchive']>[0]) => ipcRenderer.invoke(IPC.archiveBegin, request),
    appendArchive: (id: string, chunk: Uint8Array) => ipcRenderer.invoke(IPC.archiveAppend, id, chunk),
    completeArchive: (id: string) => ipcRenderer.invoke(IPC.archiveComplete, id),
    saveArchive: (id: string) => ipcRenderer.invoke(IPC.archiveSave, id),
    cancelArchive: (id: string) => ipcRenderer.invoke(IPC.archiveCancel, id),
    chooseImport: (kind: 'card' | 'set') => ipcRenderer.invoke(IPC.importChoose, kind),
    onAssociatedFile: (listener: Parameters<DesktopAPI['files']['onAssociatedFile']>[0]) => subscribe(IPC.associatedFile, listener)
  },
  packs: {
    list: () => ipcRenderer.invoke(IPC.packsList),
    refresh: () => ipcRenderer.invoke(IPC.packsRefresh),
    install: (ids: PackId[]) => ipcRenderer.invoke(IPC.packsInstall, ids),
    remove: (id: PackId) => ipcRenderer.invoke(IPC.packsRemove, id),
    onProgress: (listener: Parameters<DesktopAPI['packs']['onProgress']>[0]) => subscribe(IPC.packsProgress, listener)
  },
  updates: {
    state: () => ipcRenderer.invoke(IPC.updateState),
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    begin: () => ipcRenderer.invoke(IPC.updateBegin),
    channel: () => ipcRenderer.invoke(IPC.updateChannel),
    setChannel: (channel: ReleaseChannel) => ipcRenderer.invoke(IPC.updateSetChannel, channel),
    onState: (listener: (state: UpdateState) => void) => subscribe(IPC.updateChanged, listener)
  },
  print: {
    run: (request: Parameters<DesktopAPI['print']['run']>[0]) => ipcRenderer.invoke(IPC.printRun, request)
  },
  external: {
    open: (url: string) => ipcRenderer.invoke(IPC.externalOpen, url)
  }
});

contextBridge.exposeInMainWorld('setConjurerDesktop', api);
ipcRenderer.send('desktop:renderer-ready');
