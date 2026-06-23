import type {AppLocale} from '@/i18n/config';
import type {Goal, Milestone} from '@/lib/life-coach/types';
import {resolveActiveMilestone} from './resolve-active-milestone';
import type {WeeklyGoalFocusSource} from './types';

export function buildWeeklyFocusFallback(input: {
  goal: Goal;
  milestones: Milestone[];
  date: string;
  week_start: string;
  week_end: string;
  locale: AppLocale;
  source?: WeeklyGoalFocusSource;
}): Omit<
  import('./types').WeeklyGoalFocus,
  'id' | 'user_id' | 'created_at'
> {
  const he = input.locale === 'he';
  const ctx = resolveActiveMilestone(input.goal, input.milestones, input.date);
  const milestone = input.milestones.find((m) => m.id === ctx.milestone_id) ?? null;
  const marker = ctx.day_marker;

  const focusTitle = milestone
    ? he
      ? `שבוע לכיוון יעד ${marker}: ${milestone.title}`
      : `Week toward ${marker}-day target: ${milestone.title}`
    : he
      ? `שבוע לכיוון: ${input.goal.title}`
      : `Week toward: ${input.goal.title}`;

  const focusDescription = milestone?.description?.trim()
    ? milestone.description
    : input.goal.description?.trim() || input.goal.success_metric;

  const weeklyThemes = buildWeeklyThemes(input.goal, milestone, he, marker);
  const progressCue = milestone
    ? he
      ? `כל צעד השבוע מקרב ליעד ${marker} יום: ${milestone.title}`
      : `Each step this week moves toward the ${marker}-day milestone: ${milestone.title}`
    : he
      ? `צעדים קטנים ועקביים מקרבים ל: ${input.goal.success_metric}`
      : `Small consistent steps advance: ${input.goal.success_metric}`;

  return {
    goal_id: input.goal.id,
    domain: input.goal.domain,
    week_start: input.week_start,
    week_end: input.week_end,
    active_milestone_id: ctx.milestone_id,
    active_day_marker: marker,
    focus_title: focusTitle,
    focus_description: focusDescription,
    weekly_themes: weeklyThemes,
    progress_cue: progressCue,
    source: input.source ?? 'fallback',
  };
}

function buildWeeklyThemes(
  goal: Goal,
  milestone: Milestone | null,
  he: boolean,
  marker: 30 | 60 | 90 | null
): string[] {
  if (milestone) {
    const base = milestone.title.replace(/\b(30|60|90)\b/g, '').trim() || goal.title;
    return he
      ? [`התחלה: ${base}`, `חיזוק: ${base}`, `סיכום שבועי ל${marker} יום`]
      : [`Start: ${base}`, `Build: ${base}`, `Week wrap for day ${marker}`];
  }

  return he
    ? [`צעד ראשון ל${goal.title}`, `חיזוק הרגל`, `בדיקת התקדמות`]
    : [`First move on ${goal.title}`, `Habit reinforcement`, `Progress check`];
}

/** Rotate weekly theme by day-of-week for daily step anchoring. */
export function pickWeeklyThemeForDate(themes: string[], date: string): string {
  if (themes.length === 0) return '';
  const d = new Date(`${date}T12:00:00`);
  return themes[d.getDay() % themes.length];
}
