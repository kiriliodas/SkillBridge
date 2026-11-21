/**
 * Shared domain types used across the extension (UI, worker, content script).
 * Kept dependency-free so that any context can import them.
 */

export type SkillId = string; // stable id derived from repo-relative path

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  /** Optional root directory containing the Skills. '' = repository root. */
  rootDir: string;
  /** Glob-ish patterns for files/directories to ignore (in addition to defaults). */
  excludes: string[];
}

export interface SkillEntry {
  id: SkillId;
  /** Display name derived from the file name (extension stripped, prettified). */
  name: string;
  /** File name including extension, e.g. "kotlin-standards.md". */
  fileName: string;
  /** Repository-relative path, e.g. "Android/Kotlin/kotlin-standards.md". */
  path: string;
  /** Path relative to the configured root, e.g. "Android/Kotlin/kotlin-standards.md". */
  relPath: string;
  /** Category segments, e.g. ["Android", "Kotlin"]. Empty for root-level files. */
  categories: string[];
  /** Human-readable category hierarchy, e.g. "Android / Kotlin" ('' for root). */
  categoryLabel: string;
  /** Size in bytes from the git tree (if known). */
  size: number;
}

export interface CategoryNode {
  /** Segment name, e.g. "Android". */
  name: string;
  /** Full category hierarchy including this node. */
  path: string[];
  /** Slash-joined sub-path relative to the root ('' for the root node). */
  id: string;
  children: CategoryNode[];
  skills: SkillEntry[];
  /** Number of skills in this node and all descendants. */
  totalSkills: number;
}

export interface RepoSnapshot {
  config: RepoConfig;
  /** Abbreviated commit SHA the tree was read at; used for cache invalidation. */
  commit: string;
  fetchedAt: number;
  skills: SkillEntry[];
  tree: CategoryNode;
  /** Non-fatal warnings produced while building the tree. */
  warnings: string[];
}

export type RepoStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RepoErrorInfo {
  code:
    | 'INVALID_CONFIG'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'RATE_LIMITED'
    | 'NETWORK'
    | 'EMPTY_ROOT'
    | 'TREE_TRUNCATED'
    | 'UNKNOWN';
  message: string;
  /** Actionable hint shown in the UI. */
  hint?: string;
  status?: number;
}

/* ------------------------------------------------------------------ */
/* Compilation                                                        */
/* ------------------------------------------------------------------ */

export interface SkillSource {
  id: SkillId;
  name: string;
  path: string;
  categories: string[];
  content: string;
}

export interface ManifestEntry {
  index: number;
  id: SkillId;
  name: string;
  path: string;
  categoryLabel: string;
  categories: string[];
  /** Content length in UTF-16 code units. */
  chars: number;
  /** Length in bytes when encoded as UTF-8. */
  bytes: number;
  lines: number;
  sha256: string;
  /** Whether the source changed between resolution and compilation (always false on success). */
  changed?: boolean;
}

export interface SkillPackage {
  packageId: string;
  packageName: string;
  fileName: string;
  repository: string;
  owner: string;
  repo: string;
  branch: string;
  compiledAt: string;
  /** Full package text (Markdown). */
  markdown: string;
  skills: ManifestEntry[];
  totals: {
    skills: number;
    categories: number;
    chars: number;
    bytes: number;
    lines: number;
  };
}

export interface CompileOptions {
  owner: string;
  repo: string;
  branch: string;
  /** Optional root directory (recorded in the header only). */
  rootDir?: string;
  /** Fixed timestamp (ISO string) for deterministic output in tests. */
  now?: Date | string;
  packageId?: string;
  /** Status line recorded inside the manifest for the changed-skill check. */
  verified?: boolean;
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

export type ThemePreference = 'system' | 'dark' | 'light';

export interface Settings {
  repository: RepoConfig;
  behavior: {
    autoSend: boolean;
    autoAttach: boolean;
    copyPrompt: boolean;
    rememberSelection: boolean;
  };
  interface: {
    theme: ThemePreference;
    compact: boolean;
  };
  /** Soft limit; the UI warns when a package grows beyond it. */
  maxPackageSizeMb: number;
}

export interface SelectionState {
  /** Selected skill ids. */
  ids: string[];
  /** When true all current + future skills are selected. */
  allSelected: boolean;
}

/* ------------------------------------------------------------------ */
/* LM Arena integration                                               */
/* ------------------------------------------------------------------ */

export interface InsertPackagePayload {
  fileName: string;
  content: string;
  mimeType: string;
}

export interface InsertPayload {
  package: InsertPackagePayload;
  prompt: string;
  packageId: string;
  autoSend: boolean;
  autoAttach: boolean;
  /** Base64 data URL used to rebuild the File inside the content script. */
  packageDataUrl: string;
}

export type IntegrationStep =
  | 'detect-tab'
  | 'content-script'
  | 'locate-composer'
  | 'attach-package'
  | 'verify-attachment'
  | 'insert-prompt'
  | 'verify-prompt'
  | 'send';

export type StepStatus = 'ok' | 'failed' | 'skipped' | 'warning';

export interface StepResult {
  step: IntegrationStep;
  status: StepStatus;
  message: string;
}

export type IntegrationOutcome =
  | 'attached-and-filled'
  | 'sent'
  | 'attached-only'
  | 'prompt-only'
  | 'failed';

export interface IntegrationReport {
  outcome: IntegrationOutcome;
  steps: StepResult[];
  /** Identifies the failed step, if any. */
  failedStep?: IntegrationStep;
  notes?: string[];
  diagnostics?: DomDiagnostics;
}

export interface DomDiagnostics {
  url: string;
  host: string;
  composerFound: boolean;
  composerKind?: 'textarea' | 'contenteditable';
  fileInputs: number;
  fileInputSelectors: string[];
  attachButtons: { label: string; selector: string }[];
  sendButtons: { label: string; selector: string }[];
  candidateForms: number;
}

export interface ManagerState {
  settings: Settings;
  selection: SelectionState;
  repo: RepoSnapshot | null;
  status: RepoStatus;
  error: RepoErrorInfo | null;
  /** Bumped when selection/settings change so views share one source of truth. */
  revision: number;
}

export type RuntimeRequest =
  | { type: 'GET_STATE' }
  | { type: 'REFRESH_REPO'; force?: boolean }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SET_SELECTION'; selection: SelectionState }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'GET_SKILL_CONTENT'; id: string }
  | { type: 'PREFETCH_SKILLS'; ids: string[] }
  | { type: 'GET_STORAGE_STATS' }
  | { type: 'CLEAR_CACHE' }
  | { type: 'OPEN_MANAGER' }
  | { type: 'GET_LAST_PACKAGE' }
  | { type: 'INSERT_INTO_LM_ARENA'; settings?: Partial<Settings> };

export type RequestResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: RepoErrorInfo | { code: string; message: string } };

export interface LastPackage {
  packageId: string;
  fileName: string;
  markdown: string;
  prompt: string;
  createdAt: number;
}

export interface StorageStats {
  cachedSkills: number;
  cachedBytes: number;
  repoCache: boolean;
  snapshotSkills: number | null;
}
