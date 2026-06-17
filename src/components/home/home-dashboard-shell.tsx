'use client';

import {Link} from '@/i18n/navigation';
import type {useTranslations} from 'next-intl';
import type {Goal, LifeContextStatus, Milestone} from '@/lib/life-coach/types';
import {LifeContextChip} from '@/components/life-context-chip';
import {getPersonalDayPhase, personalGreetingKey} from '@/lib/schedule-content';

type GoalWithMilestones = Goal & {milestones?: Milestone[]};

type CelebrationId = 'firstStep' | 'allDone' | 'weeklyChallenge' | 'multiGoal';

export function HomeMicroReward({message}: {message: string}) {
  return (
    <div className="rounded-[18px] border border-emerald-400/25 bg-emerald-500/8 px-5 py-3 text-sm font-black text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
      {message}
    </div>
  );
}

export function HomeCelebrationMoment({
  id,
  t,
}: {
  id: CelebrationId;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-[22px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,0.03))] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-300/80">
        {t('home.celebrationEyebrow')}
      </p>
      <p className="mt-2 text-lg font-black txt-strong">{t(`home.celebrations.${id}.title`)}</p>
      <p className="mt-1 text-sm leading-6 txt-soft">{t(`home.celebrations.${id}.body`)}</p>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div
      className="page-shell flex flex-col gap-4 py-6 sm:gap-5 sm:py-8"
      aria-busy="true"
      aria-label="Loading dashboard…"
    >
      {[130, 200, 120, 56, 56].map((h, i) => (
        <div
          key={`skeleton-${i}`}
          className="animate-pulse rounded-[24px] fill-2"
          style={{height: h}}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function HomeCompactHeader({
  streak,
  displayName,
  lifeContexts,
  wakeTime,
  sleepTime,
  weeklyDone,
  weeklyTotal,
  t,
}: {
  streak: number;
  displayName: string;
  lifeContexts?: LifeContextStatus[];
  wakeTime: string;
  sleepTime: string;
  weeklyDone: number;
  weeklyTotal: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const name = displayName || t('dashboard.personalFallbackName');
  const phase = getPersonalDayPhase(wakeTime, sleepTime);
  const greeting = t(personalGreetingKey(phase), {name});

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[clamp(1.5rem,4.5vw,2.25rem)] font-black leading-tight txt-strong">
            {greeting}
          </h1>
        </div>
        {weeklyTotal > 0 && (
          <p className="mt-1.5 text-sm font-medium txt-soft">
            {t('home.compact.weekLine', {done: weeklyDone, total: weeklyTotal})}
          </p>
        )}
        <LifeContextChip statuses={lifeContexts} className="mt-2" />
      </div>
      {streak > 0 && (
        <span className="shrink-0 rounded-full border border-[color:var(--color-border)] fill-2 px-3 py-1.5 text-sm font-bold txt-soft">
          {t('home.streakDays', {count: streak})}
        </span>
      )}
    </div>
  );
}

export function HomeCompactProgress({
  streak,
  weeklyDone,
  weeklyTarget,
  primaryGoal,
  hasGoals,
  allDone,
  t,
}: {
  streak: number;
  weeklyDone: number;
  weeklyTarget: number;
  primaryGoal: GoalWithMilestones | null;
  hasGoals: boolean;
  allDone: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!hasGoals && weeklyDone === 0 && streak === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[16px] fill-1 px-4 py-3">
      {weeklyDone > 0 || weeklyTarget > 0 ? (
        <span className="text-sm font-semibold txt-soft">
          {t('home.compact.weekProgress', {done: weeklyDone, target: weeklyTarget})}
        </span>
      ) : null}
      {allDone && (
        <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
          {t('home.compact.allDoneToday')}
        </span>
      )}
      {primaryGoal ? (
        <Link
          href={`/life-coach/${primaryGoal.domain}`}
          className="focus-ring ms-auto truncate text-sm font-semibold text-[var(--blue)]"
        >
          {t('home.compact.viewGoal')} →
        </Link>
      ) : hasGoals ? (
        <Link href="/life-coach" className="focus-ring ms-auto text-sm font-semibold text-[var(--blue)]">
          {t('home.compact.viewDomains')} →
        </Link>
      ) : null}
    </div>
  );
}
