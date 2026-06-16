import type {UserBehaviorProfile} from '@/lib/behavior-profile/types';
import {maxStepsFromBlockerPatterns} from '@/lib/blocker-patterns/detect-recurring-blockers';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import type {ShortTermContext} from '@/lib/coach-memory/types';
import type {ExecutionHistorySummary} from '@/lib/execution-history/summarize';
import type {LongTermProfile} from '@/lib/coach-memory/types';
import type {RitualAdaptationContext} from '@/lib/morning-ritual-adaptation';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';

const COMPLETION_RATE_VERY_LOW = 0.4;
const COMPLETION_RATE_LOW = 0.45;
const COMPLETION_RATE_HIGH = 0.65;
const COMPLETION_RATE_LONG_TERM_HIGH = 0.6;
const LOW_ENERGY_FREQUENCY_THRESHOLD = 0.5;
const EASY_STEP_MAX_MINUTES = 10;

export type AdaptiveTaskCountReason =
  | 'high_risk'
  | 'low_energy'
  | 'stable_streak'
  | 'high_consistency'
  | 'skip_coach_recovery'
  | 'overplanning'
  | 'breaking_point'
  | 'default';

export type AdaptiveTaskCount = {
  max_steps: number;
  easy_only: boolean;
  reason: AdaptiveTaskCountReason;
};

export type ResolveAdaptiveTaskCountInput = {
  behaviorProfile: UserBehaviorProfile;
  executionHistory: ExecutionHistorySummary;
  shortTermContext: ShortTermContext;
  longTermProfile: LongTermProfile;
  recurringBlockers: RecurringBlockerPattern[];
  latestRitual?: RitualAdaptationContext | null;
};

function isHighRisk(input: ResolveAdaptiveTaskCountInput): boolean {
  const {behaviorProfile, executionHistory, shortTermContext, longTermProfile, recurringBlockers} =
    input;

  if (recurringBlockers.some((pattern) => pattern.severity === 'high')) return true;
  if (
    behaviorProfile.sample_size_7d >= 5 &&
    behaviorProfile.avg_completion_rate_7d < 0.35
  ) {
    return true;
  }
  if (
    longTermProfile.sample_size >= 5 &&
    longTermProfile.overall_completion_rate < 0.35
  ) {
    return true;
  }
  if (
    executionHistory.total_steps >= 5 &&
    executionHistory.completion_rate < 0.35
  ) {
    return true;
  }
  if (
    shortTermContext.skipped_hard >= 2 &&
    shortTermContext.completion_rate < COMPLETION_RATE_LOW
  ) {
    return true;
  }
  if (
    shortTermContext.skipped > shortTermContext.completed &&
    shortTermContext.completion_rate < COMPLETION_RATE_VERY_LOW
  ) {
    return true;
  }
  return false;
}

function isLowEnergy(input: ResolveAdaptiveTaskCountInput): boolean {
  const {behaviorProfile, shortTermContext, executionHistory, latestRitual} = input;
  if (latestRitual?.is_low_energy) return true;
  if (latestRitual?.energy != null && latestRitual.energy <= 3) return true;
  if (shortTermContext.latest_energy != null && shortTermContext.latest_energy <= 4) {
    return true;
  }
  if (shortTermContext.worst_blocker === 'low_energy') return true;
  if (behaviorProfile.low_energy_frequency >= LOW_ENERGY_FREQUENCY_THRESHOLD) return true;
  if (executionHistory.worst_blocker === 'low_energy' && executionHistory.skipped_hard >= 1) {
    return true;
  }
  return false;
}

function isStableStreak(input: ResolveAdaptiveTaskCountInput): boolean {
  const {shortTermContext, executionHistory} = input;
  const rate = shortTermContext.completion_rate;
  const showUps = shortTermContext.completed + shortTermContext.partial;

  return (
    showUps >= 3 &&
    rate >= COMPLETION_RATE_LOW &&
    rate < COMPLETION_RATE_HIGH &&
    executionHistory.show_up_days >= 3
  );
}

function isHighConsistency(input: ResolveAdaptiveTaskCountInput): boolean {
  const {behaviorProfile, longTermProfile, executionHistory} = input;

  if (
    behaviorProfile.sample_size_7d >= 5 &&
    behaviorProfile.avg_completion_rate_7d >= COMPLETION_RATE_HIGH
  ) {
    return true;
  }
  if (
    longTermProfile.sample_size >= 8 &&
    longTermProfile.overall_completion_rate >= COMPLETION_RATE_LONG_TERM_HIGH
  ) {
    return true;
  }
  if (
    executionHistory.total_steps >= 7 &&
    executionHistory.completion_rate >= COMPLETION_RATE_HIGH
  ) {
    return true;
  }
  return false;
}

/** Adaptive cap — optimize for daily completion, not step volume. */
export function resolveAdaptiveTaskCount(
  input: ResolveAdaptiveTaskCountInput
): AdaptiveTaskCount {
  let result: AdaptiveTaskCount;

  if (isHighRisk(input)) {
    result = {max_steps: 1, easy_only: false, reason: 'high_risk'};
  } else if (isLowEnergy(input)) {
    result = {max_steps: 1, easy_only: true, reason: 'low_energy'};
  } else if (isHighConsistency(input)) {
    result = {max_steps: 3, easy_only: false, reason: 'high_consistency'};
  } else if (isStableStreak(input)) {
    result = {max_steps: 2, easy_only: false, reason: 'stable_streak'};
  } else {
    result = {max_steps: 2, easy_only: false, reason: 'default'};
  }

  const capped = maxStepsFromBlockerPatterns(input.recurringBlockers, result.max_steps);
  if (capped < result.max_steps) {
    result = {...result, max_steps: capped};
  }
  if (result.max_steps === 1 && result.reason !== 'low_energy' && isLowEnergy(input)) {
    result = {...result, easy_only: true, reason: 'low_energy'};
  }

  return result;
}

export function enforceEasyOnlySteps(
  steps: StructuredDailyBabyStep[]
): StructuredDailyBabyStep[] {
  return steps.map((step) => ({
    ...step,
    difficulty: 'easy',
    estimated_minutes: Math.min(step.estimated_minutes, EASY_STEP_MAX_MINUTES),
  }));
}
