import { z } from 'zod';

export const PACK_IDS = ['standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom'] as const;
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
  extension: z.enum(['cardconjurer-card', 'cardconjurer-set', 'json']),
  content: z.string().max(128 * 1024 * 1024)
}).strict();

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
  availableVersion: string;
  archiveBytes: number;
  installedBytes: number;
  available: boolean;
  source: 'development' | 'bundled-seed' | 'github' | 'unavailable';
}

export interface UpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'staged' | 'failed';
  progress: number;
  message: string;
  availableVersion: string | null;
  includesApp: boolean;
  packIds: PackId[];
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
    install(ids: PackId[]): Promise<PackStatus[]>;
    remove(id: PackId): Promise<PackStatus[]>;
    onProgress(listener: (progress: {id: PackId; percent: number; message: string}) => void): () => void;
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
