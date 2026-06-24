import {computeRecoveryRate} from '@/lib/behavior-profile/compute';
import {computeComebackChain} from '@/lib/gamification/comeback-chain';
import {computeDomainRivalry} from '@/lib/gamification/domain-rivalry';
import {deriveIdentityTitle} from '@/lib/gamification/identity-titles';
import {computeMysteryUnlock} from '@/lib/gamification/mystery-unlocks';
import {deriveStreakHealth} from '@/lib/gamification/streak-health';
import type {DailyBabyStep} from '@/lib/life-coach/types';

export type GamificationState = {
  comebackChain: ReturnType<typeof computeComebackChain>;
  identityTitle: ReturnType<typeof deriveIdentityTitle>;
  domainRivalry: ReturnType<typeof computeDomainRivalry>;
  mysteryUnlock: ReturnType<typeof computeMysteryUnlock>;
  streakHealth: ReturnType<typeof deriveStreakHealth>;
};

export function buildGamificationState(input: {
  today: string;
  todaySteps: DailyBabyStep[];
  weekSteps: DailyBabyStep[];
  ritualStreak: number;
  sleepTime: string;
  hasTodayRitual: boolean;
  latestEnergy: number | null;
  hasWeeklyReview: boolean;
  now?: Date;
}): GamificationState {
  const weeklyDone = input.weekSteps.filter((step) => step.status === 'completed').length;
  const pendingEvening = input.todaySteps.filter((step) => step.status === 'pending').length;
  const comebackChain = computeComebackChain(input.weekSteps, input.today);
  return {
    comebackChain,
    identityTitle: deriveIdentityTitle({
      weeklyDone,
      allDoneToday:
        input.todaySteps.length > 0 &&
        input.todaySteps.every((step) => step.status !== 'pending'),
      comebackChain,
      activeDomains: new Set(
        input.weekSteps.filter((step) => step.status === 'completed').map((step) => step.domain)
      ).size,
      pendingEvening,
      recoveryRate: computeRecoveryRate(input.weekSteps),
    }),
    domainRivalry: computeDomainRivalry(input.weekSteps),
    mysteryUnlock: computeMysteryUnlock(weeklyDone, input.hasWeeklyReview),
    streakHealth: deriveStreakHealth(
      input.ritualStreak,
      pendingEvening,
      input.sleepTime,
      input.hasTodayRitual,
      input.now ?? new Date(),
      input.latestEnergy
    ),
  };
}
