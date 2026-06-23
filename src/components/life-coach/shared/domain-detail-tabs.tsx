'use client';

import {useTranslations} from 'next-intl';
import type {DomainDetailTab} from '@/lib/life-coach/domain-detail-url-state';

export type {DomainDetailTab};

const TABS: DomainDetailTab[] = ['today', 'goal', 'progress', 'insights'];

type Props = {
  value: DomainDetailTab;
  onChange: (tab: DomainDetailTab) => void;
  goalSetupNeeded?: boolean;
};

export function DomainDetailTabNav({value, onChange, goalSetupNeeded}: Props) {
  const t = useTranslations('lifeCoach.domainTabs');

  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-2xl border border-[color:var(--color-border)] fill-1 p-1"
      aria-label={t('ariaLabel')}
    >
      {TABS.map((tab) => {
        const selected = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            className={`focus-ring relative shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              selected
                ? 'bg-[var(--blue)]/15 txt-strong'
                : 'txt-muted hover:fill-1 hover:txt-soft'
            }`}
          >
            {t(tab)}
            {goalSetupNeeded && tab === 'goal' && (
              <span
                className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--blue)]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
