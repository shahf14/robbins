import type {LifeDomain} from '@/lib/life-coach/types';

export type WeeklyGoalFocusSource = 'ai' | 'fallback' | 'weekly_review';

export type WeeklyGoalFocus = {
  id: string;
  user_id: string;
  goal_id: string;
  domain: LifeDomain;
  week_start: string;
  week_end: string;
  active_milestone_id: string | null;
  active_day_marker: 30 | 60 | 90 | null;
  focus_title: string;
  focus_description: string;
  weekly_themes: string[];
  progress_cue: string;
  source: WeeklyGoalFocusSource;
  created_at: string;
};

export type ActiveMilestoneContext = {
  day_index: number;
  day_marker: 30 | 60 | 90 | null;
  milestone_id: string | null;
  milestone_title: string | null;
};

export type GoalDecompositionCoherenceMetrics = {
  weeks_with_focus: number;
  days_with_steps: number;
  days_coherent: number;
  day_coherence_rate: number;
  goal_linked_step_rate: number;
  milestone_progress_days: number;
};
