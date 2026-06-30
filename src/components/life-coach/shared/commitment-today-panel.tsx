'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {DailyBabyStepResponse, GoalResponse} from '@/lib/life-coach/response-dtos';
import {
  commitmentProgress,
  isWithinCommitment,
  resolveCommitmentDays,
} from '@/lib/behavior-science/goal-commitment';
import {formatYmdLocale} from '@/lib/date-utils';

type Props = {
  goals: GoalResponse[];
  todaySteps?: DailyBabyStepResponse[];
  domain?: GoalResponse['domain'];
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
          <p className="mt-1.5 text-sm font-semibold leading-6 txt-strong">
            {t('dayProgress', {current: progress.currentDay, total: progress.days})}
          </p>
          <p className="mt-1 text-xs txt-muted">
            {t('dateRange', {
              start: formatYmdLocale(progress.start, locale),
              end: formatYmdLocale(progress.end, locale),
            })}
          </p>
          <p className="mt-2 text-sm leading-6 txt-soft">
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
  goal: GoalResponse | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
): string | null {
  if (!goal || goal.status !== 'active' || !isWithinCommitment(goal)) return null;
  const progress = commitmentProgress(goal);
  return t('stepBadge', {current: progress.currentDay, total: resolveCommitmentDays(goal)});
}
