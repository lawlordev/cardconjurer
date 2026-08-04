import { z } from 'zod';

export const PACK_IDS = ['set-symbols', 'standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom'] as const;
export type PackId = typeof PACK_IDS[number];
export type ReleaseChannel = 'stable' | 'beta';

export const saveStateSchema = z.object({
  sets: z.array(z.unknown()),
  cards: z.array(z.unknown()),
  histories: z.record(z.string(), z.unknown()),
  activeSetId: z.string().nullable(),
  revision: z.number()
}).strict();

export type WorkspaceState = z.infer<typeof saveStateSchema>;

export const externalUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:';
}, 'Only HTTPS links may be opened.');

export const packIdSchema = z.enum(PACK_IDS);
export const channelSchema = z.enum(['stable', 'beta']);

export const exportRequestSchema = z.object({
  suggestedName: z.string().min(1).max(180),
  extension: z.enum(['cardconjurer-card', 'cardconjurer-set', 'json', 'png', 'jpg']),
  encoding: z.enum(['utf8', 'base64']).optional(),
  content: z.string().max(128 * 1024 * 1024)
}).strict().superRefine((request, context) => {
  const image = request.extension === 'png' || request.extension === 'jpg';
  if (image && request.encoding !== 'base64') context.addIssue({code: 'custom', path: ['encoding'], message: 'Image exports must use base64 encoding.'});
  if (!image && request.encoding === 'base64') context.addIssue({code: 'custom', path: ['encoding'], message: 'Only image exports may use base64 encoding.'});
  if (request.encoding === 'base64' && !/^[a-z0-9+/]*={0,2}$/i.test(request.content)) context.addIssue({code: 'custom', path: ['content'], message: 'Image export content is not valid base64.'});
});

export const printRequestSchema = z.object({
  paper: z.enum(['letter', 'a4']),
  backMode: z.enum(['standard', 'none'])
}).strict();

export interface PackStatus {
  id: PackId;
  displayName: string;
  description: string;
  required: boolean;
  installed: boolean;
  installedVersion: string | null;
  availableVersion: string | null;
  archiveBytes: number;
  installedBytes: number;
  available: boolean;
  updateAvailable: boolean;
  source: 'development' | 'bundled-seed' | 'github' | 'unavailable';
}

export interface PackProgress {
  phase: 'preparing' | 'downloading' | 'extracting' | 'activating';
  percent: number;
  message: string;
  receivedBytes: number;
  totalBytes: number;
}

export interface UpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'staged' | 'failed' | 'compatibility-blocked' | 'recovery-required';
  progress: number;
  message: string;
  availableVersion: string | null;
  includesApp: boolean;
  packIds: PackId[];
  transactionId: string | null;
  totalBytes: number;
  completedBytes: number;
  lastCheckedAt: string | null;
  recoverable: boolean;
  items: Array<{
    kind: 'app' | 'pack';
    id: string;
    displayName: string;
    currentVersion: string | null;
    targetVersion: string;
    bytes: number;
    phase: 'available' | 'downloading' | 'verifying' | 'staged' | 'failed';
    error: string | null;
  }>;
}

export interface DesktopAPI {
  version: 1;
  app: {
    info(): Promise<{name: string; version: string; platform: string; arch: string; channel: ReleaseChannel}>;
    onboardingComplete(): Promise<boolean>;
    completeOnboarding(): Promise<void>;
    restart(): Promise<void>;
    reportIssue(): Promise<void>;
  };
  storage: {
    loadState(): Promise<WorkspaceState>;
    saveState(state: WorkspaceState): Promise<WorkspaceState>;
    flush(): Promise<void>;
    createPreUpdateSnapshot(label: string): Promise<string>;
  };
  files: {
    saveExport(request: z.infer<typeof exportRequestSchema>): Promise<{canceled: boolean; path: string | null}>;
    chooseImport(kind: 'card' | 'set'): Promise<{canceled: boolean; name: string | null; content: string | null}>;
    onAssociatedFile(listener: (file: {name: string; content: string}) => void): () => void;
  };
  packs: {
    list(): Promise<PackStatus[]>;
    refresh(): Promise<PackStatus[]>;
    install(ids: PackId[]): Promise<PackStatus[]>;
    remove(id: PackId): Promise<PackStatus[]>;
    onProgress(listener: (progress: PackProgress) => void): () => void;
  };
  updates: {
    state(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    begin(): Promise<UpdateState>;
    channel(): Promise<ReleaseChannel>;
    setChannel(channel: ReleaseChannel): Promise<ReleaseChannel>;
    onState(listener: (state: UpdateState) => void): () => void;
  };
  print: {
    run(request: z.infer<typeof printRequestSchema>): Promise<{success: boolean; failureReason?: string}>;
  };
  external: {
    open(url: string): Promise<void>;
  };
}

export const IPC = Object.freeze({
  appInfo: 'desktop:app-info',
  onboardingStatus: 'desktop:onboarding-status',
  onboardingComplete: 'desktop:onboarding-complete',
  restart: 'desktop:restart',
  reportIssue: 'desktop:report-issue',
  storageLoad: 'desktop:storage-load',
  storageSave: 'desktop:storage-save',
  storageFlush: 'desktop:storage-flush',
  storageSnapshot: 'desktop:storage-snapshot',
  exportSave: 'desktop:export-save',
  importChoose: 'desktop:import-choose',
  associatedFile: 'desktop:associated-file',
  packsList: 'desktop:packs-list',
  packsRefresh: 'desktop:packs-refresh',
  packsInstall: 'desktop:packs-install',
  packsRemove: 'desktop:packs-remove',
  packsProgress: 'desktop:packs-progress',
  updateState: 'desktop:update-state',
  updateCheck: 'desktop:update-check',
  updateBegin: 'desktop:update-begin',
  updateChannel: 'desktop:update-channel',
  updateSetChannel: 'desktop:update-set-channel',
  updateChanged: 'desktop:update-changed',
  printRun: 'desktop:print-run',
  externalOpen: 'desktop:external-open'
});
