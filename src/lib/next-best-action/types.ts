export const NEXT_BEST_ACTION_TYPES = [
  'open_life_coach',
  'open_coach',
  'open_morning_ritual',
  'complete_daily_step',
  'generate_daily_steps',
  'save_goal',
  'shrink_tomorrow',
  'change_time',
  'plan_b',
] as const;

export type NextBestActionType = (typeof NEXT_BEST_ACTION_TYPES)[number];

export type NextBestAction = {
  label: string;
  action_type: NextBestActionType;
  target_id?: string;
  estimated_minutes?: number;
};
