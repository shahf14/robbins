import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export const SKIP_COACH_ACTIONS = ['shrink_tomorrow', 'change_time', 'plan_b'] as const;
export type SkipCoachAction = (typeof SKIP_COACH_ACTIONS)[number];

export type SkipCoachAdjustmentPayload = {
  max_tasks: number;
  max_minutes_per_task: number;
  easy_only: boolean;
  prefer_plan_b: boolean;
  time_window?: PreferredActionWindow;
  summary: string;
  skip_classification?: 'known_barrier' | 'new_barrier';
  formulation_plan_b?: string | null;
  anticipated_barrier?: string | null;
  skipped_step_title?: string | null;
};

export type SkipCoachAdjustment = {
  id: string;
  user_id: string;
  skip_date: string;
  step_id: string | null;
  goal_id: string | null;
  blocker_reason: ReflectionBlockerReason | null;
  coach_action: SkipCoachAction;
  adjustment: SkipCoachAdjustmentPayload;
  applied_at: string | null;
  created_at: string;
};

export type SkipCoachRecoveryMetrics = {
  skip_events: number;
  adjustments_saved: number;
  recovery_next_day: number;
  recovery_rate: number;
};
