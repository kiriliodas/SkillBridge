/**
 * The insert flow shared by the popup and the manager.
 *
 * Order of operations is important for honesty and for the fallback:
 *  1. Compile the package in-page from cached/network content (single source of
 *     truth for what is "the package").
 *  2. Hand it to the service worker, which finds the LM Arena tab and drives
 *     the adapter.
 *  3. Whatever the result, keep package + prompt so download/copy always work.
 */
import { useCallback, useState } from 'react';
import type { IntegrationReport, ManagerState, SkillPackage } from '../../shared/types';
import { buildPackage, PackageBuildError } from '../../services/packageService';
import { generateInstallPrompt } from '../../core/prompt';
import { ChromeLocalStore, MemoryStore, RepoCache } from '../../services/cache';
import type { Runtime } from './runtime';
import { RuntimeError } from './runtime';

export interface InsertFlowState {
  phase: 'idle' | 'compiling' | 'integrating' | 'done';
  progress: { done: number; total: number; path: string } | null;
  error: string | null;
  report: IntegrationReport | null;
  pkg: SkillPackage | null;
  prompt: string | null;
}

export interface InsertRunResult {
  /** The compiled package, or null when compilation failed. */
  pkg: SkillPackage | null;
  /** The generated installation prompt, or null when compilation failed. */
  prompt: string | null;
  /** Set when compilation failed before any integration was attempted. */
  error: string | null;
}

export interface UseInsertFlow {
  state: InsertFlowState;
  run: (state: ManagerState, runtime: Runtime) => Promise<InsertRunResult>;
  reset: () => void;
}

/**
 * In-page cache handle used to read content without round-tripping the worker.
 * Outside a real extension (tests, preview) an empty store is used so the flow
 * degrades to "content not cached" instead of failing.
 */
function defaultPageCache(): RepoCache {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new RepoCache(new ChromeLocalStore());
  }
  return new RepoCache(new MemoryStore());
}

let cacheFactory: () => RepoCache = defaultPageCache;

/** Test/embedding hook: replace the cache used by the insert flow. */
export function setPageCacheFactory(factory: (() => RepoCache) | null): void {
  cacheFactory = factory ?? defaultPageCache;
}

function pageCache(): RepoCache {
  return cacheFactory();
}

export function useInsertFlow(): UseInsertFlow {
  const [state, setState] = useState<InsertFlowState>({
    phase: 'idle',
    progress: null,
    error: null,
    report: null,
    pkg: null,
    prompt: null,
  });

  const reset = useCallback(() => {
    setState({ phase: 'idle', progress: null, error: null, report: null, pkg: null, prompt: null });
  }, []);

  const run = useCallback(async (managerState: ManagerState, runtime: Runtime): Promise<InsertRunResult> => {
    const snapshot = managerState.repo;
    if (!snapshot) {
      const error = 'No repository loaded yet. Refresh the repository first.';
      setState((s) => ({ ...s, error }));
      return { pkg: null, prompt: null, error };
    }
    setState({
      phase: 'compiling',
      progress: { done: 0, total: 0, path: '' },
      error: null,
      report: null,
      pkg: null,
      prompt: null,
    });

    let built;
    try {
      const cache = pageCache();
      built = await buildPackage(snapshot, managerState.selection, {
        cache,
        maxPackageBytes: managerState.settings.maxPackageSizeMb * 1024 * 1024,
        onProgress: (done, total, path) => setState((s) => ({ ...s, progress: { done, total, path } })),
      });
    } catch (error) {
      const message =
        error instanceof PackageBuildError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Compilation failed.';
      setState((s) => ({ ...s, phase: 'idle', error: message, progress: null }));
      return { pkg: null, prompt: null, error: message };
    }

    setState((s) => ({ ...s, phase: 'integrating', pkg: built.pkg, prompt: built.prompt, progress: null }));

    try {
      const report = (await runtime.insertIntoArena()) as IntegrationReport;
      setState((s) => ({ ...s, phase: 'done', report }));
      return { pkg: built.pkg, prompt: built.prompt, error: null };
    } catch (error) {
      const message =
        error instanceof RuntimeError || error instanceof Error ? error.message : String(error);
      setState((s) => ({
        ...s,
        phase: 'done',
        report: {
          outcome: 'failed',
          failedStep: 'content-script',
          steps: [{ step: 'content-script', status: 'failed', message }],
          notes: ['Use Download package and Copy prompt to install manually.'],
        },
      }));
      return { pkg: built.pkg, prompt: built.prompt, error: null };
    }
  }, []);

  return { state, run, reset };
}

/** Regenerate the prompt for a package (fallback + preview UI). */
export function promptFor(pkg: SkillPackage): string {
  return generateInstallPrompt(pkg);
}
