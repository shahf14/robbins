import type {z} from 'zod';
import type {goalBundleCreateInputSchema} from '@/lib/life-coach/schemas';

type GoalBundleInput = z.infer<typeof goalBundleCreateInputSchema>;

const DEFAULT_STEP_DESCRIPTION = 'Small clear step from your health plan.';
const STEP_MIN_MINUTES = 5;
const STEP_MAX_MINUTES = 20;

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function truncate(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function sanitizeGoalBundleInput(input: GoalBundleInput): GoalBundleInput {
  return {
    idempotency_key: input.idempotency_key,
    goal: {
      ...input.goal,
      title: truncate(input.goal.title, 140),
      description: truncate(input.goal.description || DEFAULT_STEP_DESCRIPTION, 4000),
      success_metric: truncate(input.goal.success_metric, 280),
    },
    milestones: input.milestones.map((milestone) => ({
      ...milestone,
      title: truncate(milestone.title, 140),
      description: truncate(milestone.description ?? '', 1000),
    })),
    initial_steps: input.initial_steps.map((step) => ({
      ...step,
      domain: step.domain,
      title: truncate(step.title, 180),
      description: truncate(step.description || DEFAULT_STEP_DESCRIPTION, 1000),
      estimated_minutes: clampInt(step.estimated_minutes, STEP_MIN_MINUTES, STEP_MAX_MINUTES),
    })),
  };
}

export function formatGoalCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('health_context') && message.includes('column')) {
    return 'Database is missing health_context on goals. Apply the local SQLite schema update.';
  }

  return message;
}
