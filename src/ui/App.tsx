import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LastPackage, ManagerState, SelectionState, SkillEntry } from '../shared/types';
import { EMPTY_SELECTION, resolveSelectedSkills, setGroupSelected } from '../core/selection';
import { filterTreeForSearch, searchSkills } from '../core/search';
import { useActions, useManagerState, useTheme } from './lib/useSkillBridge';
import { useInsertFlow } from './lib/useInsertFlow';
import { copyText, downloadTextFile } from './lib/files';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { CategoryTree } from './components/CategoryTree';
import { SelectionSummary } from './components/SelectionSummary';
import { SkillPreview } from './components/SkillPreview';
import { InsertResult } from './components/InsertResult';
import { LastPackageBanner } from './components/LastPackageBanner';
import { SettingsView } from './views/SettingsView';
import { Button, IconButton } from './components/Button';
import {
  IconAlert,
  IconCheckCircle,
  IconExternal,
  IconGrid,
  IconInfo,
  IconRefresh,
  IconSparkle,
  IconX,
} from './components/Icons';
import { useToast } from './components/Toast';
import { ensureGithubAccess } from './lib/permissions';
import { formatNumber } from '../shared/format';

export interface AppProps {
  surface: 'popup' | 'manager';
}

type Tab = 'library' | 'settings';

export function App({ surface }: AppProps) {
  const { state, runtime, loading, error } = useManagerState();
  const [localState, setLocalState] = useState<ManagerState | null>(null);
  const effective = localState ?? state;
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastPackage, setLastPackage] = useState<LastPackage | null>(null);
  const [lastPackageDismissed, setLastPackageDismissed] = useState(false);
  const [lastCopied, setLastCopied] = useState(false);
  const toast = useToast();
  const insert = useInsertFlow();
  const appliedTheme = effective?.settings.interface.theme ?? 'dark';
  useTheme(appliedTheme);

  useEffect(() => {
    if (state) setLocalState(state);
  }, [state]);

  // Surface the last compiled package so it is never lost after a failure.
  useEffect(() => {
    if (!runtime?.getLastPackage) return;
    let cancelled = false;
    void runtime
      .getLastPackage()
      .then((pkg) => {
        if (!cancelled) setLastPackage(pkg);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runtime, insert.state.phase]);

  const onState = useCallback((next: ManagerState) => setLocalState(next), []);
  const actions = useActions(runtime, onState);

  const repo = effective?.repo ?? null;
  const settings = effective?.settings;
  const selection = effective?.selection ?? EMPTY_SELECTION;
  const allSkillIds = useMemo(() => repo?.skills.map((s) => s.id) ?? [], [repo]);

  const search = useMemo(() => (repo && query.trim() ? searchSkills(repo.skills, query) : null), [repo, query]);
  const filtered = useMemo(
    () => (repo && query.trim() ? filterTreeForSearch(repo.tree, query) : null),
    [repo, query],
  );

  const selectedSkills = useMemo(
    () => (repo ? resolveSelectedSkills(repo, selection) : []),
    [repo, selection],
  );

  const previewSkill = useMemo(
    () => repo?.skills.find((s) => s.id === previewId) ?? null,
    [repo, previewId],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Requesting host access first keeps the gesture association intact.
      await ensureGithubAccess();
      await actions.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [actions]);

  const handleSelection = useCallback(
    (next: SelectionState) => {
      setLocalState((current) => (current ? { ...current, selection: next } : current));
      void actions.setSelection(next);
    },
    [actions],
  );

  const handleClear = useCallback(() => {
    setLocalState((current) => (current ? { ...current, selection: { ids: [], allSelected: false } } : current));
    void actions.clearSelection();
    toast.push('info', 'Selection cleared');
  }, [actions, toast]);

  const handleInsert = useCallback(async () => {
    if (!effective) return;
    const copyWhenDone = effective.settings.behavior.copyPrompt;
    const result = await insert.run(effective, runtime ?? ({} as never));
    // "Copy generated prompt" means the prompt is on the clipboard the moment
    // the package exists, so the fallback needs no extra click.
    if (copyWhenDone && result.prompt) {
      const ok = await copyText(result.prompt);
      if (ok) toast.push('success', 'Installation prompt copied');
    }
  }, [effective, insert, runtime, toast]);

  const loadContent = useCallback(
    async (id: string) => {
      if (!runtime) throw new Error('Extension runtime not ready.');
      const result = await runtime.getSkillContent(id);
      return result.content;
    },
    [runtime],
  );

  const handleCopy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      toast.push(ok ? 'success' : 'error', ok ? 'Copied to clipboard' : 'Could not copy to clipboard');
      return ok;
    },
    [toast],
  );

  const downloadPackage = useCallback(() => {
    if (!insert.state.pkg) return;
    downloadTextFile(insert.state.pkg.fileName, insert.state.pkg.markdown);
    toast.push('success', 'Package downloaded', insert.state.pkg.fileName);
  }, [insert.state.pkg, toast]);

  const copyPrompt = useCallback(async () => {
    if (!insert.state.prompt) return;
    const ok = await copyText(insert.state.prompt);
    toast.push(ok ? 'success' : 'error', ok ? 'Installation prompt copied' : 'Could not copy the prompt');
  }, [insert.state.prompt, toast]);

  // Keyboard shortcuts: "/" focuses search, Escape closes the preview/dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search__input')?.focus();
      }
      if (event.key === 'Escape') {
        if (insert.state.phase === 'done') insert.reset();
        else if (previewId) setPreviewId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [insert, previewId]);

  const showPreview = Boolean(previewSkill);

  const notConfigured =
    effective && !effective.settings.repository.owner && !effective.settings.repository.repo;

  const statusBanner = (() => {
    if (!effective) return null;
    if (effective.status === 'error' && effective.error) {
      return (
        <div className="banner banner--error" role="alert">
          <IconAlert size={15} />
          <div className="banner__body">
            <span className="banner__title">{effective.error.message}</span>
            {effective.error.hint && <p className="banner__hint">{effective.error.hint}</p>}
            <div className="banner__actions">
              <Button size="sm" variant="secondary" onClick={handleRefresh} icon={<IconRefresh size={13} />}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTab('settings')}>
                Open settings
              </Button>
            </div>
          </div>
        </div>
      );
    }
    if (effective.status === 'ready' && repo && repo.skills.length === 0) {
      return (
        <div className="banner banner--warning" role="status">
          <IconInfo size={15} />
          <div className="banner__body">
            <span className="banner__title">No Markdown skills found</span>
            <p className="banner__hint">
              Add <code>.md</code> files under the configured root ({settings?.repository.rootDir || 'repository root'})
              and refresh.
            </p>
            {repo.warnings.length > 0 && <p className="banner__hint">{repo.warnings[0]}</p>}
          </div>
        </div>
      );
    }
    if (effective.repo && effective.repo.warnings.length > 0) {
      return (
        <div className="banner banner--warning" role="status">
          <IconInfo size={15} />
          <div className="banner__body">
            {effective.repo.warnings.map((warning) => (
              <p key={warning} className="banner__hint" style={{ margin: 0 }}>
                {warning}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  })();

  const tree = repo?.tree;
  const visibleSkillIds = filtered && query.trim() ? filtered.matchedSkillIds : undefined;

  return (
    <div
      className={[
        'app',
        `app--${surface}`,
        effective?.settings.interface.compact ? 'app--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Header
        repo={repo}
        settings={settings ?? null}
        refreshing={refreshing || effective?.status === 'loading' || false}
        previewMode={runtime?.mode === 'preview'}
        onRefresh={() => void handleRefresh()}
        onOpenSettings={() => setTab(tab === 'settings' ? 'library' : 'settings')}
        {...(surface === 'popup'
          ? {
              onExpand: () => {
                void runtime?.openManager();
              },
            }
          : {})}
      />

      {surface === 'manager' && (
        <nav className="manager__nav" aria-label="Sections">
          <button
            className={`nav-tab ${tab === 'library' ? 'is-active' : ''}`}
            onClick={() => setTab('library')}
            aria-current={tab === 'library' ? 'page' : undefined}
          >
            <IconGrid size={14} /> Library
          </button>
          <button
            className={`nav-tab ${tab === 'settings' ? 'is-active' : ''}`}
            onClick={() => setTab('settings')}
            aria-current={tab === 'settings' ? 'page' : undefined}
          >
            <IconSparkle size={14} /> Settings
          </button>
          {insert.state.pkg && (
            <button
              className="nav-tab"
              onClick={() => insert.state.phase === 'done' && !insert.state.report && void handleInsert()}
              style={{ marginLeft: 'auto' }}
            >
              <IconCheckCircle size={14} /> {insert.state.pkg.packageId}
            </button>
          )}
        </nav>
      )}

      {tab === 'settings' && settings && effective ? (
        <SettingsView
          settings={settings}
          repo={repo}
          repoError={effective.error}
          onSave={(patch) => actions.setSettings(patch)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          runtimeMode={runtime?.mode ?? 'preview'}
          onClose={() => setTab('library')}
          surface={surface}
        />
      ) : (
        <div className={showPreview ? 'layout layout--previewing' : 'layout'}>
          <div className="layout__main">
            {surface === 'manager' ? (
              <div className="toolbar">
                <div style={{ flex: 1, maxWidth: 520 }}>
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    resultCount={search?.matches.length ?? 0}
                    totalCount={repo?.skills.length ?? 0}
                  />
                </div>
                <div className="toolbar__spacer" />
                {repo && (
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {formatNumber(repo.skills.length)} skills
                  </span>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    repo && handleSelection(setGroupSelected(selection, allSkillIds, true, allSkillIds))
                  }
                  disabled={!repo || repo.skills.length === 0}
                >
                  Select all
                </Button>
                <IconButton
                  label="Open full library manager"
                  onClick={() => void runtime?.openManager()}
                >
                  <IconExternal size={15} />
                </IconButton>
              </div>
            ) : (
              <div className="toolbar">
                <div style={{ flex: 1 }}>
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    resultCount={search?.matches.length ?? 0}
                    totalCount={repo?.skills.length ?? 0}
                  />
                </div>
              </div>
            )}

            {lastPackage && !lastPackageDismissed && insert.state.phase === 'idle' && (
              <LastPackageBanner
                pkg={lastPackage}
                copied={lastCopied}
                onDownload={() => {
                  downloadTextFile(lastPackage.fileName, lastPackage.markdown);
                  toast.push('success', 'Package downloaded', lastPackage.fileName);
                }}
                onCopy={() => {
                  void copyText(lastPackage.prompt).then((ok) => {
                    setLastCopied(ok);
                    if (ok) setTimeout(() => setLastCopied(false), 1800);
                    toast.push(ok ? 'success' : 'error', ok ? 'Prompt copied' : 'Could not copy the prompt');
                  });
                }}
                onDismiss={() => setLastPackageDismissed(true)}
              />
            )}

            {statusBanner}

            <div className="layout__body">
              <div className="layout__tree">
                {loading && !effective && (
                  <div className="loading-state">
                    <span className="spinner" aria-hidden="true" />
                    <span>Connecting to GitHub…</span>
                  </div>
                )}
                {effective?.status === 'loading' && !repo && (
                  <>
                    <div className="skeleton" style={{ width: '70%' }} />
                    <div className="skeleton" style={{ width: '84%' }} />
                    <div className="skeleton" style={{ width: '62%' }} />
                    <div className="skeleton" style={{ width: '76%' }} />
                  </>
                )}
                {notConfigured && (
                  <div className="empty">
                    <span className="empty__icon">
                      <IconSparkle size={22} />
                    </span>
                    <h3 className="empty__title">Connect a Skill repository</h3>
                    <p className="empty__body">
                      Point SkillBridge at any public GitHub repository containing Markdown skills. Categories are
                      derived from folders — no configuration inside the repository is needed.
                    </p>
                    <div className="empty__actions">
                      <Button variant="primary" size="sm" onClick={() => setTab('settings')}>
                        Set up repository
                      </Button>
                    </div>
                  </div>
                )}
                {tree && repo && repo.skills.length > 0 && visibleSkillIds && visibleSkillIds.size === 0 && !search?.categoryMatched && (
                  <div className="empty">
                    <span className="empty__icon">
                      <IconInfo size={20} />
                    </span>
                    <h3 className="empty__title">No matches for “{query}”</h3>
                    <p className="empty__body">
                      Search looks at skill names, file names, categories and paths. Try a shorter query.
                    </p>
                    <div className="empty__actions">
                      <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                        Clear search
                      </Button>
                    </div>
                  </div>
                )}
                {tree && repo && (!visibleSkillIds || visibleSkillIds.size > 0 || search?.categoryMatched) && (
                  <CategoryTree
                    tree={tree}
                    selection={selection}
                    allSkillIds={allSkillIds}
                    onSelectionChange={handleSelection}
                    onPreview={(skill) => setPreviewId(skill.id)}
                    {...(filtered ? { forceOpenIds: filtered.keepNodeIds, visibleSkillIds: filtered.matchedSkillIds } : {})}
                    compact={effective?.settings.interface.compact ?? false}
                  />
                )}
              </div>

              {showPreview && previewSkill && (
                <div className="layout__preview">
                  <SkillPreview
                    skill={previewSkill}
                    selection={selection}
                    onToggleSelected={(skill: SkillEntry, selected: boolean) => {
                      const ids = [skill.id];
                      handleSelection(
                        setGroupSelected(selection, ids, selected, allSkillIds),
                      );
                    }}
                    onClose={() => setPreviewId(null)}
                    loadContent={loadContent}
                    copy={copyText}
                    onCopied={(ok) =>
                      toast.push(ok ? 'success' : 'error', ok ? 'Skill Markdown copied' : 'Copy failed')
                    }
                  />
                </div>
              )}
            </div>

            {runtime?.mode === 'preview' && (
              <p className="manager__banner">
                <IconInfo size={13} />
                Preview mode — the UI runs on a local fixture. Install the extension to use GitHub and LM Arena.
              </p>
            )}

            <SelectionSummary
              selectedSkills={selectedSkills}
              maxPackageBytes={(settings?.maxPackageSizeMb ?? 8) * 1024 * 1024}
              onClear={handleClear}
              onInsert={() => void handleInsert()}
              inserting={insert.state.phase === 'compiling' || insert.state.phase === 'integrating'}
              disabledReason={!repo ? 'Load a repository first' : undefined}
            />

            {insert.state.error && (
              <div className="banner banner--error" role="alert" style={{ marginBottom: 10 }}>
                <IconAlert size={15} />
                <div className="banner__body">
                  <span className="banner__title">Compilation failed</span>
                  <p className="banner__hint">{insert.state.error}</p>
                  <div className="banner__actions">
                    <Button size="sm" variant="ghost" onClick={insert.reset}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {insert.state.phase !== 'idle' && !insert.state.report && (
              <div className="banner banner--info" role="status">
                <span className="spinner spinner--sm" aria-hidden="true" />
                <div className="banner__body">
                  {insert.state.phase === 'compiling' ? (
                    <>
                      <span className="banner__title">Compiling package…</span>
                      {insert.state.progress && insert.state.progress.total > 0 && (
                        <p className="banner__hint">
                          {insert.state.progress.done} / {insert.state.progress.total} —{' '}
                          {insert.state.progress.path.split('/').pop()}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="banner__title">Inserting into LM Arena…</span>
                      <p className="banner__hint">
                        {insert.state.pkg?.fileName} ({formatNumber(insert.state.pkg?.totals.skills ?? 0)} skills)
                      </p>
                    </>
                  )}
                </div>
                <IconButton label="Cancel" onClick={insert.reset}>
                  <IconX size={14} />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      )}

      {insert.state.phase === 'done' && insert.state.report && insert.state.pkg && (
        <div className="dialog-backdrop" onClick={(event) => event.target === event.currentTarget && insert.reset()}>
          <InsertResult
            report={insert.state.report}
            pkg={insert.state.pkg}
            prompt={insert.state.prompt ?? ''}
            onClose={insert.reset}
            onDownload={downloadPackage}
            onCopyPrompt={() => void copyPrompt()}
            copied={false}
          />
        </div>
      )}

      {actions.error && (
        <div className="banner banner--error" role="alert" style={{ position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 70 }}>
          <IconAlert size={15} />
          <div className="banner__body">
            <span className="banner__title">{actions.error}</span>
          </div>
          <IconButton label="Dismiss" onClick={actions.clearError}>
            <IconX size={14} />
          </IconButton>
        </div>
      )}

      {/* Visible in dev only: keeps the unused import honest for linting. */}
      <span className="sr-status" aria-live="polite">
        {selectedSkills.length === 0 ? '' : `${selectedSkills.length} skills selected`}
        {error ? `Error: ${error}` : ''}
      </span>

    </div>
  );
}

