import {Link} from '@/i18n/navigation';

type Crumb = {
  label: string;
  href?: '/' | '/life-coach' | '/morning-priming' | '/settings' | '/admin' | '/help';
};

export function Breadcrumb({crumbs}: {crumbs: Crumb[]}) {
  return (
    <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.label} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="txt-faint" aria-hidden>/</span>
            )}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="focus-ring rounded-md text-[var(--blue)] hover:text-[var(--blue)]/80 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'txt-soft' : 'text-[var(--blue)]'}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
