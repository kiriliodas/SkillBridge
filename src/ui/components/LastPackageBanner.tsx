/**
 * Recovery affordance for the last compiled package.
 *
 * Requirement: a compiled package is never discarded after a failed or
 * interrupted integration. This banner re-surfaces the stored package so the
 * user can download it or copy the prompt again, even after closing the dialog.
 */
import type { LastPackage } from '../../shared/types';
import { formatBytes, formatRelativeTime } from '../../shared/format';
import { Button, IconButton } from './Button';
import { IconDownload, IconCopy, IconX, IconCheck } from './Icons';

export interface LastPackageBannerProps {
  pkg: LastPackage;
  copied: boolean;
  onDownload: () => void;
  onCopy: () => void;
  onDismiss: () => void;
}

export function LastPackageBanner({ pkg, copied, onDownload, onCopy, onDismiss }: LastPackageBannerProps) {
  const bytes = new TextEncoder().encode(pkg.markdown).length;
  return (
    <div className="banner banner--info" role="status">
      <IconDownload size={15} />
      <div className="banner__body">
        <span className="banner__title">Last compiled package is still available</span>
        <p className="banner__hint">
          <code>{pkg.fileName}</code> · {formatBytes(bytes)} · compiled {formatRelativeTime(pkg.createdAt)}. Nothing is
          discarded when the integration fails.
        </p>
        <div className="banner__actions">
          <Button size="sm" variant="secondary" icon={<IconDownload size={13} />} onClick={onDownload}>
            Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            onClick={onCopy}
          >
            {copied ? 'Copied' : 'Copy prompt'}
          </Button>
        </div>
      </div>
      <IconButton label="Hide last package" onClick={onDismiss}>
        <IconX size={13} />
      </IconButton>
    </div>
  );
}
