import type {AppLocale} from '@/i18n/config';
import {formatAnchorPrefix} from '@/lib/ai-life-coach/health-goal-fallback';
import type {
  DailyBabyStep,
  DailyReflection,
  Goal,
  HealthGoalContext,
  HealthPlanPhase,
  Milestone,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';
import {buildDefaultPlanB} from '@/lib/life-coach/plan-b';
import {
  buildStepReasoningFallback,
  buildStepReasoningContext,
  clampStepReasoning,
  type StepReasoningContext,
} from '@/lib/life-coach/step-reasoning';

const MAX_PLAN_DAY = 90;

export function goalDayIndex(goalCreatedAt: string, scheduledDate: string): number {
  const start = new Date(goalCreatedAt.slice(0, 10));
  const target = new Date(scheduledDate);
  const diffMs = target.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(days, 1), MAX_PLAN_DAY);
}

export function findPhaseForDay(
  plan: HealthGoalContext['execution_plan'],
  dayIndex: number
): HealthPlanPhase | null {
  if (!plan?.phases?.length) return null;
  return (
    plan.phases.find((phase) => dayIndex >= phase.start_day && dayIndex <= phase.end_day) ??
    plan.phases[plan.phases.length - 1] ??
    null
  );
}

function consecutiveSkipsForGoal(recentSteps: DailyBabyStep[], goalId: string): number {
  let count = 0;
  for (const step of recentSteps) {
    if (step.goal_id !== goalId) continue;
    if (step.status === 'skipped') {
      count += 1;
    } else if (step.status === 'completed' || step.status === 'partial') {
      break;
    }
  }
  return count;
}

function milestoneWeighInDue(milestones: Milestone[], scheduledDate: string): boolean {
  const target = new Date(scheduledDate);
  return milestones.some((milestone) => {
    if (!milestone.target_date) return false;
    const md = new Date(milestone.target_date);
    const diff = Math.abs(md.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3;
  });
}

export function resolveDailyStepFromPlan(input: {
  goal: Goal;
  milestones: Milestone[];
  scheduledDate: string;
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  locale: AppLocale;
}): Omit<StructuredDailyBabyStep, 'goal_id'> | null {
  const ctx = input.goal.health_context;
  if (!ctx?.execution_plan?.phases?.length) {
    return null;
  }

  const dayIndex = goalDayIndex(input.goal.created_at, input.scheduledDate);
  const phase = findPhaseForDay(ctx.execution_plan, dayIndex);
  if (!phase?.task_templates?.length) return null;

  const skips = consecutiveSkipsForGoal(input.recentSteps, input.goal.id);
  const templates = [...phase.task_templates].sort((a, b) => {
    if (skips >= 2) {
      const order = {easy: 0, medium: 1, hard: 2};
      return order[a.difficulty] - order[b.difficulty];
    }
    return 0;
  });

  const dayOfWeek = new Date(input.scheduledDate).getDay();
  const byDow = templates.find((t) => t.day_of_week === dayOfWeek);
  const template = byDow ?? templates[dayIndex % templates.length];
  const anchorPrefix = formatAnchorPrefix(ctx.anchor, input.locale);

  const weighIn =
    phase.weigh_in ||
    milestoneWeighInDue(input.milestones, input.scheduledDate) ||
    ctx.category === 'weight';

  let title = template.title;
  let description = template.description;
  let estimated_minutes = template.estimated_minutes;
  let difficulty = template.difficulty;

  if (weighIn && (dayIndex % 7 === 0 || milestoneWeighInDue(input.milestones, input.scheduledDate))) {
    title =
      input.locale === 'he'
        ? 'שקילה בבוקר + רישום במחברת'
        : 'Morning weigh-in + log in notebook';
    description =
      input.locale === 'he'
        ? '2 דקות — רק מדידה, בלי שיפוט'
        : '2 minutes — measure only, no judgment';
    estimated_minutes = 5;
    difficulty = 'easy';
  }

  if (skips >= 2) {
    estimated_minutes = Math.min(estimated_minutes, 5);
    difficulty = 'easy';
  }

  const yesterday = input.recentReflections[0];
  if (yesterday?.blocker_reason === 'no_time') {
    estimated_minutes = Math.min(estimated_minutes, 5);
  }
  if (yesterday?.blocker_reason === 'low_energy') {
    estimated_minutes = Math.min(estimated_minutes, 8);
    difficulty = 'easy';
  }

  const reasoningCtx: StepReasoningContext = {
    ...buildStepReasoningContext({
      locale: input.locale,
      date: input.scheduledDate,
      reflections: input.recentReflections,
      consecutive_skips: skips,
    }),
    weekly_theme: phase.focus,
  };
  const reasoning =
    clampStepReasoning(
      buildStepReasoningFallback(reasoningCtx, {estimated_minutes, difficulty})
    ) ?? undefined;

  const main = {
    domain: 'health' as const,
    title: `${anchorPrefix}, ${title}`.slice(0, 180),
    description: description || (input.locale === 'he' ? 'צעד קטן מהתוכנית שלך' : 'A small step from your plan'),
    estimated_minutes: Math.max(2, Math.min(estimated_minutes, 20)),
    difficulty,
    reasoning,
  };

  return {
    ...main,
    ...buildDefaultPlanB(main, input.locale),
  };
}

export function getCurrentPhaseSummary(
  ctx: HealthGoalContext | null | undefined,
  goalCreatedAt: string,
  scheduledDate: string
): {weekLabel: string; focus: string; dayIndex: number} | null {
  if (!ctx?.execution_plan) return null;

  const dayIndex = goalDayIndex(goalCreatedAt, scheduledDate);
  const phase = findPhaseForDay(ctx.execution_plan, dayIndex);
  if (!phase) return null;

  const weekNumber = Math.ceil(dayIndex / 7);
  return {
    dayIndex,
    weekLabel: String(weekNumber),
    focus: phase.focus,
  };
}
