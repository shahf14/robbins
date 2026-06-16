'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {DailyBabyStep, Goal} from '@/lib/life-coach/types';
import {
  commitmentProgress,
  isWithinCommitment,
  resolveCommitmentDays,
} from '@/lib/behavior-science/goal-commitment';
import {formatYmdLocale} from '@/lib/date-utils';

type Props = {
  goals: Goal[];
  todaySteps?: DailyBabyStep[];
  domain?: Goal['domain'];
};

export function CommitmentTodayPanel({goals, todaySteps = [], domain}: Props) {
  const t = useTranslations('behaviorScience.commitmentToday');
  const locale = useLocale();

  const activeCommitments = useMemo(() => {
    return goals
      .filter((goal) => goal.status === 'active')
      .filter((goal) => !domain || goal.domain === domain)
      .filter((goal) => isWithinCommitment(goal))
      .map((goal) => {
        const progress = commitmentProgress(goal);
        const hasStepToday = todaySteps.some(
          (step) => step.goal_id === goal.id && step.status === 'pending'
        );
        return {goal, progress, hasStepToday};
      });
  }, [goals, todaySteps, domain]);

  if (activeCommitments.length === 0) return null;

  return (
    <div className="grid gap-3">
      {activeCommitments.map(({goal, progress, hasStepToday}) => (
        <div
          key={goal.id}
          className="rounded-xl border border-violet-400/25 bg-violet-500/8 px-4 py-3.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">
            {t('eyebrow')}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-6 text-white/90">
            {t('dayProgress', {current: progress.currentDay, total: progress.days})}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {t('dateRange', {
              start: formatYmdLocale(progress.start, locale),
              end: formatYmdLocale(progress.end, locale),
            })}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {t('servesGoal', {goal: goal.title})}
          </p>
          {!hasStepToday && (
            <p className="mt-2 text-xs font-semibold text-amber-300/90">
              {t('noPendingStep')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function commitmentBadgeForStep(
  goal: Goal | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
): string | null {
  if (!goal || goal.status !== 'active' || !isWithinCommitment(goal)) return null;
  const progress = commitmentProgress(goal);
  return t('stepBadge', {current: progress.currentDay, total: resolveCommitmentDays(goal)});
}
