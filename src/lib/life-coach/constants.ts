/**
 * Value constants for the life-coach domain, kept in a zero-import leaf so they
 * can be imported without pulling in the large `types.ts` graph. `types.ts`
 * re-exports them (and derives its union types from them) for backward
 * compatibility, so existing `@/lib/life-coach/types` imports keep working.
 */

export const LIFE_DOMAINS = [
  'health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family',
] as const;

export const AVAILABLE_TIME_OPTIONS = [5, 10, 20, 30] as const;

export const INTENSITY_PREFERENCES = ['gentle', 'balanced', 'intense'] as const;

export const GOAL_STATUSES = ['active', 'completed', 'paused', 'archived'] as const;

export const GOAL_CREATED_BY = ['user', 'ai'] as const;

export const MILESTONE_STATUSES = ['pending', 'completed'] as const;

export const DAILY_STEP_STATUSES = ['pending', 'completed', 'skipped', 'partial'] as const;

export const DAILY_STEP_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const REFLECTION_BLOCKER_REASONS = [
  'no_time', 'forgot', 'low_energy', 'unclear_task', 'emotional_resistance', 'family_chaos', 'other',
] as const;

/** Post-completion value check — did the step actually help? */
export const STEP_VALUE_FEEDBACK_OPTIONS = [
  'felt_progress',
  'too_small',
  'too_generic',
  'missed_problem',
] as const;

export const INSIGHT_TYPES = ['pattern', 'recommendation', 'weekly_review'] as const;

export const DOMAIN_BLOCKERS = [
  'low_energy', 'kids', 'no_time', 'money_pressure', 'lack_of_clarity', 'self_doubt', 'environment', 'consistency',
] as const;

export const FORMULATION_SESSION_STATUSES = [
  'draft',
  'completed',
  'abandoned',
  'crisis_stopped',
  'skipped_after_consent',
] as const;

export const FORMULATION_PHASES = [
  'consent',
  'risk',
  'open',
  'dimensions',
  'exploration',
  'formulation',
  'goal',
  'complete',
] as const;

export const LIFE_CONTEXT_STATUSES = [
  'student',
  'new_parent',
  'manager',
  'caregiver',
  'between_jobs',
  'other',
  'prefer_not',
] as const;

export const RISK_LEVELS = ['none', 'elevated', 'crisis'] as const;

export const RISK_ACTIONS = ['continue', 'resources', 'stop'] as const;
