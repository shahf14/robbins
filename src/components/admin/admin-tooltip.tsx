'use client';

import type {ReactNode} from 'react';

export function AdminTooltip({tip, className = ''}: {tip: string; className?: string}) {
  return (
    <span className={`admin-tip ${className}`}>
      <button type="button" className="admin-tip__trigger focus-ring" aria-label={tip} tabIndex={0}>
        <span aria-hidden>?</span>
      </button>
      <span className="admin-tip__bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

export function AdminTipLabel({label, tip}: {label: ReactNode; tip: string}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <AdminTooltip tip={tip} />
    </span>
  );
}

export function AdminHoverTip({
  tip,
  children,
  className = '',
}: {
  tip: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`admin-hover-tip ${className}`} tabIndex={0} title={tip}>
      {children}
      <span className="admin-tip__bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
