/**
 * Default configuration. These are *configuration*, not hardcoded content:
 * no skill names, categories or file lists live in the source code.
 */
import type { RepoConfig, Settings } from './types';

export const DEFAULT_REPO: RepoConfig = {
  owner: 'anthropics',
  repo: 'skills',
  branch: 'main',
  rootDir: 'skills',
  excludes: [],
};

export const DEFAULT_EXCLUDED_PATTERNS = [
  '**/README.md',
  '**/readme.md',
  '**/LICENSE*',
  '**/CHANGELOG*',
  '**/.github/**',
  '**/node_modules/**',
  '**/.git/**',
];

export const SKILL_EXTENSION = '.md';

export const DEFAULT_SETTINGS: Settings = {
  repository: { ...DEFAULT_REPO },
  behavior: {
    autoSend: false,
    autoAttach: true,
    copyPrompt: false,
    rememberSelection: true,
  },
  interface: {
    theme: 'dark',
    compact: false,
  },
  maxPackageSizeMb: 8,
};

export const STORAGE_KEYS = {
  settings: 'skillbridge.settings.v1',
  selection: 'skillbridge.selection.v1',
  repoCache: 'skillbridge.repoCache.v1',
  skillCachePrefix: 'skillbridge.skill.v1:',
  lastInsert: 'skillbridge.lastInsert.v1',
} as const;

export const LM_ARENA_HOSTS = ['lmarena.ai', 'www.lmarena.ai', 'arena.ai', 'www.arena.ai'] as const;

export const LM_ARENA_CONTENT_SCRIPT_MATCHES = [
  'https://lmarena.ai/*',
  'https://www.lmarena.ai/*',
  'https://arena.ai/*',
  'https://www.arena.ai/*',
];

export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

/** TTL for the tree metadata cache (ms). */
export const REPO_CACHE_TTL_MS = 10 * 60 * 1000;
/** Max age for cached skill contents before revalidation (ms). */
export const SKILL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Soft cap for cached skill bytes (per skill), larger files are not cached. */
export const SKILL_CACHE_MAX_BYTES = 512 * 1024;
export const SKILL_CACHE_MAX_ENTRIES = 400;
