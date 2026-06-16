'use client';

import type {ButtonHTMLAttributes, ReactNode} from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: ReactNode;
  children: ReactNode;
};

export function BusyButton({
  busy,
  busyLabel,
  children,
  disabled,
  className = '',
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={busy || disabled}
      aria-busy={busy}
      className={`disabled:opacity-50 ${className}`}
    >
      {busy ? (
        <span className="flex items-center justify-center gap-2">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
            aria-hidden
          />
          {busyLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
