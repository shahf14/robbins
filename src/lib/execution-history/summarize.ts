import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStep, DailyReflection, ReflectionBlockerReason} from '@/lib/life-coach/types';
import {
  computeStepContractQuality,
  type StepContractQualityMetrics,
} from '@/lib/life-coach/step-contract';
import {
  computeReflectionAdjustmentMetrics,
  type ReflectionAdjustmentMetrics,
} from '@/lib/reflection-analysis';
import {
  computeGoalDecompositionCoherence,
  type GoalDecompositionCoherenceMetrics,
} from '@/lib/goal-decomposition-tree';
import {
  computeStepExplainabilityMetrics,
  type StepExplainabilityMetrics,
} from '@/lib/life-coach/step-reasoning';
import {computeSkipCoachRecoveryMetrics} from '@/lib/skip-coach-loop/recovery-metrics';
import type {SkipCoachRecoveryMetrics} from '@/lib/skip-coach-loop';
import {
  computeStepValueFeedbackSummary,
  type StepValueFeedbackSummary,
} from '@/lib/step-value-feedback/summarize';

type DayRollup = {
  date: string;
  completed: number;
  skipped: number;
  partial: number;
  pending: number;
  top_blocker: ReflectionBlockerReason | null;
};

type StepHighlight = {
  date: string;
  title: string;
  status: DailyBabyStep['status'];
  difficulty: DailyBabyStep['difficulty'];
  minutes: number;
  blocker: ReflectionBlockerReason | null;
  domain: DailyBabyStep['domain'];
};

export type ExecutionHistorySummary = {
  window_days: number;
  total_steps: number;
  completed_easy: number;
  completed_medium: number;
  completed_hard: number;
  skipped_easy: number;
  skipped_medium: number;
  skipped_hard: number;
  partial_count: number;
  completion_rate: number;
  show_up_days: number;
  avg_actual_minutes: number | null;
  best_days: string[];
  worst_blocker: ReflectionBlockerReason | null;
  day_rollups: DayRollup[];
  step_highlights: StepHighlight[];
  step_contract_quality: StepContractQualityMetrics | null;
  reflection_adjustment: ReflectionAdjustmentMetrics | null;
  decomposition_coherence: GoalDecompositionCoherenceMetrics | null;
  step_explainability: StepExplainabilityMetrics | null;
  skip_coach_recovery: SkipCoachRecoveryMetrics | null;
  step_value_feedback: StepValueFeedbackSummary | null;
};

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function topBlockerForDay(
  daySteps: DailyBabyStep[],
  dayReflections: DailyReflection[]
): ReflectionBlockerReason | null {
  const counts = new Map<string, number>();
  for (const s of daySteps) {
    if (s.blocker_reason) counts.set(s.blocker_reason, (counts.get(s.blocker_reason) ?? 0) + 1);
  }
  for (const r of dayReflections) {
    if (r.blocker_reason) counts.set(r.blocker_reason, (counts.get(r.blocker_reason) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] as ReflectionBlockerReason | null ?? null;
}

function worstBlockerOverall(
  steps: DailyBabyStep[],
  reflections: DailyReflection[]
): ReflectionBlockerReason | null {
  const counts = new Map<string, number>();
  for (const s of steps) {
    if (s.blocker_reason) counts.set(s.blocker_reason, (counts.get(s.blocker_reason) ?? 0) + 1);
  }
  for (const r of reflections) {
    if (r.blocker_reason) counts.set(r.blocker_reason, (counts.get(r.blocker_reason) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] as ReflectionBlockerReason | null ?? null;
}

function buildStepHighlights(steps: DailyBabyStep[], limit = 10): StepHighlight[] {
  const notable = steps
    .filter((s) => s.status !== 'pending')
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  return notable.slice(0, limit).map((s) => ({
    date: s.scheduled_date,
    title: s.title.length > 90 ? `${s.title.slice(0, 87)}…` : s.title,
    status: s.status,
    difficulty: s.difficulty,
    minutes: s.actual_minutes ?? s.estimated_minutes,
    blocker: s.blocker_reason ?? null,
    domain: s.domain,
  }));
}

/**
 * Compact execution summary for AI prompts (7–14 day window).
 * Avoids sending full step dumps.
 */
export function computeExecutionHistorySummary(
  steps: DailyBabyStep[],
  reflections: DailyReflection[] = [],
  windowDays = 14,
  userId?: string
): ExecutionHistorySummary {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const windowSteps = steps.filter((s) => s.scheduled_date >= since);
  const windowReflections = reflections.filter((r) => r.date >= since);

  const completed_easy = windowSteps.filter(
    (s) => s.status === 'completed' && s.difficulty === 'easy'
  ).length;
  const completed_medium = windowSteps.filter(
    (s) => s.status === 'completed' && s.difficulty === 'medium'
  ).length;
  const completed_hard = windowSteps.filter(
    (s) => s.status === 'completed' && s.difficulty === 'hard'
  ).length;
  const skipped_easy = windowSteps.filter(
    (s) => s.status === 'skipped' && s.difficulty === 'easy'
  ).length;
  const skipped_medium = windowSteps.filter(
    (s) => s.status === 'skipped' && s.difficulty === 'medium'
  ).length;
  const skipped_hard = windowSteps.filter(
    (s) => s.status === 'skipped' && s.difficulty === 'hard'
  ).length;
  const partial_count = windowSteps.filter((s) => s.status === 'partial').length;

  const dates = [...new Set(windowSteps.map((s) => s.scheduled_date))].sort();
  const day_rollups: DayRollup[] = dates.map((date) => {
    const daySteps = windowSteps.filter((s) => s.scheduled_date === date);
    const dayReflections = windowReflections.filter((r) => r.date === date);
    return {
      date,
      completed: daySteps.filter((s) => s.status === 'completed').length,
      skipped: daySteps.filter((s) => s.status === 'skipped').length,
      partial: daySteps.filter((s) => s.status === 'partial').length,
      pending: daySteps.filter((s) => s.status === 'pending').length,
      top_blocker: topBlockerForDay(daySteps, dayReflections),
    };
  });

  const best_days = [...day_rollups]
    .map((d) => ({date: d.date, score: d.completed + d.partial}))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => d.date);

  const show_up_days = day_rollups.filter((d) => d.completed + d.partial > 0).length;
  const actionable = windowSteps.filter((s) => s.status !== 'pending').length;
  const completed_total = completed_easy + completed_medium + completed_hard + partial_count;
  const completion_rate =
    windowSteps.length > 0 ? Math.round((completed_total / windowSteps.length) * 100) / 100 : 0;

  const completedWithMinutes = windowSteps.filter(
    (s) => s.status === 'completed' && s.actual_minutes != null
  );
  const avg_actual_minutes =
    completedWithMinutes.length > 0
      ? Math.round(
          (completedWithMinutes.reduce((sum, s) => sum + (s.actual_minutes ?? 0), 0) /
            completedWithMinutes.length) *
            10
        ) / 10
      : null;

  return {
    window_days: windowDays,
    total_steps: windowSteps.length,
    completed_easy,
    completed_medium,
    completed_hard,
    skipped_easy,
    skipped_medium,
    skipped_hard,
    partial_count,
    completion_rate,
    show_up_days,
    avg_actual_minutes,
    best_days,
    worst_blocker: worstBlockerOverall(windowSteps, windowReflections),
    day_rollups: day_rollups.slice(-14),
    step_highlights: buildStepHighlights(windowSteps),
    step_contract_quality: computeStepContractQuality(windowSteps, windowDays),
    reflection_adjustment: userId
      ? computeReflectionAdjustmentMetrics(userId, windowDays)
      : null,
    decomposition_coherence: userId
      ? computeGoalDecompositionCoherence(userId, windowSteps, windowDays)
      : null,
    step_explainability: computeStepExplainabilityMetrics(windowSteps, windowDays),
    skip_coach_recovery: userId
      ? computeSkipCoachRecoveryMetrics(userId, windowSteps, windowDays)
      : null,
    step_value_feedback: computeStepValueFeedbackSummary(windowSteps, windowDays),
  };
}

/** Slim payload for AI — no raw step dump. */
export function executionHistoryForPrompt(
  summary: ExecutionHistorySummary | null | undefined
): Omit<ExecutionHistorySummary, 'completed_medium' | 'completed_hard' | 'skipped_medium' | 'skipped_easy' | 'total_steps'> & {
  completed_medium?: number;
  completed_hard?: number;
  skipped_medium?: number;
  skipped_easy?: number;
  total_steps?: number;
} | null {
  if (!summary || summary.total_steps === 0) return null;

  return {
    window_days: summary.window_days,
    completed_easy: summary.completed_easy,
    completed_medium: summary.completed_medium,
    completed_hard: summary.completed_hard,
    skipped_easy: summary.skipped_easy,
    skipped_medium: summary.skipped_medium,
    skipped_hard: summary.skipped_hard,
    partial_count: summary.partial_count,
    completion_rate: summary.completion_rate,
    show_up_days: summary.show_up_days,
    avg_actual_minutes: summary.avg_actual_minutes,
    best_days: summary.best_days,
    worst_blocker: summary.worst_blocker,
    day_rollups: summary.day_rollups,
    step_highlights: summary.step_highlights,
    step_contract_quality: summary.step_contract_quality,
    reflection_adjustment: summary.reflection_adjustment,
    decomposition_coherence: summary.decomposition_coherence,
    step_explainability: summary.step_explainability,
    skip_coach_recovery: summary.skip_coach_recovery,
    step_value_feedback: summary.step_value_feedback,
  };
}
