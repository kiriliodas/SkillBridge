/**
 * Tri-state checkbox with proper accessibility semantics. The native input is
 * kept (visually hidden) so keyboard, screen readers and form semantics all work.
 */
import { useEffect, useRef } from 'react';
import { IconCheck, IconMinus } from './Icons';

export type CheckState = 'checked' | 'unchecked' | 'indeterminate';

export interface CheckboxProps {
  state: CheckState;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Checkbox({
  state,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'indeterminate';
  }, [state]);

  return (
    <span
      className={['checkbox', `checkbox--${size}`, className].filter(Boolean).join(' ')}
      data-state={state}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        className="checkbox__input"
        checked={state === 'checked'}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox__box" aria-hidden="true">
        {state === 'checked' && <IconCheck size={size === 'sm' ? 11 : 13} />}
        {state === 'indeterminate' && <IconMinus size={size === 'sm' ? 11 : 13} />}
      </span>
    </span>
  );
}
