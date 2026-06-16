import type {
  DailyBabyStep,
  LifeDomain,
  ReflectionBlockerReason,
} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export type ShortTermContext = {
  window_days: 7;
  period_start: string;
  period_end: string;
  completion_rate: number;
  completed: number;
  skipped: number;
  partial: number;
  pending_today: number;
  recent_blockers: Array<{reason: ReflectionBlockerReason; count: number}>;
  latest_energy: number | null;
  latest_mood: number | null;
  domain_scores: Array<{domain: LifeDomain; score: number}>;
  completed_easy: number;
  skipped_hard: number;
  worst_blocker: ReflectionBlockerReason | null;
};

export type StepPatternStat = {
  difficulty: DailyBabyStep['difficulty'];
  domain: LifeDomain;
  total: number;
  completed: number;
  skipped: number;
  completion_rate: number;
};

export type LongTermProfile = {
  window_days: 30;
  sample_size: number;
  overall_completion_rate: number;
  best_action_window: PreferredActionWindow;
  action_window_stats: Array<{window: PreferredActionWindow; completed: number; rate: number}>;
  winning_patterns: StepPatternStat[];
  losing_patterns: StepPatternStat[];
  successful_domains: LifeDomain[];
  struggling_domains: LifeDomain[];
  avg_successful_minutes: number | null;
  recovery_rate: number;
  avoid: string[];
};
