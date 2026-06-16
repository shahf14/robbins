import type {ReflectionBlockerReason} from '@/lib/life-coach/types';

export type BlockerAdjustment =
  | 'reduce_task_count'
  | 'shorten_steps'
  | 'clarify_steps'
  | 'shift_to_best_window'
  | 'plan_b_first'
  | 'gentler_difficulty';

export type RecurringBlockerSeverity = 'medium' | 'high';

export type RecurringBlockerPattern = {
  blocker: ReflectionBlockerReason;
  count: number;
  severity: RecurringBlockerSeverity;
  suggested_adjustment: BlockerAdjustment;
};
