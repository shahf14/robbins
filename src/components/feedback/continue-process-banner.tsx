'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {listOpenProcessDrafts, type OpenProcessDraft} from '@/lib/open-process-drafts';
import {ONBOARDING_STATUS_CHANGED_EVENT} from '@/lib/onboarding-state';

function filterDrafts(includeOnboarding: boolean): OpenProcessDraft[] {
  return listOpenProcessDrafts().filter(
    (draft) => includeOnboarding || draft.kind !== 'onboarding'
  );
}

/** Surfaces in-progress onboarding / goal / clarification drafts at the top of key pages. */
export function ContinueProcessBanner({
  includeOnboarding = false,
}: {
  includeOnboarding?: boolean;
}) {
  const t = useTranslations('continueProcess');
  const [drafts, setDrafts] = useState<OpenProcessDraft[]>(() =>
    filterDrafts(includeOnboarding)
  );

  useEffect(() => {
    function sync() {
      setDrafts(filterDrafts(includeOnboarding));
    }
    sync();
    window.addEventListener(ONBOARDING_STATUS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ONBOARDING_STATUS_CHANGED_EVENT, sync);
  }, [includeOnboarding]);

  if (drafts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {drafts.map((draft) => (
        <Link
          key={draft.kind}
          href={draft.href}
          className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-[var(--blue)]/25 bg-[var(--blue)]/8 px-4 py-3 transition hover:border-[var(--blue)]/40 hover:bg-[var(--blue)]/12"
        >
          <div className="min-w-0">
            <p className="text-sm font-black txt-strong">{t(`${draft.kind}.title`)}</p>
            <p className="mt-0.5 text-xs leading-5 txt-soft">{t(`${draft.kind}.body`)}</p>
          </div>
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--blue)]">
            {t('cta')}
          </span>
        </Link>
      ))}
    </div>
  );
}
