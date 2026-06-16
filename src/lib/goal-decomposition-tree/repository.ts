import {randomUUID} from 'crypto';
import {dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonArrayOr} from '@/lib/safe-json';
import type {WeeklyGoalFocus, WeeklyGoalFocusSource} from './types';

function rowToWeeklyFocus(row: Record<string, unknown>): WeeklyGoalFocus {
  const weekly_themes = parseJsonArrayOr<string>(row.weekly_themes_json);

  const marker = row.active_day_marker as number | null;
  const active_day_marker =
    marker === 30 || marker === 60 || marker === 90 ? marker : null;

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    goal_id: row.goal_id as string,
    domain: row.domain as WeeklyGoalFocus['domain'],
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    active_milestone_id: (row.active_milestone_id as string) ?? null,
    active_day_marker,
    focus_title: row.focus_title as string,
    focus_description: (row.focus_description as string) ?? '',
    weekly_themes,
    progress_cue: (row.progress_cue as string) ?? '',
    source: (row.source as WeeklyGoalFocusSource) ?? 'fallback',
    created_at: row.created_at as string,
  };
}

export function getWeeklyFocusForGoal(
  userId: string,
  goalId: string,
  weekStart: string
): WeeklyGoalFocus | null {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM weekly_goal_focus
     WHERE user_id = ? AND goal_id = ? AND week_start = ?`,
    [userId, goalId, weekStart]
  );
  return row ? rowToWeeklyFocus(row) : null;
}

export function listWeeklyFocusesSince(
  userId: string,
  sinceDate: string
): WeeklyGoalFocus[] {
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM weekly_goal_focus
     WHERE user_id = ? AND week_end >= ?
     ORDER BY week_start ASC`,
    [userId, sinceDate]
  );
  return rows.map(rowToWeeklyFocus);
}

export function upsertWeeklyGoalFocus(
  userId: string,
  focus: Omit<WeeklyGoalFocus, 'id' | 'user_id' | 'created_at'> & {id?: string}
): WeeklyGoalFocus {
  const existing = getWeeklyFocusForGoal(userId, focus.goal_id, focus.week_start);
  const id = existing?.id ?? focus.id ?? randomUUID();
  const now = new Date().toISOString();

  dbRun(
    `INSERT OR REPLACE INTO weekly_goal_focus
      (id, user_id, goal_id, domain, week_start, week_end,
       active_milestone_id, active_day_marker, focus_title, focus_description,
       weekly_themes_json, progress_cue, source, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      focus.goal_id,
      focus.domain,
      focus.week_start,
      focus.week_end,
      focus.active_milestone_id,
      focus.active_day_marker,
      focus.focus_title,
      focus.focus_description,
      JSON.stringify(focus.weekly_themes),
      focus.progress_cue,
      focus.source,
      existing?.created_at ?? now,
    ]
  );

  return getWeeklyFocusForGoal(userId, focus.goal_id, focus.week_start)!;
}
