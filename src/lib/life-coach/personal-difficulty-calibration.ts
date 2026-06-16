import {dateDaysAgo, listStepsSince} from '@/lib/coach-memory/data';
import type {DailyBabyStep, DailyStepDifficulty} from '@/lib/life-coach/types';

const DIFFICULTY_RANK: Record<DailyStepDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

const STEP_MIN_MINUTES = 5;
const STEP_MAX_MINUTES = 20;
const OVERLOAD_MAX_MINUTES = 10;
const COMPLETION_RATE_HIGH = 0.65;
const COMPLETION_RATE_VERY_HIGH = 0.75;
const OVERLOAD_RATE_HIGH = 0.35;
const OVERLOAD_RATE_LOW = 0.25;

const OVERLOAD_BLOCKERS = new Set<DailyBabyStep['blocker_reason']>([
  'no_time',
  'family_chaos',
  'low_energy',
  'emotional_resistance',
]);

type DifficultyRampMode = 'reduce' | 'hold' | 'raise';

export type PersonalDifficultyCalibration = {
  window_days: number;
  difficulty_ceiling: DailyStepDifficulty;
  target_minutes: number;
  max_minutes: number;
  sample_size: number;
  completion_rate_14d: number;
  overload_skip_rate: number;
  ramp_mode: DifficultyRampMode;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function completionRate(steps: DailyBabyStep[]): number {
  const actionable = steps.filter((s) => s.status !== 'pending');
  if (actionable.length === 0) return 0;
  const done = actionable.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  ).length;
  return Math.round((done / actionable.length) * 100) / 100;
}

function rateByDifficulty(
  steps: DailyBabyStep[],
  difficulty: DailyStepDifficulty
): number | null {
  const subset = steps.filter((s) => s.difficulty === difficulty && s.status !== 'pending');
  if (subset.length < 2) return null;
  const done = subset.filter((s) => s.status === 'completed' || s.status === 'partial').length;
  return done / subset.length;
}

function overloadSkipRate(steps: DailyBabyStep[]): number {
  const longTasks = steps.filter(
    (s) => s.estimated_minutes > 10 && s.status !== 'pending'
  );
  if (longTasks.length < 2) return 0;
  const skipped = longTasks.filter(
    (s) =>
      s.status === 'skipped' &&
      (OVERLOAD_BLOCKERS.has(s.blocker_reason ?? null) ||
        s.difficulty === 'hard')
  ).length;
  return Math.round((skipped / longTasks.length) * 100) / 100;
}

function minDifficulty(
  a: DailyStepDifficulty,
  b: DailyStepDifficulty
): DailyStepDifficulty {
  return DIFFICULTY_RANK[a] <= DIFFICULTY_RANK[b] ? a : b;
}

function maxDifficulty(
  a: DailyStepDifficulty,
  b: DailyStepDifficulty
): DailyStepDifficulty {
  return DIFFICULTY_RANK[a] >= DIFFICULTY_RANK[b] ? a : b;
}

function resolveDifficultyCeiling(
  steps: DailyBabyStep[],
  completion14d: number,
  overloadRate: number
): DailyStepDifficulty {
  let ceiling: DailyStepDifficulty = 'easy';

  const easyRate = rateByDifficulty(steps, 'easy');
  const mediumRate = rateByDifficulty(steps, 'medium');
  const hardRate = rateByDifficulty(steps, 'hard');

  if (easyRate != null && easyRate >= 0.55) ceiling = 'medium';
  if (mediumRate != null && mediumRate >= 0.5 && completion14d >= 0.5) {
    ceiling = 'hard';
  }
  if (mediumRate != null && mediumRate < 0.4) ceiling = 'easy';
  if (hardRate != null && hardRate < 0.35) ceiling = 'medium';
  if (overloadRate >= OVERLOAD_RATE_HIGH) ceiling = minDifficulty(ceiling, 'medium');
  if (overloadRate >= 0.5) ceiling = 'easy';

  return ceiling;
}

export function computePersonalDifficultyCalibration(
  userId: string,
  windowDays = 14
): PersonalDifficultyCalibration {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const steps = listStepsSince(userId, since);
  const completion14d = completionRate(steps);
  const overloadRate = overloadSkipRate(steps);

  const completedMinutes = steps
    .filter((s) => s.status === 'completed' || s.status === 'partial')
    .map((s) => s.actual_minutes ?? s.estimated_minutes)
    .filter((m) => m >= 1 && m <= 60);

  let target_minutes = Math.round(percentile(completedMinutes, 70));
  target_minutes = Math.max(STEP_MIN_MINUTES, Math.min(STEP_MAX_MINUTES, target_minutes || 10));

  let max_minutes = STEP_MAX_MINUTES;
  let ramp_mode: DifficultyRampMode = 'hold';

  if (overloadRate >= OVERLOAD_RATE_HIGH) {
    max_minutes = OVERLOAD_MAX_MINUTES;
    target_minutes = Math.min(target_minutes, OVERLOAD_MAX_MINUTES);
    ramp_mode = 'reduce';
  }

  const twoWeekHigh =
    steps.length >= 8 && completion14d >= COMPLETION_RATE_HIGH && overloadRate < OVERLOAD_RATE_LOW;

  if (twoWeekHigh) {
    ramp_mode = 'raise';
    if (max_minutes === OVERLOAD_MAX_MINUTES) {
      max_minutes = OVERLOAD_MAX_MINUTES + 2;
    } else {
      max_minutes = Math.min(STEP_MAX_MINUTES, max_minutes + 2);
    }
    target_minutes = Math.min(max_minutes, target_minutes + 2);
  }

  if (overloadRate >= OVERLOAD_RATE_HIGH) {
    target_minutes = Math.min(target_minutes, OVERLOAD_MAX_MINUTES);
  }

  let difficulty_ceiling = resolveDifficultyCeiling(steps, completion14d, overloadRate);

  if (twoWeekHigh && ramp_mode === 'raise') {
    difficulty_ceiling = maxDifficulty(
      difficulty_ceiling,
      completion14d >= COMPLETION_RATE_VERY_HIGH ? 'hard' : 'medium'
    );
  }

  return {
    window_days: windowDays,
    difficulty_ceiling,
    target_minutes,
    max_minutes,
    sample_size: steps.length,
    completion_rate_14d: completion14d,
    overload_skip_rate: overloadRate,
    ramp_mode,
  };
}

export function calibrationForPrompt(
  calibration: PersonalDifficultyCalibration | null | undefined
): Record<string, unknown> | null {
  if (!calibration || calibration.sample_size === 0) return null;
  return {
    difficulty_ceiling: calibration.difficulty_ceiling,
    target_minutes: calibration.target_minutes,
    max_minutes: calibration.max_minutes,
    completion_rate_14d: calibration.completion_rate_14d,
    overload_skip_rate: calibration.overload_skip_rate,
    ramp_mode: calibration.ramp_mode,
  };
}

export function applyPersonalDifficultyCalibration<T extends {
  estimated_minutes: number;
  difficulty: DailyStepDifficulty;
}>(
  steps: T[],
  calibration: PersonalDifficultyCalibration
): T[] {
  return steps.map((step) => {
    let minutes = Math.min(step.estimated_minutes, calibration.max_minutes);
    if (minutes > calibration.target_minutes + 2) {
      minutes = calibration.target_minutes + 2;
    }
    minutes = Math.max(STEP_MIN_MINUTES, Math.min(STEP_MAX_MINUTES, minutes));

    let difficulty = step.difficulty;
    if (DIFFICULTY_RANK[difficulty] > DIFFICULTY_RANK[calibration.difficulty_ceiling]) {
      difficulty = calibration.difficulty_ceiling;
    }

    return {...step, estimated_minutes: minutes, difficulty};
  });
}
