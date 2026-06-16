'use client';

import {useTranslations} from 'next-intl';

export type DomainDetailTab = 'today' | 'goal' | 'progress' | 'insights';

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
      className="flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02] p-1"
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
                ? 'bg-[var(--blue)]/15 text-white'
                : 'text-white/50 hover:bg-white/[0.04] hover:text-white/75'
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
