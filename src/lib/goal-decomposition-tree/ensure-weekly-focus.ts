import {addDaysYMD} from '@/lib/date-utils';
import type {AppLocale} from '@/i18n/config';
import type {Goal, Milestone, WeeklyReview} from '@/lib/life-coach/types';
import {upsertWeeklyGoalFocus, getWeeklyFocusForGoal} from './repository';
import {buildWeeklyFocusFallback} from './weekly-focus-fallback';
import {isoWeekWindow} from './week-window';
import type {WeeklyGoalFocus} from './types';

export function ensureWeeklyFocusesForGoals(
  userId: string,
  goals: Goal[],
  milestonesByGoalId: Record<string, Milestone[]>,
  date: string,
  locale: AppLocale
): Record<string, WeeklyGoalFocus> {
  const week = isoWeekWindow(date);
  const byGoalId: Record<string, WeeklyGoalFocus> = {};

  for (const goal of goals) {
    const existing = getWeeklyFocusForGoal(userId, goal.id, week.start);
    if (existing) {
      byGoalId[goal.id] = existing;
      continue;
    }

    const draft = buildWeeklyFocusFallback({
      goal,
      milestones: milestonesByGoalId[goal.id] ?? [],
      date,
      week_start: week.start,
      week_end: week.end,
      locale,
    });
    byGoalId[goal.id] = upsertWeeklyGoalFocus(userId, draft);
  }

  return byGoalId;
}

/** Refresh weekly focuses after weekly review — aligns progress_cue with review adjustment. */
export function refreshWeeklyFocusesFromReview(
  userId: string,
  goals: Goal[],
  milestonesByGoalId: Record<string, Milestone[]>,
  review: WeeklyReview,
  periodEnd: string,
  locale: AppLocale
): Record<string, WeeklyGoalFocus> {
  const nextWeekStart = addDaysYMD(periodEnd, 1);
  const week = isoWeekWindow(nextWeekStart);
  const byGoalId: Record<string, WeeklyGoalFocus> = {};

  for (const goal of goals) {
    const draft = buildWeeklyFocusFallback({
      goal,
      milestones: milestonesByGoalId[goal.id] ?? [],
      date: nextWeekStart,
      week_start: week.start,
      week_end: week.end,
      locale,
      source: 'weekly_review',
    });

    const progressCue = review.recommended_adjustment?.trim()
      ? `${draft.progress_cue} · ${review.recommended_adjustment}`
      : draft.progress_cue;

    byGoalId[goal.id] = upsertWeeklyGoalFocus(userId, {
      ...draft,
      progress_cue: progressCue,
      source: 'weekly_review',
    });
  }

  return byGoalId;
}
