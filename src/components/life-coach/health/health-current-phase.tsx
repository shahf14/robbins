'use client';

import {useTranslations} from 'next-intl';
import {getCurrentPhaseSummary} from '@/lib/ai-life-coach/resolve-daily-step';
import type {Goal} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';

type Props = {
  goals: Goal[];
};

export function HealthCurrentPhase({goals}: Props) {
  const t = useTranslations();
  const today = dateToYMD(new Date());
  const active = goals.find((g) => g.status === 'active' && g.health_context?.execution_plan);

  if (!active?.health_context) {
    return null;
  }

  const summary = getCurrentPhaseSummary(active.health_context, active.created_at, today);
  if (!summary) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-5" aria-label={t('healthWizard.currentPhaseTitle')}>
      <p className="text-sm font-semibold text-white">{t('healthWizard.currentPhaseTitle')}</p>
      <p className="mt-2 text-xs font-medium text-white/55">
        {t('healthWizard.currentPhaseWeek', {week: summary.weekLabel, day: summary.dayIndex})}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{summary.focus}</p>
    </section>
  );
}
