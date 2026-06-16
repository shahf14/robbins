'use client';

import {Link} from '@/i18n/navigation';
import type {useTranslations} from 'next-intl';
import type {DailyBabyStep, Goal, LifeDomain, Milestone} from '@/lib/life-coach/types';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import type {PersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';
import {WEEKLY_TARGET_RATIO} from '@/lib/life-coach/progress-constants';
import {dateToYMD} from '@/lib/date-utils';
import {completedRitualSessions, ritualEnergy} from '@/lib/home/ritual-derived';

type GoalWithMilestones = Goal & {milestones?: Milestone[]};

type HomeBadgeId =
  | 'firstStep'
  | 'weekBuilder'
  | 'ritualSpark'
  | 'goalSetter'
  | 'multiDomain'
  | 'comeback';

export type HomeBadge = {
  id: HomeBadgeId;
  unlocked: boolean;
  tone: 'blue' | 'green' | 'amber';
};

export function HomeBadgesPanel({
  badges,
  t,
}: {
  badges: HomeBadge[];
  t: ReturnType<typeof useTranslations>;
}) {
  const unlocked = badges.filter((badge) => badge.unlocked);
  const preview = badges.find((badge) => !badge.unlocked);
  const visible = unlocked.length > 0 ? unlocked.slice(0, 4) : preview ? [preview] : [];

  if (visible.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-white/8 bg-white/3 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/35">
            {t('home.badgesTitle')}
          </p>
          <p className="mt-1 text-sm font-semibold text-white/60">
            {t('home.badgesSubtitle', {done: unlocked.length, total: badges.length})}
          </p>
        </div>
        {preview && unlocked.length > 0 && (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-white/35">
            {t('home.nextBadge')}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {visible.map((badge) => (
          <HomeBadgeChip key={badge.id} badge={badge} t={t} />
        ))}
        {preview && unlocked.length > 0 && (
          <HomeBadgeChip badge={preview} t={t} />
        )}
      </div>
    </div>
  );
}

function HomeBadgeChip({
  badge,
  t,
}: {
  badge: HomeBadge;
  t: ReturnType<typeof useTranslations>;
}) {
  const toneClass =
    badge.unlocked
      ? badge.tone === 'green'
        ? 'border-emerald-400/25 bg-emerald-500/8 text-emerald-300'
        : badge.tone === 'amber'
          ? 'border-amber-400/25 bg-amber-500/8 text-amber-300'
          : 'border-[var(--blue)]/25 bg-[var(--blue)]/8 text-blue-200'
      : 'border-white/8 bg-white/[0.025] text-white/35';

  return (
    <div className={`min-w-[150px] rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-black">{t(`home.badges.${badge.id}.title`)}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{t(`home.badges.${badge.id}.body`)}</p>
      {!badge.unlocked && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          {t('home.lockedBadge')}
        </p>
      )}
    </div>
  );
}

export function HomeWeeklyChallenge({
  done,
  total,
  weeklyMinutes,
  hasGoals,
  challenge,
  accountability,
  t,
}: {
  done: number;
  total: number;
  weeklyMinutes: number;
  hasGoals: boolean;
  challenge: PersonalizedChallenge | null;
  accountability: AccountabilityContext | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!hasGoals && total === 0 && !challenge && !accountability) return null;

  const defaultTarget = total > 0 ? Math.min(total, Math.max(3, Math.ceil(total * WEEKLY_TARGET_RATIO))) : 3;
  const target = challenge?.target_completions_per_week ?? defaultTarget;
  const progress = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const complete = done >= target;

  return (
    <div className={`rounded-[20px] border px-5 py-4 ${
      complete
        ? 'border-emerald-400/25 bg-emerald-500/7'
        : 'border-[var(--blue)]/20 bg-[var(--blue)]/5'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-white/35">
            {t('home.weeklyChallengeEyebrow')}
          </p>
          {accountability?.home_weekly_commitment && (
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--blue)]/90">
              {accountability.home_weekly_commitment}
            </p>
          )}
          <p className="mt-1 text-base font-black text-white">
            {complete
              ? t('home.weeklyChallengeComplete')
              : challenge
                ? challenge.title
                : t('home.weeklyChallengeTitle', {target})}
          </p>
          <p className="mt-1 text-sm leading-6 text-white/50">
            {challenge
              ? challenge.daily_minimum
              : total > 0
                ? t('home.weeklyChallengeBody', {done, target})
                : t('home.weeklyChallengeEmpty')}
          </p>
          {challenge && !complete && (
            <p className="mt-2 text-xs leading-5 text-white/40">{challenge.success_definition}</p>
          )}
          {weeklyMinutes > 0 && (
            <p className="mt-2 text-xs font-semibold text-[var(--blue)]/85">
              {t('home.weeklyMinutesInvested', {minutes: weeklyMinutes})}
            </p>
          )}
        </div>
        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-center">
          <p className={`text-xl font-black tabular-nums ${complete ? 'text-emerald-300' : 'text-[var(--blue)]'}`}>
            {done}/{target}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/35">
            {t('home.weeklyChallengeProgress')}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ${complete ? 'bg-emerald-400' : 'bg-[var(--blue)]'}`}
          style={{width: `${progress}%`}}
        />
      </div>
    </div>
  );
}

export function HomeSoftProgress({
  weekSteps,
  ritualSessions,
  weeklyMinutes,
  t,
}: {
  weekSteps: DailyBabyStep[];
  ritualSessions: MorningRitualSession[];
  weeklyMinutes: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const completed = weekSteps.filter((s) => s.status === 'completed');
  const touchedDomains = new Set(completed.map((s) => s.domain)).size;
  const lowEnergyCompletions = completed.filter((step) => {
    const sameDayRitual = completedRitualSessions(ritualSessions).find((session) => {
      const sessionDate = dateToYMD(new Date(session.completedAt ?? session.startedAt));
      return sessionDate === step.scheduled_date;
    });
    const energy = ritualEnergy(sameDayRitual);
    return energy != null ? energy <= 4 : false;
  }).length;

  if (completed.length === 0 && weeklyMinutes === 0) return null;

  const items = [
    {
      label: t('home.softProgress.consistencyLabel'),
      value: t('home.softProgress.consistencyValue', {count: completed.length}),
    },
    {
      label: t('home.softProgress.energyLabel'),
      value:
        lowEnergyCompletions > 0
          ? t('home.softProgress.energyValue', {count: lowEnergyCompletions})
          : t('home.softProgress.energyFallback'),
    },
    {
      label: t('home.softProgress.depthLabel'),
      value:
        touchedDomains > 1
          ? t('home.softProgress.depthValue', {count: touchedDomains})
          : t('home.softProgress.minutesValue', {minutes: weeklyMinutes}),
    },
  ];

  return (
    <section className="rounded-[20px] border border-emerald-400/18 bg-emerald-500/[0.055] px-5 py-4" aria-label={t('home.softProgress.title')}>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300/80">
        {t('home.softProgress.eyebrow')}
      </p>
      <p className="mt-1 text-base font-black text-white">{t('home.softProgress.title')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{item.label}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/75">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeDomainAttention({
  weekSteps,
  goals,
  t,
}: {
  weekSteps: DailyBabyStep[];
  goals: GoalWithMilestones[];
  t: ReturnType<typeof useTranslations>;
}) {
  const completed = weekSteps.filter((step) => step.status === 'completed');
  const activeGoalDomains = new Set(
    goals.filter((goal) => goal.status === 'active').map((goal) => goal.domain as LifeDomain)
  );
  if (completed.length === 0 && activeGoalDomains.size === 0) return null;

  const domainCounts = new Map<LifeDomain, number>();
  completed.forEach((step) => {
    const domain = step.domain as LifeDomain;
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  });

  const activeDomains = [...activeGoalDomains];
  const strongest = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const neglected =
    activeDomains.find((domain) => (domainCounts.get(domain) ?? 0) === 0) ??
    activeDomains.sort((a, b) => (domainCounts.get(a) ?? 0) - (domainCounts.get(b) ?? 0))[0] ??
    null;
  const visibleDomains = [
    ...new Set<LifeDomain>([
      ...(strongest ? [strongest[0]] : []),
      ...(neglected ? [neglected] : []),
      ...activeDomains,
    ]),
  ].slice(0, 4);

  return (
    <section className="rounded-[20px] border border-white/8 bg-white/3 px-5 py-4" aria-label={t('home.domainAttention.eyebrow')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/35">
            {t('home.domainAttention.eyebrow')}
          </p>
          <p className="mt-1 text-base font-black text-white">
            {strongest
              ? t('home.domainAttention.titleWithDomain', {
                  domain: t(`lifeCoach.domains.${strongest[0]}.label`),
                })
              : t('home.domainAttention.title')}
          </p>
        </div>
        {neglected ? (
          <Link href={`/life-coach/${neglected}`} className="focus-ring btn-small">
            {t('home.domainAttention.cta')}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleDomains.map((domain) => {
          const count = domainCounts.get(domain) ?? 0;
          const isNeglected = neglected === domain && count === 0;
          return (
            <Link
              key={domain}
              href={`/life-coach/${domain}`}
              className={`focus-ring rounded-2xl border px-4 py-3 transition hover:bg-white/5 ${
                isNeglected
                  ? 'border-amber-400/25 bg-amber-500/7'
                  : 'border-white/8 bg-white/[0.025]'
              }`}
            >
              <p className="text-sm font-black text-white">
                {DOMAIN_ICONS[domain]} {t(`lifeCoach.domains.${domain}.short`)}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/50">
                {count > 0
                  ? t('home.domainAttention.stepsDone', {count})
                  : t('home.domainAttention.noSteps')}
              </p>
            </Link>
          );
        })}
      </div>

      {neglected ? (
        <p className="mt-3 text-sm leading-6 text-white/50">
          {t('home.domainAttention.neglectedHint', {
            domain: t(`lifeCoach.domains.${neglected}.label`),
          })}
        </p>
      ) : null}
    </section>
  );
}
