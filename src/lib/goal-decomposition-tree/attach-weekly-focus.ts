import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {WeeklyGoalFocus} from './types';

/** Stamp weekly_focus_id on generated steps (reasoning finalized separately). */
export function attachWeeklyFocusToSteps(
  steps: StructuredDailyBabyStep[],
  weeklyFocusByGoalId: Record<string, WeeklyGoalFocus>,
  _date: string,
  _pickTheme: (themes: string[], d: string) => string
): StructuredDailyBabyStep[] {
  return steps.map((step) => {
    if (!step.goal_id) return step;
    const focus = weeklyFocusByGoalId[step.goal_id];
    if (!focus) return step;
    return {...step, weekly_focus_id: focus.id};
  });
}

/** Map goal_id → today's weekly theme for reasoning fallback. */
export function weeklyThemesByGoalId(
  weeklyFocusByGoalId: Record<string, WeeklyGoalFocus>,
  date: string,
  pickTheme: (themes: string[], d: string) => string
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [goalId, focus] of Object.entries(weeklyFocusByGoalId)) {
    out[goalId] = pickTheme(focus.weekly_themes, date) || focus.focus_title;
  }
  return out;
}
