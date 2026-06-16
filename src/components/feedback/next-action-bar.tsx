'use client';

import {Link} from '@/i18n/navigation';

type Props = {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/** Clear “what to do next” at the bottom of a flow. */
export function NextActionBar({label, href, onClick, className = ''}: Props) {
  const inner = (
    <span className="text-sm font-bold text-[var(--blue)]">{label} <span aria-hidden="true">→</span></span>
  );

  return (
    <div
      className={`rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 px-4 py-3 ${className}`}
    >
      {href ? (
        <Link href={href} className="focus-ring block">
          {inner}
        </Link>
      ) : (
        <button type="button" className="focus-ring w-full text-start" onClick={onClick}>
          {inner}
        </button>
      )}
    </div>
  );
}
