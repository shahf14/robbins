import {addDaysYMD} from '@/lib/date-utils';
import type {AppLocale} from '@/i18n/config';
import {getDb} from '@/lib/db/sqlite';
import {insertAiInsightRow} from '@/lib/life-coach/reflection-insight-repository';
import {assertWeeklyReviewPersistable} from '@/lib/life-coach/validate-weekly-review-payload';
import type {
  AiCoachingInsight,
  Goal,
  Milestone,
  WeeklyReview,
} from '@/lib/life-coach/types';
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

/** Persist weekly review insight and refresh goal focuses atomically. */
export function persistWeeklyReviewWithFocusRefresh(
  userId: string,
  input: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>,
  focus: {
    goals: Goal[];
    milestonesByGoalId: Record<string, Milestone[]>;
    review: WeeklyReview;
    periodEnd: string;
    locale: AppLocale;
  }
): AiCoachingInsight {
  const validatedReview = assertWeeklyReviewPersistable(focus.review);
  return getDb().transaction(() => {
    const insight = insertAiInsightRow(userId, input);
    refreshWeeklyFocusesFromReview(
      userId,
      focus.goals,
      focus.milestonesByGoalId,
      {...focus.review, ...validatedReview},
      focus.periodEnd,
      focus.locale
    );
    return insight;
  })();
}
