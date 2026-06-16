'use client';

import {useTranslations} from 'next-intl';
import type {DailyStepStatus} from '@/lib/life-coach/types';

export type StepStatusFilter = 'all' | DailyStepStatus;

type Props = {
  value: StepStatusFilter;
  onChange: (value: StepStatusFilter) => void;
  counts: Partial<Record<DailyStepStatus, number>>;
};

const FILTERS: StepStatusFilter[] = ['all', 'pending', 'completed', 'skipped'];

export function StepFilterChips({value, onChange, counts}: Props) {
  const t = useTranslations('lifeCoach.stepFilters');

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('label')}>
      {FILTERS.map((filter) => {
        const count =
          filter === 'all'
            ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
            : counts[filter] ?? 0;
        const active = value === filter;
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={active}
            className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] text-white'
                : 'border-white/10 text-white/55 hover:border-white/20 hover:text-white/80'
            }`}
            onClick={() => onChange(filter)}
          >
            {t(filter)}
            {count > 0 && <span className="ms-1.5 tabular-nums text-white/40">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
