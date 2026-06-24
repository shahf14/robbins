'use client';

import type {ReactNode} from 'react';

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
