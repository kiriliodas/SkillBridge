import type { SkillEntry } from '../../shared/types';
import { summarizeSelection } from '../../core/selection';
import { formatBytes, formatNumber } from '../../shared/format';
import { IconTrash } from './Icons';
import { Button } from './Button';

export interface SelectionSummaryProps {
  selectedSkills: SkillEntry[];
  maxPackageBytes?: number;
  onClear: () => void;
  onInsert: () => void;
  inserting: boolean;
  disabledReason?: string;
}

export function SelectionSummary({
  selectedSkills,
  maxPackageBytes,
  onClear,
  onInsert,
  inserting,
  disabledReason,
}: SelectionSummaryProps) {
  const summary = summarizeSelection(selectedSkills);
  const tooLarge = maxPackageBytes !== undefined && summary.estimatedBytes > maxPackageBytes;
  const empty = summary.count === 0;

  return (
    <div className="summary" aria-label="Selection summary">
      <div className="summary__stats">
        <div className="stat">
          <span className="stat__value">{formatNumber(summary.count)}</span>
          <span className="stat__label">{summary.count === 1 ? 'skill' : 'skills'}</span>
        </div>
        <span className="stat__divider" aria-hidden="true" />
        <div className="stat">
          <span className="stat__value">{formatNumber(summary.categories)}</span>
          <span className="stat__label">{summary.categories === 1 ? 'category' : 'categories'}</span>
        </div>
        <span className="stat__divider" aria-hidden="true" />
        <div className="stat">
          <span className="stat__value">{formatBytes(summary.estimatedBytes)}</span>
          <span className="stat__label">estimated</span>
        </div>
        <span className="stat__divider" aria-hidden="true" />
        <div className="stat">
          <span className="stat__value">~{formatNumber(summary.estimatedLines)}</span>
          <span className="stat__label">lines</span>
        </div>
      </div>

      {tooLarge && (
        <p className="summary__warning" role="status">
          This package is larger than the {formatBytes(maxPackageBytes ?? 0)} limit. Deselect some skills or raise the
          limit in Settings.
        </p>
      )}

      <div className="summary__actions">
        <Button
          variant="ghost"
          size="sm"
          icon={<IconTrash size={14} />}
          onClick={onClear}
          disabled={empty}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onInsert}
          loading={inserting}
          disabled={empty || Boolean(disabledReason)}
          title={disabledReason ?? undefined}
        >
          Insert Skills into LM Arena
        </Button>
      </div>
    </div>
  );
}
