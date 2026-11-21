/**
 * React bindings for the runtime. One hook owns the state, one hook adds
 * actions; both are shared by the popup, the manager page and settings.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManagerState, SelectionState, Settings } from '../../shared/types';
import { getRuntime, RuntimeError, type Runtime } from './runtime';
import { ensureGithubAccess } from './permissions';

export interface AsyncState {
  state: ManagerState | null;
  runtime: Runtime | null;
  loading: boolean;
  error: string | null;
}

export function useRuntime(): Runtime | null {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getRuntime().then((r) => {
      if (!cancelled) setRuntime(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return runtime;
}

export function useManagerState(): AsyncState & { reload: () => Promise<void> } {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [state, setState] = useState<ManagerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getRuntime().then(async (r) => {
      if (cancelled) return;
      setRuntime(r);
      try {
        const initial = await r.getState();
        if (!cancelled) setState(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtime) return;
    const unsubscribe = runtime.onStateChanged(() => {
      void runtime
        .getState()
        .then((next) => {
          if (mounted.current) setState(next);
        })
        .catch(() => undefined);
    });
    return unsubscribe;
  }, [runtime]);

  const reload = useCallback(async () => {
    if (!runtime) return;
    setLoading(true);
    try {
      const next = await runtime.getState();
      if (mounted.current) setState(next);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [runtime]);

  return { state, runtime, loading, error, reload };
}

export interface Actions {
  refresh: () => Promise<void>;
  setSettings: (patch: Partial<Settings>) => Promise<void>;
  setSelection: (selection: SelectionState) => Promise<void>;
  clearSelection: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  busy: boolean;
}

export function useActions(
  runtime: Runtime | null,
  onState: (state: ManagerState) => void,
): Actions {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (fn: (r: Runtime) => Promise<ManagerState>) => {
      if (!runtime) return;
      setBusy(true);
      try {
        const next = await fn(runtime);
        onState(next);
        setError(null);
      } catch (e) {
        setError(e instanceof RuntimeError ? e.message : e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [runtime, onState],
  );

  const refresh = useCallback(async () => {
    if (!runtime) return;
    // Ask for GitHub host access from this user gesture (MV3 optional origins).
    await ensureGithubAccess();
    setBusy(true);
    try {
      setError(null);
      onState(await runtime.refreshRepo(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [runtime, onState]);

  const setSettings = useCallback(
    async (patch: Partial<Settings>) => run((r) => r.setSettings(patch)),
    [run],
  );
  const setSelection = useCallback(
    async (selection: SelectionState) => run((r) => r.setSelection(selection)),
    [run],
  );
  const clearSelection = useCallback(async () => run((r) => r.clearSelection()), [run]);

  return {
    refresh,
    setSettings,
    setSelection,
    clearSelection,
    error,
    clearError: () => setError(null),
    busy,
  };
}

export function useTheme(theme: Settings['interface']['theme']): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (theme === 'system') {
        const light = window.matchMedia('(prefers-color-scheme: light)').matches;
        root.dataset.theme = light ? 'light' : 'dark';
      } else {
        root.dataset.theme = theme;
      }
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
