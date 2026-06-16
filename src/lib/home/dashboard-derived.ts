import type {DailyBabyStep, Goal, LifeDomain, LifeDomainState, Milestone} from '@/lib/life-coach/types';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import type {PersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import type {LoadAdaptationContext} from '@/lib/formulation/load-adaptation-routing';
import type {ComebackMessaging} from '@/lib/formulation/comeback-messaging';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {BehaviorChangeContext} from '@/lib/formulation/behavior-change-tracking';
import type {SkipAdaptationContext} from '@/lib/formulation/skip-adaptation-routing';
import {WEEKLY_TARGET_RATIO} from '@/lib/life-coach/progress-constants';
import {completedRitualSessions, ritualEnergy} from '@/lib/home/ritual-derived';

export type GoalWithMilestones = Goal & {milestones?: Milestone[]};

export type CelebrationId = 'firstStep' | 'allDone' | 'weeklyChallenge' | 'multiGoal';

export type HomeBadgeId =
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

export type HomeDashboardData = {
  goals: GoalWithMilestones[];
  todaySteps: DailyBabyStep[];
  domainStates: LifeDomainState[];
  ritualStreak: number;
  hasTodayRitual: boolean;
  hasTodayEvening: boolean;
  ritualSessions: MorningRitualSession[];
  weeklyDone: number;
  weeklyTotal: number;
  weeklyMinutes: number;
  weekSteps: DailyBabyStep[];
  displayName: string;
  personalizedChallenge: PersonalizedChallenge | null;
  loadAdaptation: LoadAdaptationContext | null;
  comebackMessaging: ComebackMessaging | null;
  accountability: AccountabilityContext | null;
  behaviorChange: BehaviorChangeContext | null;
  skipAdaptation: SkipAdaptationContext | null;
  dailyFocus: DailyFocusContext | null;
};

export function computeMomentumScore(data: HomeDashboardData): number {
  const streak = data.ritualStreak;
  const completionRate = data.weeklyTotal > 0 ? data.weeklyDone / data.weeklyTotal : 0;
  const latestEnergy = ritualEnergy(completedRitualSessions(data.ritualSessions)[0]);
  const latestMomentum = latestEnergy != null ? latestEnergy * 10 : 55;

  const streakPts = Math.min(streak * 3, 30);
  const completionPts = completionRate * 40;
  const momentumPts = (latestMomentum / 100) * 30;
  return Math.round(streakPts + completionPts + momentumPts);
}

export function derivePrimaryGoal(
  goals: GoalWithMilestones[],
  primaryDomain: LifeDomain | null
): GoalWithMilestones | null {
  const active = goals.filter((goal) => goal.status === 'active');
  if (active.length === 0) return null;
  if (primaryDomain) {
    const domainGoal = active.find((goal) => goal.domain === primaryDomain);
    if (domainGoal) return domainGoal;
  }
  return active[0];
}

export function deriveHomeBadges(data: HomeDashboardData): HomeBadge[] {
  const completedSteps = data.todaySteps.filter((step) => step.status === 'completed');
  const touchedDomains = new Set(data.goals.map((goal) => goal.domain));
  const skippedForRecovery = data.todaySteps.some(
    (step) =>
      step.status === 'skipped' &&
      (step.blocker_reason === 'low_energy' || step.blocker_reason === 'family_chaos' || step.blocker_reason === 'no_time')
  );

  return [
    {id: 'firstStep', unlocked: completedSteps.length > 0 || data.weeklyDone > 0, tone: 'green'},
    {id: 'weekBuilder', unlocked: data.weeklyDone >= 4, tone: 'blue'},
    {id: 'ritualSpark', unlocked: data.ritualStreak >= 3, tone: 'amber'},
    {id: 'goalSetter', unlocked: data.goals.some((goal) => goal.status === 'active'), tone: 'blue'},
    {id: 'multiDomain', unlocked: touchedDomains.size >= 2, tone: 'green'},
    {id: 'comeback', unlocked: skippedForRecovery && completedSteps.length > 0, tone: 'amber'},
  ];
}

export function deriveCelebration(data: HomeDashboardData): CelebrationId | null {
  const completedToday = data.todaySteps.filter((step) => step.status === 'completed').length;
  const allDone = data.todaySteps.length > 0 && data.todaySteps.every((step) => step.status !== 'pending');
  const activeGoals = data.goals.filter((goal) => goal.status === 'active').length;
  const weeklyTarget = data.weeklyTotal > 0 ? Math.min(data.weeklyTotal, Math.max(3, Math.ceil(data.weeklyTotal * WEEKLY_TARGET_RATIO))) : 3;

  if (allDone) return 'allDone';
  if (data.weeklyTotal > 0 && data.weeklyDone >= weeklyTarget) return 'weeklyChallenge';
  if (activeGoals >= 2) return 'multiGoal';
  if (completedToday > 0 || data.weeklyDone > 0) return 'firstStep';
  return null;
}
