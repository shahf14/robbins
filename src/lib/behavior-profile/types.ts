import type {LifeDomain, ReflectionBlockerReason} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export type WindowSkipPattern = {
  window: PreferredActionWindow;
  skip_rate: number;
  completion_rate: number;
  sample_size: number;
};

export type WeekdaySkipPattern = {
  weekday: number;
  skip_rate: number;
  completion_rate: number;
  sample_size: number;
};

export type FailedActionPatternKind =
  | 'duration_too_long'
  | 'evening_tasks'
  | 'vague_reflection'
  | 'hard_difficulty';

export type FailedActionPattern = {
  kind: FailedActionPatternKind;
  failure_count: number;
  sample_size: number;
  skip_rate: number | null;
  recommendation: string;
};

export type UserBehaviorProfile = {
  user_id: string;
  best_action_window: PreferredActionWindow;
  avoid_windows: PreferredActionWindow[];
  best_windows: PreferredActionWindow[];
  weekday_skip_patterns: WeekdaySkipPattern[];
  avg_completion_rate_7d: number;
  avg_actual_minutes: number | null;
  common_blockers: ReflectionBlockerReason[];
  preferred_domains: LifeDomain[];
  low_energy_frequency: number;
  recovery_rate: number;
  failed_action_patterns: FailedActionPattern[];
  sample_size_7d: number;
  updated_at: string;
};

export const EMPTY_BEHAVIOR_PROFILE = (
  userId: string,
  fallbackWindow: PreferredActionWindow = 'flexible'
): UserBehaviorProfile => ({
  user_id: userId,
  best_action_window: fallbackWindow,
  avoid_windows: [],
  best_windows: [],
  weekday_skip_patterns: [],
  avg_completion_rate_7d: 0,
  avg_actual_minutes: null,
  common_blockers: [],
  preferred_domains: [],
  low_energy_frequency: 0,
  recovery_rate: 0,
  failed_action_patterns: [],
  sample_size_7d: 0,
  updated_at: new Date().toISOString(),
});
