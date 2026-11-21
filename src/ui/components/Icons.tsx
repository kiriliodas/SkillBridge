/**
 * Minimal inline icon set. Hand-drawn 1.6px-stroke geometry keeps the visual
 * language consistent without pulling in an icon dependency.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...props,
  };
}

export const IconLogo = ({ size = 20, ...props }: IconProps) => (
  <svg {...base({ size, ...props })} strokeWidth={0} fill="currentColor">
    <path
      d="M4 15.5V6.2c0-1.2 1-2.2 2.2-2.2h9.3l4.5 4.5v7c0 1.2-1 2.2-2.2 2.2H6.2C5 17.7 4 16.7 4 15.5Z"
      opacity="0.28"
    />
    <path d="M6 8.4h6.2M6 11.6h8.4M6 14.8h5.2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    <circle cx="18.6" cy="18.4" r="3.1" fill="var(--bg, #0d0f12)" stroke="currentColor" strokeWidth={1.6} />
    <path d="M17.4 18.4l0.9 0.9 1.8-1.9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const IconRefresh = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconSettings = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.14 15.9l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H2.8a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 6.9 4.14l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V2.8a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.56 1.03Z" />
  </svg>
);

export const IconSearch = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m16 16 4 4" />
  </svg>
);

export const IconFolder = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3l2 2.2h8A2 2 0 0 1 20.5 9.7v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
  </svg>
);

export const IconFile = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
    <path d="M13.5 3.5V9H19" />
  </svg>
);

export const IconChevron = ({ className, ...props }: IconProps) => (
  <svg {...base(props)} className={['chevron', className].filter(Boolean).join(' ')}>
    <path d="m9 5 6.5 7L9 19" />
  </svg>
);

export const IconX = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = (props: IconProps) => (
  <svg {...base(props)} strokeWidth={2.2}>
    <path d="m4.5 12.5 4.8 4.8L19.5 7" />
  </svg>
);

export const IconMinus = (props: IconProps) => (
  <svg {...base(props)} strokeWidth={2.4}>
    <path d="M5 12h14" />
  </svg>
);

export const IconDownload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3.5v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 17.5v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
  </svg>
);

export const IconUpload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 16.5V5.5" />
    <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
    <path d="M4.5 17.5v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
  </svg>
);

export const IconCopy = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" />
    <path d="M15.5 6.2V5.2a2 2 0 0 0-2-2H5.2a2 2 0 0 0-2 2v8.3a2 2 0 0 0 2 2h1" />
  </svg>
);

export const IconExternal = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14.5v4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

export const IconSend = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20.5 3.5 3.5 10l6.6 2.6L12.7 19Z" />
    <path d="m10.1 12.6 4.6-4.6" />
  </svg>
);

export const IconAlert = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4 2.8 19.5h18.4Z" />
    <path d="M12 10v4.2" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </svg>
);

export const IconInfo = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.7" fill="currentColor" />
  </svg>
);

export const IconCheckCircle = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.2 12.3 2.6 2.6 5-5.2" />
  </svg>
);

export const IconGrid = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
  </svg>
);

export const IconList = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 6.5h12M8 12h12M8 17.5h12" />
    <circle cx="4" cy="6.5" r="1" fill="currentColor" />
    <circle cx="4" cy="12" r="1" fill="currentColor" />
    <circle cx="4" cy="17.5" r="1" fill="currentColor" />
  </svg>
);

export const IconSparkle = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5 10.1 12.8 4.5 10.9 10.1 9Z" />
  </svg>
);

export const IconTrash = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 6.5v-1a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1" />
    <path d="M6.5 6.5 7.4 19a1.7 1.7 0 0 0 1.7 1.5h5.8a1.7 1.7 0 0 0 1.7-1.5l.9-12.5" />
  </svg>
);

export const IconChevronDown = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m5 9 7 6.5L19 9" />
  </svg>
);

export const IconTerminal = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.2" />
    <path d="m7.5 9.5 3 2.8-3 2.8M13 15.2h4" />
  </svg>
);
