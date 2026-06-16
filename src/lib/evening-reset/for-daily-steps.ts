import {dateToYMD} from '@/lib/date-utils';
import {getCompletedEveningResetForDate} from '@/lib/db/repositories/evening-reset';
import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import {enforceEasyOnlySteps} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import {briefingFieldsFromSession, type EveningBriefingFields} from './briefing';

export type EveningBriefingForTomorrow = EveningBriefingFields & {
  briefing_date: string;
  for_date: string;
  tomorrows_win: string | null;
  tomorrow_takeaway: string | null;
  day_mood: number | null;
  readiness_score: number | null;
  max_step_minutes: number | null;
};

const TASKS_TOO_BIG_MAX_MINUTES = 10;
const LOW_ENERGY_MAX_MINUTES = 12;

function localDateStr(d: Date): string {
  return dateToYMD(d);
}

function previousDateIso(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

export function resolveEveningBriefingForDate(
  userId: string,
  forDate: string
): EveningBriefingForTomorrow | null {
  const briefingDate = previousDateIso(forDate);
  const session = getCompletedEveningResetForDate(userId, briefingDate);
  if (!session?.completed) return null;

  const fields = briefingFieldsFromSession(session);
  const max_step_minutes = fields.tasks_too_big
    ? TASKS_TOO_BIG_MAX_MINUTES
    : fields.energy_forecast === 'low'
      ? LOW_ENERGY_MAX_MINUTES
      : null;

  return {
    ...fields,
    briefing_date: briefingDate,
    for_date: forDate,
    tomorrows_win: session.tomorrowsWin?.trim() || null,
    tomorrow_takeaway: session.tomorrow_takeaway?.trim() || null,
    day_mood: session.dayMood ?? null,
    readiness_score: session.readinessScore ?? null,
    max_step_minutes,
  };
}

export function eveningBriefingForPrompt(
  briefing: EveningBriefingForTomorrow | null | undefined
): Record<string, unknown> | null {
  if (!briefing) return null;
  return {
    briefing_date: briefing.briefing_date,
    for_date: briefing.for_date,
    tomorrow_constraint: briefing.tomorrow_constraint,
    what_worked: briefing.what_worked,
    what_failed: briefing.what_failed,
    energy_forecast: briefing.energy_forecast,
    tomorrows_win: briefing.tomorrows_win,
    tomorrow_takeaway: briefing.tomorrow_takeaway,
    day_mood: briefing.day_mood,
    tasks_too_big: briefing.tasks_too_big,
    max_step_minutes: briefing.max_step_minutes,
  };
}

export const EVENING_BRIEFING_PROMPT_BLOCK = [
  '## Evening briefing for tomorrow (mandatory when present):',
  'Use evening_briefing from last night\'s reset — it is the primary input for tomorrow\'s step sizing.',
  'Fields: tomorrow_constraint, what_worked, what_failed, energy_forecast, tomorrows_win, tomorrow_takeaway, tasks_too_big.',
  'If tasks_too_big is true: NEVER generate steps at yesterday\'s size — max 10 minutes each, easy difficulty only, concrete micro-deliverable.',
  'If energy_forecast is "low": easy steps only, max 12 minutes, restorative wording.',
  'Honor tomorrow_constraint literally — if user said tasks were too big, shrink aggressively.',
  'Echo tomorrows_win in at least one step when it aligns with an active goal.',
  'If tomorrow_takeaway is present: weave its concrete action into the first step title or description — do not ignore it.',
].join('\n');

export function applyEveningBriefingToAdaptiveTaskCount(
  count: AdaptiveTaskCount,
  briefing: EveningBriefingForTomorrow | null | undefined
): AdaptiveTaskCount {
  if (!briefing) return count;

  if (briefing.tasks_too_big || briefing.energy_forecast === 'low') {
    return {
      max_steps: Math.min(count.max_steps, briefing.tasks_too_big ? 1 : 2),
      easy_only: true,
      reason: briefing.tasks_too_big ? 'low_energy' : count.reason,
    };
  }

  return count;
}

export function applyEveningBriefingToCalibration(
  calibration: PersonalDifficultyCalibration,
  briefing: EveningBriefingForTomorrow | null | undefined
): PersonalDifficultyCalibration {
  if (!briefing) return calibration;

  if (briefing.tasks_too_big) {
    return {
      ...calibration,
      difficulty_ceiling: 'easy',
      target_minutes: Math.min(calibration.target_minutes, 8),
      max_minutes: Math.min(calibration.max_minutes, TASKS_TOO_BIG_MAX_MINUTES),
      ramp_mode: 'reduce',
    };
  }

  if (briefing.energy_forecast === 'low') {
    return {
      ...calibration,
      difficulty_ceiling: 'easy',
      target_minutes: Math.min(calibration.target_minutes, 10),
      max_minutes: Math.min(calibration.max_minutes, LOW_ENERGY_MAX_MINUTES),
      ramp_mode: calibration.ramp_mode === 'raise' ? 'hold' : 'reduce',
    };
  }

  return calibration;
}

export function enforceEveningBriefingOnSteps(
  steps: StructuredDailyBabyStep[],
  briefing: EveningBriefingForTomorrow | null | undefined
): StructuredDailyBabyStep[] {
  if (!briefing) return steps;

  if (briefing.tasks_too_big) {
    return enforceEasyOnlySteps(steps).map((step) => ({
      ...step,
      difficulty: 'easy' as const,
      estimated_minutes: Math.max(3, Math.min(TASKS_TOO_BIG_MAX_MINUTES, step.estimated_minutes)),
    }));
  }

  if (briefing.energy_forecast === 'low') {
    return steps.map((step) => ({
      ...step,
      difficulty: 'easy' as const,
      estimated_minutes: Math.min(step.estimated_minutes, LOW_ENERGY_MAX_MINUTES),
    }));
  }

  return steps;
}
