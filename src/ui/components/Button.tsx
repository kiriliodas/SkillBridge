import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        block ? 'btn--block' : '',
        loading ? 'is-loading' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : icon}
      {children !== undefined && <span className="btn__label">{children}</span>}
      {iconAfter}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      type="button"
      className={['icon-btn', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
