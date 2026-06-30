import {isFirstWinStep} from '@/lib/formulation/first-win-routing';
import {assignSuggestedStepTimes, parseTimeToMinutes} from '@/lib/schedule-content';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {DailyBabyStepResponse} from './response-dtos';
import type {DailyStepDifficulty, DailyStepStatus} from './types';
import {
  deriveFitContextFromSteps,
  pickRecommendedFirst,
  sortPendingByFit,
  type StepFitContext,
} from './step-fit-score';

const STATUS_ORDER: Record<DailyStepStatus, number> = {
  pending: 0,
  partial: 1,
  skipped: 2,
  completed: 3,
};

const DIFFICULTY_ORDER: Record<DailyStepDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export type EnergyBand = 'low' | 'medium' | 'high';

type SchedulePrefs = {
  wake_time: string;
  sleep_time: string;
  preferred_action_window: PreferredActionWindow;
};

export function deriveEnergyBand(energy: number | null | undefined): EnergyBand {
  if (energy == null) return 'medium';
  if (energy <= 4) return 'low';
  if (energy >= 7) return 'high';
  return 'medium';
}

function timeWindowScore(suggestedTime: string | undefined, now = new Date()): number {
  if (!suggestedTime) return 1;
  const current = now.getHours() * 60 + now.getMinutes();
  const target = parseTimeToMinutes(suggestedTime);
  const delta = Math.abs(current - target);
  if (delta <= 45) return 0;
  if (delta <= 120) return 1;
  return 2;
}

function energyFitScore(step: DailyBabyStepResponse, band: EnergyBand): number {
  const minutesScore =
    band === 'low'
      ? step.estimated_minutes <= 5
        ? 0
        : step.estimated_minutes <= 10
          ? 1
          : 2
      : band === 'high'
        ? step.estimated_minutes >= 10
          ? 0
          : step.estimated_minutes >= 5
            ? 1
            : 2
        : 0;

  const difficultyScore =
    band === 'low'
      ? DIFFICULTY_ORDER[step.difficulty]
      : band === 'high'
        ? 2 - DIFFICULTY_ORDER[step.difficulty]
        : DIFFICULTY_ORDER[step.difficulty];

  return difficultyScore * 3 + minutesScore;
}

export type {StepFitContext} from './step-fit-score';
export {scoreStepsForDisplay} from './step-fit-score';

function buildFitContext(
  prefs: SchedulePrefs,
  energy: number | null | undefined,
  now: Date,
  weekSteps: DailyBabyStepResponse[] = [],
  fitOverrides?: Partial<StepFitContext>
): StepFitContext {
  const derived = deriveFitContextFromSteps(weekSteps);
  return {
    energy,
    now,
    wakeTime: prefs.wake_time,
    sleepTime: prefs.sleep_time,
    preferredActionWindow: 'flexible',
    ...derived,
    ...fitOverrides,
  };
}

/** Pending first, then fit score, then legacy energy/time tie-breakers. */
export function sortStepsForDisplay(
  steps: DailyBabyStepResponse[],
  prefs: SchedulePrefs,
  now = new Date(),
  energy?: number | null,
  weekSteps: DailyBabyStepResponse[] = [],
  fitOverrides?: Partial<StepFitContext>
): DailyBabyStepResponse[] {
  const band = deriveEnergyBand(energy);
  const fitCtx = buildFitContext(prefs, energy, now, weekSteps, fitOverrides);
  const suggestedTimes = assignSuggestedStepTimes(
    steps.length,
    prefs.wake_time,
    prefs.sleep_time,
    'flexible'
  );
  const indexById = new Map(steps.map((step, index) => [step.id, index]));
  const fitSorted = sortPendingByFit(
    steps.filter((step) => step.status === 'pending'),
    fitCtx
  );
  const fitRank = new Map(fitSorted.map((step, index) => [step.id, index]));

  return [...steps].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    if (a.status === 'pending' && b.status === 'pending') {
      const aFirst = isFirstWinStep(a);
      const bFirst = isFirstWinStep(b);
      if (aFirst !== bFirst) return aFirst ? -1 : 1;

      const rankA = fitRank.get(a.id) ?? 0;
      const rankB = fitRank.get(b.id) ?? 0;
      if (rankA !== rankB) return rankA - rankB;

      const energyDiff = energyFitScore(a, band) - energyFitScore(b, band);
      if (energyDiff !== 0) return energyDiff;

      const diffA = DIFFICULTY_ORDER[a.difficulty];
      const diffB = DIFFICULTY_ORDER[b.difficulty];
      if (diffA !== diffB) return diffA - diffB;

      const minutesDiff = a.estimated_minutes - b.estimated_minutes;
      if (minutesDiff !== 0) return minutesDiff;

      const idxA = indexById.get(a.id) ?? 0;
      const idxB = indexById.get(b.id) ?? 0;
      const windowA = timeWindowScore(suggestedTimes[idxA], now);
      const windowB = timeWindowScore(suggestedTimes[idxB], now);
      if (windowA !== windowB) return windowA - windowB;
    }

    return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
  });
}

/** Best pending step by composite fit score. */
export function pickStartHereStep(
  steps: DailyBabyStepResponse[],
  energy?: number | null,
  prefs?: SchedulePrefs,
  weekSteps: DailyBabyStepResponse[] = [],
  fitOverrides?: Partial<StepFitContext>
): DailyBabyStepResponse | null {
  const pending = steps.filter((step) => step.status === 'pending');
  if (pending.length === 0) return null;

  const firstWin = pending.find(isFirstWinStep);
  if (firstWin) return firstWin;

  if (prefs) {
    return pickRecommendedFirst(pending, buildFitContext(prefs, energy, new Date(), weekSteps, fitOverrides));
  }

  const band = deriveEnergyBand(energy);
  return [...pending].sort((a, b) => {
    const energyDiff = energyFitScore(a, band) - energyFitScore(b, band);
    if (energyDiff !== 0) return energyDiff;
    const diffA = DIFFICULTY_ORDER[a.difficulty];
    const diffB = DIFFICULTY_ORDER[b.difficulty];
    if (diffA !== diffB) return diffA - diffB;
    return a.estimated_minutes - b.estimated_minutes;
  })[0];
}
