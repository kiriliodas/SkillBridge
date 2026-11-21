/**
 * Settings: repository configuration, behaviour, interface, cache and
 * connectivity diagnostics. Changes are staged locally and saved explicitly so
 * a half-typed owner name never triggers a failed refresh.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RepoErrorInfo, RepoSnapshot, Settings, ThemePreference } from '../../shared/types';
import { DEFAULT_REPO, DEFAULT_EXCLUDED_PATTERNS } from '../../shared/config';
import { validateRepoConfig } from '../../core/repoTree';
import { describeRepoError } from '../../services/github';
import { formatBytes, formatRelativeTime, pluralize } from '../../shared/format';
import { Button } from '../components/Button';
import { IconCheck, IconRefresh, IconTrash, IconX, IconAlert, IconInfo } from '../components/Icons';

export interface SettingsViewProps {
  settings: Settings;
  repo: RepoSnapshot | null;
  repoError: RepoErrorInfo | null;
  onSave: (patch: Partial<Settings>) => void | Promise<void>;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  runtimeMode: 'extension' | 'preview';
  onClose: () => void;
  surface: 'popup' | 'manager';
}

export function SettingsView({
  settings,
  repo,
  repoError,
  onSave,
  onRefresh,
  refreshing,
  runtimeMode,
  onClose,
  surface,
}: SettingsViewProps) {
  const [draft, setDraft] = useState(settings);
  const [newExclude, setNewExclude] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cacheStats, setCacheStats] = useState<{ cachedSkills: number; cachedBytes: number } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (runtimeMode === 'preview') return;
    void (async () => {
      try {
        const stats = await chrome.runtime.sendMessage({ type: 'GET_STORAGE_STATS' });
        if (stats?.ok) {
          setCacheStats({
            cachedSkills: stats.data.cachedSkills,
            cachedBytes: stats.data.cachedBytes,
          });
        }
      } catch {
        /* stats are optional */
      }
    })();
  }, [runtimeMode, repo]);

  const repoErrors = useMemo(() => validateRepoConfig(draft.repository), [draft.repository]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const connectionStatus = useMemo(() => {
    if (repoError) return { tone: 'danger' as const, label: describeRepoError(repoError) };
    if (!repo) return { tone: 'warning' as const, label: 'Not connected' };
    return {
      tone: 'success' as const,
      label: `Connected · ${repo.skills.length} skills`,
    };
  }, [repo, repoError]);

  const save = async () => {
    if (repoErrors.length > 0) return;
    await onSave(draft);
    setSavedFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      flashTimer.current = null;
      setSavedFlash(false);
    }, 1600);
  };

  // Never leave a timer running against an unmounted component.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = null;
    },
    [],
  );

  const updateRepo = (patch: Partial<Settings['repository']>) => {
    setDraft((current) => ({ ...current, repository: { ...current.repository, ...patch } }));
  };
  const updateBehavior = (patch: Partial<Settings['behavior']>) => {
    setDraft((current) => ({ ...current, behavior: { ...current.behavior, ...patch } }));
  };
  const updateInterface = (patch: Partial<Settings['interface']>) => {
    setDraft((current) => ({ ...current, interface: { ...current.interface, ...patch } }));
  };

  const addExclude = () => {
    const value = newExclude.trim();
    if (!value || draft.repository.excludes.includes(value)) return;
    updateRepo({ excludes: [...draft.repository.excludes, value] });
    setNewExclude('');
  };

  const removeExclude = (pattern: string) => {
    updateRepo({ excludes: draft.repository.excludes.filter((item) => item !== pattern) });
  };

  const clearCache = async () => {
    setClearing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
      setCacheStats({ cachedSkills: 0, cachedBytes: 0 });
    } finally {
      setClearing(false);
    }
  };

  const themes: ThemePreference[] = ['system', 'dark', 'light'];

  return (
    <div className="settings" aria-label="Settings">
      {surface === 'popup' && (
        <div className="settings__head">
          <h1 className="settings__title">Settings</h1>
          <span style={{ marginLeft: 'auto' }} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}

      <section className="settings__section" aria-labelledby="settings-repo">
        <h2 className="settings__section-title" id="settings-repo">
          Repository
        </h2>
        <p className="settings__section-desc">
          Any public GitHub repository whose folders form categories. No changes are ever written to the repository.
        </p>
        <div className="settings__grid">
          <div className="field">
            <label className="field__label" htmlFor="owner">
              Owner
            </label>
            <input
              id="owner"
              className="input"
              value={draft.repository.owner}
              placeholder="LM-Arena"
              spellCheck={false}
              onChange={(event) => updateRepo({ owner: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="repo">
              Repository
            </label>
            <input
              id="repo"
              className="input"
              value={draft.repository.repo}
              placeholder="LM-Arena-Skills"
              spellCheck={false}
              onChange={(event) => updateRepo({ repo: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="branch">
              Branch
            </label>
            <input
              id="branch"
              className="input"
              value={draft.repository.branch}
              placeholder="main"
              spellCheck={false}
              onChange={(event) => updateRepo({ branch: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="root">
              Root directory <span className="muted">(optional)</span>
            </label>
            <input
              id="root"
              className="input"
              value={draft.repository.rootDir}
              placeholder="e.g. skills"
              spellCheck={false}
              onChange={(event) => updateRepo({ rootDir: event.target.value })}
            />
          </div>
          <div className="field field--full">
            <label className="field__label" htmlFor="excludes">
              Excluded files or directories <span className="muted">(optional, glob patterns)</span>
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="excludes"
                className="input"
                value={newExclude}
                placeholder="e.g. **/drafts/** or **/template.md"
                spellCheck={false}
                onChange={(event) => setNewExclude(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addExclude();
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={addExclude} disabled={!newExclude.trim()}>
                Add
              </Button>
            </div>
            {draft.repository.excludes.length > 0 && (
              <div className="chip-input">
                {draft.repository.excludes.map((pattern) => (
                  <span className="chip" key={pattern}>
                    {pattern}
                    <button onClick={() => removeExclude(pattern)} aria-label={`Remove exclusion ${pattern}`}>
                      <IconX size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="field__hint">
              Built-in exclusions: {DEFAULT_EXCLUDED_PATTERNS.slice(0, 3).join(', ')}, … (README, LICENSE, hidden
              folders).
            </p>
          </div>
        </div>

        {repoErrors.length > 0 && (
          <p className="field__error" role="alert" style={{ marginTop: 8 }}>
            {repoErrors.join(' ')}
          </p>
        )}

        <div className="settings__actions">
          <Button variant="secondary" size="sm" onClick={() => updateRepo(DEFAULT_REPO)}>
            Use default repository
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<IconRefresh size={13} />}
            onClick={() => void onRefresh()}
            loading={refreshing}
          >
            Refresh repository
          </Button>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge badge--${connectionStatus.tone}`}>
            {connectionStatus.tone === 'success' ? <IconCheck size={10} /> : <IconAlert size={10} />}
            {connectionStatus.label}
          </span>
          {repo && (
            <span className="muted" style={{ fontSize: 11 }}>
              commit {repo.commit} · fetched {formatRelativeTime(repo.fetchedAt)} ·{' '}
              {pluralize(repo.skills.length, 'skill')}
            </span>
          )}
        </div>
        {repoError && (
          <p className="field__error" role="alert" style={{ marginTop: 6 }}>
            {repoError.hint ?? repoError.message}
          </p>
        )}
      </section>

      <section className="settings__section" aria-labelledby="settings-behavior">
        <h2 className="settings__section-title" id="settings-behavior">
          Behavior
        </h2>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Auto-send installation prompt</p>
            <p className="settings__row-desc">
              Off by default. When enabled, SkillBridge sends the message only after the package attachment and the
              prompt have both been verified.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.behavior.autoSend}
              onChange={(event) => updateBehavior({ autoSend: event.target.checked })}
              aria-label="Auto-send installation prompt"
            />
            <span className="switch__track" aria-hidden="true" />
          </label>
        </div>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Automatically attach compiled package</p>
            <p className="settings__row-desc">
              On by default. Attach the compiled Markdown package to the LM Arena message.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.behavior.autoAttach}
              onChange={(event) => updateBehavior({ autoAttach: event.target.checked })}
              aria-label="Automatically attach compiled package"
            />
            <span className="switch__track" aria-hidden="true" />
          </label>
        </div>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Copy generated prompt</p>
            <p className="settings__row-desc">
              Copy the installation prompt to the clipboard as soon as it is generated.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.behavior.copyPrompt}
              onChange={(event) => updateBehavior({ copyPrompt: event.target.checked })}
              aria-label="Copy generated prompt"
            />
            <span className="switch__track" aria-hidden="true" />
          </label>
        </div>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Remember selected skills between sessions</p>
            <p className="settings__row-desc">
              On by default. Restores your selection when you reopen the extension.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.behavior.rememberSelection}
              onChange={(event) => updateBehavior({ rememberSelection: event.target.checked })}
              aria-label="Remember selected skills between sessions"
            />
            <span className="switch__track" aria-hidden="true" />
          </label>
        </div>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Maximum package size</p>
            <p className="settings__row-desc">
              Compilation stops with a clear error above this size, protecting the LM Arena message limit.
            </p>
          </div>
          <select
            className="select"
            style={{ width: 110 }}
            value={draft.maxPackageSizeMb}
            onChange={(event) => setDraft({ ...draft, maxPackageSizeMb: Number(event.target.value) })}
            aria-label="Maximum package size in megabytes"
          >
            {[2, 4, 8, 16, 32].map((size) => (
              <option key={size} value={size}>
                {size} MB
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-interface">
        <h2 className="settings__section-title" id="settings-interface">
          Interface
        </h2>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Theme</p>
            <p className="settings__row-desc">Dark by default. System follows your OS preference.</p>
          </div>
          <div className="theme-picker" role="group" aria-label="Theme">
            {themes.map((theme) => (
              <button
                key={theme}
                className={draft.interface.theme === theme ? 'is-active' : undefined}
                onClick={() => updateInterface({ theme })}
                aria-pressed={draft.interface.theme === theme}
              >
                {theme[0]!.toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings__row">
          <div className="settings__row-text">
            <p className="settings__row-title">Compact mode</p>
            <p className="settings__row-desc">Tighter rows for browsing very large libraries.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={draft.interface.compact}
              onChange={(event) => updateInterface({ compact: event.target.checked })}
              aria-label="Compact mode"
            />
            <span className="switch__track" aria-hidden="true" />
          </label>
        </div>
      </section>

      {runtimeMode === 'extension' && (
        <section className="settings__section" aria-labelledby="settings-cache">
          <h2 className="settings__section-title" id="settings-cache">
            Cache
          </h2>
          <p className="settings__section-desc">
            Repository metadata is cached for 10 minutes; skill contents for 24 hours. Skill content is downloaded only
            when previewed or compiled.
          </p>
          <div className="stat-line">
            <span>
              Cached skills: <strong>{cacheStats?.cachedSkills ?? '—'}</strong>
            </span>
            <span>
              Cache size: <strong>{cacheStats ? formatBytes(cacheStats.cachedBytes) : '—'}</strong>
            </span>
          </div>
          <div className="settings__actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<IconTrash size={13} />}
              onClick={() => void clearCache()}
              loading={clearing}
            >
              Clear cached data
            </Button>
          </div>
        </section>
      )}

      {runtimeMode === 'preview' && (
        <section className="settings__section">
          <div className="banner banner--info" style={{ margin: 0 }}>
            <IconInfo size={14} />
            <div className="banner__body">
              <span className="banner__title">Preview mode</span>
              <p className="banner__hint">
                This page is running on a local fixture. Settings are not persisted and LM Arena integration is
                disabled. Load the built extension to use the real repository.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="settings__footer">
        <Button variant="primary" size="sm" onClick={() => void save()} disabled={!dirty || repoErrors.length > 0}>
          {savedFlash ? 'Saved' : 'Save changes'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDraft(settings)} disabled={!dirty}>
          Reset
        </Button>
        <span className="settings__status" aria-live="polite">
          {savedFlash && <IconCheck size={13} />}
          {dirty ? 'Unsaved changes' : savedFlash ? 'Settings saved' : 'All changes saved'}
        </span>
      </div>
    </div>
  );
}
