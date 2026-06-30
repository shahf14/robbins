import {assignSuggestedStepTimes, parseTimeToMinutes} from '@/lib/schedule-content';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {DailyBabyStepResponse} from './response-dtos';
import type {LifeDomain, ReflectionBlockerReason} from './types';
import {deriveEnergyBand} from './step-priority';

type StepFitBreakdown = {
  fit_score: number;
  energy_fit: number;
  time_fit: number;
  difficulty_risk: number;
  blocker_risk: number;
};

export type StepFitContext = {
  energy?: number | null;
  avgActualMinutes?: number | null;
  commonBlockers?: ReflectionBlockerReason[];
  preferredDomains?: LifeDomain[];
  wakeTime?: string;
  sleepTime?: string;
  preferredActionWindow?: PreferredActionWindow;
  now?: Date;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function timeWindowFit(suggestedTime: string | undefined, now: Date): number {
  if (!suggestedTime) return 0.55;
  const current = now.getHours() * 60 + now.getMinutes();
  const target = parseTimeToMinutes(suggestedTime);
  const delta = Math.abs(current - target);
  if (delta <= 45) return 1;
  if (delta <= 120) return 0.65;
  return 0.35;
}

/** Higher = better time match for this user right now. */
function computeTimeFit(
  step: DailyBabyStepResponse,
  ctx: StepFitContext,
  suggestedTime?: string
): number {
  const avg = ctx.avgActualMinutes;
  if (avg != null && avg > 0) {
    const budget = avg + 3;
    if (step.estimated_minutes <= budget) return 1;
    const over = step.estimated_minutes - budget;
    return clamp01(1 - over / 15);
  }
  return timeWindowFit(suggestedTime, ctx.now ?? new Date());
}

/** Higher = better match for current energy. */
function computeEnergyFit(step: DailyBabyStepResponse, energy: number | null | undefined): number {
  const band = deriveEnergyBand(energy);
  if (band === 'low') {
    if (step.difficulty === 'easy' && step.estimated_minutes <= 10) return 1;
    if (step.difficulty === 'easy') return 0.8;
    if (step.difficulty === 'medium') return 0.4;
    return 0.15;
  }
  if (band === 'high') {
    if (step.difficulty === 'hard') return 0.9;
    if (step.difficulty === 'medium') return 0.75;
    return 0.6;
  }
  if (step.difficulty === 'easy') return 0.85;
  if (step.difficulty === 'medium') return 0.7;
  return 0.5;
}

/** Higher = more likely the step is too hard to finish. */
function computeDifficultyRisk(step: DailyBabyStepResponse): number {
  const base =
    step.difficulty === 'easy' ? 0.2 : step.difficulty === 'medium' ? 0.5 : 0.85;
  const minuteBoost =
    step.estimated_minutes > 15 ? 0.15 : step.estimated_minutes > 10 ? 0.08 : 0;
  return clamp01(base + minuteBoost);
}

/** Higher = more likely past blockers repeat on this step. */
function computeBlockerRisk(
  step: DailyBabyStepResponse,
  commonBlockers: ReflectionBlockerReason[],
  preferredDomains: LifeDomain[]
): number {
  let risk = 0.2;
  if (commonBlockers.includes('no_time') && step.estimated_minutes > 10) risk += 0.35;
  if (commonBlockers.includes('low_energy') && step.difficulty !== 'easy') risk += 0.3;
  if (commonBlockers.includes('unclear_task')) risk += 0.2;
  if (commonBlockers.includes('family_chaos') && step.estimated_minutes > 5) risk += 0.25;
  if (commonBlockers.includes('emotional_resistance') && step.difficulty === 'hard') risk += 0.2;
  if ((step.reschedule_count ?? 0) >= 2) risk += 0.2;
  if (
    preferredDomains.length > 0 &&
    !preferredDomains.includes(step.domain)
  ) {
    risk += 0.1;
  }
  return clamp01(risk);
}

export function computeStepFit(
  step: DailyBabyStepResponse,
  ctx: StepFitContext,
  suggestedTime?: string
): StepFitBreakdown {
  const energy_fit = computeEnergyFit(step, ctx.energy);
  const time_fit = computeTimeFit(step, ctx, suggestedTime);
  const difficulty_risk = computeDifficultyRisk(step);
  const blocker_risk = computeBlockerRisk(
    step,
    ctx.commonBlockers ?? [],
    ctx.preferredDomains ?? []
  );

  const fit =
    0.3 * time_fit +
    0.3 * energy_fit +
    0.2 * (1 - difficulty_risk) +
    0.2 * (1 - blocker_risk);

  return {
    fit_score: Math.round(clamp01(fit) * 100),
    energy_fit: Math.round(energy_fit * 100),
    time_fit: Math.round(time_fit * 100),
    difficulty_risk: Math.round(difficulty_risk * 100),
    blocker_risk: Math.round(blocker_risk * 100),
  };
}

export function deriveFitContextFromSteps(
  weekSteps: DailyBabyStepResponse[]
): Pick<StepFitContext, 'avgActualMinutes' | 'commonBlockers' | 'preferredDomains'> {
  const completed = weekSteps.filter(
    (s) => s.status === 'completed' && s.actual_minutes != null
  );
  const avgActualMinutes =
    completed.length > 0
      ? Math.round(
          (completed.reduce((sum, s) => sum + (s.actual_minutes ?? 0), 0) / completed.length) * 10
        ) / 10
      : null;

  const blockerCounts = new Map<string, number>();
  for (const s of weekSteps) {
    if (s.blocker_reason) {
      blockerCounts.set(s.blocker_reason, (blockerCounts.get(s.blocker_reason) ?? 0) + 1);
    }
  }
  const commonBlockers = [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key as ReflectionBlockerReason);

  const domainCounts = new Map<LifeDomain, number>();
  for (const s of weekSteps) {
    if (s.status === 'completed' || s.status === 'partial') {
      domainCounts.set(s.domain, (domainCounts.get(s.domain) ?? 0) + 1);
    }
  }
  const preferredDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  return {avgActualMinutes, commonBlockers, preferredDomains};
}

export function scoreStepsForDisplay(
  steps: DailyBabyStepResponse[],
  ctx: StepFitContext
): Map<string, StepFitBreakdown> {
  const wake = ctx.wakeTime ?? '07:00';
  const sleep = ctx.sleepTime ?? '22:30';
  const window = ctx.preferredActionWindow ?? 'flexible';
  const suggestedTimes = assignSuggestedStepTimes(
    steps.length,
    wake,
    sleep,
    window
  );
  const indexById = new Map(steps.map((s, i) => [s.id, i]));
  const scores = new Map<string, StepFitBreakdown>();

  for (const step of steps) {
    const idx = indexById.get(step.id) ?? 0;
    scores.set(step.id, computeStepFit(step, ctx, suggestedTimes[idx]));
  }
  return scores;
}

export function pickRecommendedFirst(
  steps: DailyBabyStepResponse[],
  ctx: StepFitContext
): DailyBabyStepResponse | null {
  const pending = steps.filter((s) => s.status === 'pending');
  if (pending.length === 0) return null;
  const scores = scoreStepsForDisplay(pending, ctx);
  return [...pending].sort(
    (a, b) => (scores.get(b.id)?.fit_score ?? 0) - (scores.get(a.id)?.fit_score ?? 0)
  )[0];
}

export function sortPendingByFit(
  pendingSteps: DailyBabyStepResponse[],
  ctx: StepFitContext
): DailyBabyStepResponse[] {
  const scores = scoreStepsForDisplay(pendingSteps, ctx);
  return [...pendingSteps].sort((a, b) => {
    const fitDiff = (scores.get(b.id)?.fit_score ?? 0) - (scores.get(a.id)?.fit_score ?? 0);
    if (fitDiff !== 0) return fitDiff;
    return a.estimated_minutes - b.estimated_minutes;
  });
}
