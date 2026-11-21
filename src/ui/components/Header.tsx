import type { RepoSnapshot, Settings } from '../../shared/types';
import { IconExternal, IconLogo, IconRefresh, IconSettings } from './Icons';
import { IconButton } from './Button';
import { formatRelativeTime } from '../../shared/format';

export interface HeaderProps {
  repo: RepoSnapshot | null;
  /** Null until the background state has loaded. */
  settings: Settings | null;
  refreshing: boolean;
  previewMode: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onExpand?: () => void;
}

export function Header({
  repo,
  settings,
  refreshing,
  previewMode,
  onRefresh,
  onOpenSettings,
  onExpand,
}: HeaderProps) {
  const repoLabel = settings?.repository.owner
    ? `${settings.repository.owner}/${settings.repository.repo}`
    : 'Loading repository…';
  const branch = settings?.repository.branch ?? '—';

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">
          <IconLogo size={19} />
        </span>
        <span className="header__title">SkillBridge</span>
        {previewMode && (
          <span className="badge badge--outline" title="Running outside the extension: data is a local fixture">
            Preview
          </span>
        )}
      </div>

      <div className="header__meta">
        <span className="header__repo" title={repoLabel}>
          {repoLabel}
        </span>
        <span className="header__branch" title={`Branch ${branch}`}>
          {branch}
        </span>
        {repo && (
          <span className="header__updated" title={`Tree fetched ${new Date(repo.fetchedAt).toLocaleString()}`}>
            {formatRelativeTime(repo.fetchedAt)}
          </span>
        )}
      </div>

      <div className="header__actions">
        {onExpand && (
          <IconButton label="Open full library manager" onClick={onExpand}>
            <IconExternal size={15} />
          </IconButton>
        )}
        <IconButton
          label={refreshing ? 'Refreshing repository…' : 'Refresh repository'}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <IconRefresh size={15} className={refreshing ? 'spin' : undefined} />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <IconSettings size={15} />
        </IconButton>
      </div>
    </header>
  );
}
