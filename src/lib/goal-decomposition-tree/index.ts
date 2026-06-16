export type {
  GoalDecompositionCoherenceMetrics,
} from './types';

export {
  resolveActiveMilestone,
} from './resolve-active-milestone';
export {
  pickWeeklyThemeForDate,
} from './weekly-focus-fallback';
export {
  ensureWeeklyFocusesForGoals,
  refreshWeeklyFocusesFromReview,
} from './ensure-weekly-focus';
export {
  computeGoalDecompositionCoherence,
} from './coherence-metrics';
export {
  attachWeeklyFocusToSteps,
  weeklyThemesByGoalId,
} from './attach-weekly-focus';
