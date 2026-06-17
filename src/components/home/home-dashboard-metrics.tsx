'use client';

import {Link} from '@/i18n/navigation';
import type {useTranslations} from 'next-intl';
import type {DailyBabyStep, LifeDomain, LifeDomainState} from '@/lib/life-coach/types';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import type {WeekBehaviorChangeAnalysis} from '@/lib/formulation/behavior-change-tracking';
import type {BehaviorScore} from '@/lib/behavior-science/behavior-score';
import type {GoalWithMilestones, HomeDashboardData} from '@/lib/home/dashboard-derived';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';
import {WEEKLY_TARGET_RATIO} from '@/lib/life-coach/progress-constants';
import {completedRitualSessions} from '@/lib/home/ritual-derived';

export function HomeGoalProgress({
  goal, steps, t,
}: {
  goal: GoalWithMilestones | null;
  steps: DailyBabyStep[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (!goal) return null;

  const goalSteps = steps.filter((step) => step.goal_id === goal.id);
  const completed = goalSteps.filter((step) => step.status === 'completed').length;
  const total = goalSteps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const startDate = new Date(goal.created_at);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
  const daysTotal = 90;
  const daysLeft = Math.max(0, daysTotal - daysPassed);

  const progressColor =
    pct >= 75 ? '#10b981'
    : pct >= 40 ? '#3b82f6'
    : '#f59e0b';

  return (
    <Link
      href={`/life-coach/${goal.domain}`}
      className="focus-ring group block rounded-[20px] border border-[color:var(--color-border)] fill-1 px-6 py-5 transition hover:border-[color:var(--color-border-strong)] hover:fill-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest txt-muted">
            {t('home.goalProgressLabel')} · {DOMAIN_ICONS[goal.domain as LifeDomain]}{' '}
            {t(`lifeCoach.domains.${goal.domain}.short`)}
          </p>
          <p className="mt-2 text-base font-black leading-snug txt-strong line-clamp-2">
            {goal.title}
          </p>
          {goal.success_metric?.trim() && (
            <p className="mt-2 text-xs leading-5 text-[var(--blue)]/85 line-clamp-2">
              <span className="font-bold uppercase tracking-wide text-[var(--blue)]/60">
                {t('lifeCoach.whyItMatters')}:{' '}
              </span>
              {goal.success_metric}
            </p>
          )}
        </div>
        <span
          className="shrink-0 text-2xl font-black tabular-nums"
          style={{color: progressColor}}
        >
          {pct}%
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full fill-3">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{width: `${pct}%`, backgroundColor: progressColor}}
        />
      </div>

      {(goal.milestones?.length ?? 0) > 0 && (
        <div className="relative mt-1 flex justify-between">
          {(goal.milestones ?? []).slice(0, 3).map((milestone) => {
            const markerPct = milestone.day_marker ? Math.round((milestone.day_marker / daysTotal) * 100) : null;
            if (!markerPct) return null;
            return (
              <div
                key={milestone.id}
                className="absolute -top-0.5 flex flex-col items-center"
                style={{left: `${markerPct}%`, transform: 'translateX(-50%)'}}
              >
                <div className={`h-3 w-0.5 ${milestone.status === 'completed' ? 'bg-emerald-400' : 'fill-3'}`} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs txt-muted">
        {completed > 0 && (
          <span>{t('home.goalDoneSteps', {done: completed, total})}</span>
        )}
        {daysLeft > 0 && (
          <span>{t('home.goalDaysLeft', {days: daysLeft})}</span>
        )}
        <span className="ms-auto txt-faint transition group-hover:txt-muted">→</span>
      </div>
    </Link>
  );
}

export function HomeKpiStrip({
  streak, weeklyDone, weeklyTotal, energyTrend: trend, ritualSessions, behaviorChangeAnalysis, behaviorScore, t,
}: {
  streak: number;
  weeklyDone: number;
  weeklyTotal: number;
  energyTrend: 'up' | 'down' | 'flat';
  ritualSessions: MorningRitualSession[];
  behaviorChangeAnalysis: WeekBehaviorChangeAnalysis | null;
  behaviorScore: BehaviorScore;
  t: ReturnType<typeof useTranslations>;
}) {
  const completionRate = weeklyTotal > 0 ? Math.round((weeklyDone / weeklyTotal) * 100) : 0;
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'txt-muted';
  const aligned = behaviorChangeAnalysis?.goal_aligned_count ?? 0;
  const showUps = behaviorChangeAnalysis?.show_up_count ?? weeklyDone;

  const kpis = [
    {
      label: t('home.kpiStreak'),
      value: streak > 0 ? `${streak}d` : '—',
      color: streak >= 7 ? 'text-emerald-400' : streak > 0 ? 'text-[var(--blue)]' : 'txt-muted',
    },
    {
      label: t('home.kpiDoneWeek'),
      value: weeklyTotal > 0 ? `${weeklyDone}/${weeklyTotal}` : '—',
      color: 'txt-strong',
    },
    {
      label: behaviorChangeAnalysis ? t('home.kpiGoalAligned') : t('home.kpiCompletionRate'),
      value: behaviorChangeAnalysis
        ? showUps > 0
          ? `${aligned}/${showUps}`
          : '—'
        : weeklyTotal > 0
          ? `${completionRate}%`
          : '—',
      color: behaviorChangeAnalysis
        ? aligned >= Math.max(1, Math.ceil(showUps * WEEKLY_TARGET_RATIO))
          ? 'text-emerald-400'
          : aligned > 0
            ? 'text-amber-400'
            : 'txt-strong'
        : completionRate >= 70
          ? 'text-emerald-400'
          : completionRate >= 40
            ? 'text-amber-400'
            : 'txt-strong',
    },
    {
      label: behaviorChangeAnalysis ? t('home.kpiBarrierTouched') : t('home.kpiEnergyTrend'),
      value: behaviorChangeAnalysis
        ? showUps > 0
          ? String(behaviorChangeAnalysis.barrier_touched_count)
          : behaviorChangeAnalysis.comeback_after_barrier
            ? '✓'
            : '—'
        : completedRitualSessions(ritualSessions).length > 0
          ? trendIcon
          : '—',
      color: behaviorChangeAnalysis
        ? behaviorChangeAnalysis.barrier_touched_count >= 1 || behaviorChangeAnalysis.comeback_after_barrier
          ? 'text-violet-300'
          : 'txt-muted'
        : trendColor,
    },
    {
      label: t('behaviorScience.behaviorScore.label'),
      value: behaviorScore.opportunities > 0 ? `${behaviorScore.percent}%` : '—',
      color:
        behaviorScore.percent >= 70
          ? 'text-emerald-400'
          : behaviorScore.percent >= 40
            ? 'text-amber-400'
            : 'txt-muted',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
      {kpis.map(({label, value, color}) => (
        <div
          key={label}
          className="flex flex-col items-center rounded-[18px] border border-[color:var(--color-border)] fill-1 py-4 px-2"
        >
          <span className={`text-xl font-black tabular-nums leading-none ${color}`}>
            {value}
          </span>
          <span className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] txt-faint leading-tight">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HomePersonalBests({
  data,
  momentumScore,
  t,
}: {
  data: HomeDashboardData;
  momentumScore: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const strongestDomain = data.domainStates
    .filter((state: LifeDomainState) => typeof state.current_score === 'number')
    .sort((a, b) => b.current_score - a.current_score)[0] ?? null;
  const activeGoalCount = data.goals.filter((goal) => goal.status === 'active').length;

  const bests = [
    {
      label: t('home.personalBests.bestMomentum'),
      value: String(momentumScore),
      detail: t('home.personalBests.points'),
    },
    {
      label: t('home.personalBests.bestWeek'),
      value: String(data.weeklyDone),
      detail: t('home.personalBests.steps'),
    },
    {
      label: t('home.personalBests.bestRitual'),
      value: String(data.ritualStreak),
      detail: t('home.personalBests.days'),
    },
    {
      label: t('home.personalBests.strongestDomain'),
      value: strongestDomain ? t(`lifeCoach.domains.${strongestDomain.domain}.label`) : String(activeGoalCount),
      detail: strongestDomain
        ? t('home.personalBests.score', {score: strongestDomain.current_score})
        : t('home.personalBests.activeGoals'),
    },
  ];

  return (
    <div className="rounded-[20px] border border-[color:var(--color-border)] fill-1 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest txt-faint">
        {t('home.personalBestsTitle')}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bests.map((best) => (
          <div key={best.label} className="rounded-2xl border border-[color:var(--color-border)] fill-1 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider txt-faint">{best.label}</p>
            <p className="mt-1 truncate text-lg font-black txt-strong">{best.value}</p>
            <p className="mt-0.5 text-xs txt-muted">{best.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
