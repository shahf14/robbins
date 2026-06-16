import {dateToYMD} from '@/lib/date-utils';
import {dbGet} from '@/lib/db/sqlite';
import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {DailyBabyStep, Goal} from '@/lib/life-coach/types';

type OverplanningSignals = {
  active_goals_count: number;
  pending_steps_count: number;
  weekly_completion_rate: number;
};

export type OverplanningContext = {
  is_overplanned: boolean;
  signals: OverplanningSignals;
};

const PENDING_BACKLOG_THRESHOLD = 4;
const LOW_WEEKLY_COMPLETION = 0.45;
const GOAL_LOAD_THRESHOLD = 3;
const HEAVY_BACKLOG_THRESHOLD = 6;

function dateDaysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function countPendingDailySteps(userId: string, asOfDate: string): number {
  const row = dbGet<{c: number}>(
    `SELECT COUNT(*) as c FROM daily_steps
     WHERE user_id = ? AND status = 'pending' AND scheduled_date <= ?`,
    [userId, asOfDate]
  );
  return Number(row?.c ?? 0);
}

function computeWeeklyCompletionRate(
  steps: DailyBabyStep[],
  asOfDate: string
): number {
  const weekStart = dateDaysBefore(asOfDate, 6);
  const weekSteps = steps.filter(
    (step) => step.scheduled_date >= weekStart && step.scheduled_date <= asOfDate
  );
  const actionable = weekSteps.filter(
    (step) =>
      step.status === 'completed' ||
      step.status === 'skipped' ||
      step.status === 'partial'
  );
  if (actionable.length === 0) return 1;

  const completed = weekSteps.filter(
    (step) => step.status === 'completed' || step.status === 'partial'
  ).length;
  return completed / actionable.length;
}

function isOverplanned(signals: OverplanningSignals): boolean {
  const {active_goals_count, pending_steps_count, weekly_completion_rate} = signals;

  if (
    pending_steps_count >= PENDING_BACKLOG_THRESHOLD &&
    weekly_completion_rate < LOW_WEEKLY_COMPLETION
  ) {
    return true;
  }

  if (
    active_goals_count >= GOAL_LOAD_THRESHOLD &&
    pending_steps_count >= HEAVY_BACKLOG_THRESHOLD
  ) {
    return true;
  }

  return false;
}

function resolveOverplanningContext(input: {
  goals: Goal[];
  dailySteps: DailyBabyStep[];
  date: string;
  pendingStepsCount: number;
}): OverplanningContext {
  const signals: OverplanningSignals = {
    active_goals_count: input.goals.length,
    pending_steps_count: input.pendingStepsCount,
    weekly_completion_rate: computeWeeklyCompletionRate(input.dailySteps, input.date),
  };

  return {
    is_overplanned: isOverplanned(signals),
    signals,
  };
}

export function detectOverplanning(input: {
  userId: string;
  date: string;
  goals: Goal[];
  dailySteps: DailyBabyStep[];
}): OverplanningContext {
  return resolveOverplanningContext({
    goals: input.goals,
    dailySteps: input.dailySteps,
    date: input.date,
    pendingStepsCount: countPendingDailySteps(input.userId, input.date),
  });
}

export function applyOverplanningToAdaptiveTaskCount(
  count: AdaptiveTaskCount,
  overplanning: OverplanningContext | null | undefined
): AdaptiveTaskCount {
  if (!overplanning?.is_overplanned) return count;

  const severe =
    overplanning.signals.pending_steps_count >= HEAVY_BACKLOG_THRESHOLD ||
    overplanning.signals.weekly_completion_rate < 0.3;
  const max_steps = severe ? 1 : 2;

  return {
    max_steps: Math.min(count.max_steps, max_steps),
    easy_only: true,
    reason: 'overplanning',
  };
}

export function applyOverplanningToCalibration(
  calibration: PersonalDifficultyCalibration,
  overplanning: OverplanningContext | null | undefined
): PersonalDifficultyCalibration {
  if (!overplanning?.is_overplanned) return calibration;

  return {
    ...calibration,
    difficulty_ceiling: 'easy',
    target_minutes: Math.min(calibration.target_minutes, 8),
    max_minutes: Math.min(calibration.max_minutes, 10),
    ramp_mode: 'reduce',
  };
}

export const OVERPLANNING_PROMPT_BLOCK = [
  '## Overplanning guard (mandatory when overplanning.is_overplanned is true):',
  'User is overplanned. Generate fewer and smaller steps.',
  'They have too many active goals and/or pending backlog with low weekly completion.',
  'Do NOT add volume — help them finish what is already open.',
  'Generate EXACTLY max_steps (1-2 only). Every step MUST be easy and at most 10 minutes.',
  'Prefer closing one existing thread over opening new goals.',
  'Wording: permission-giving, no guilt about the backlog.',
].join('\n');

export function overplanningForPrompt(
  overplanning: OverplanningContext | null | undefined
): Record<string, unknown> | null {
  if (!overplanning) return null;
  return {
    is_overplanned: overplanning.is_overplanned,
    active_goals_count: overplanning.signals.active_goals_count,
    pending_steps_count: overplanning.signals.pending_steps_count,
    weekly_completion_rate: Number(
      overplanning.signals.weekly_completion_rate.toFixed(2)
    ),
  };
}
