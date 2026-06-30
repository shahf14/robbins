import {dbAll, dbGet, dbRun} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import {assertRitualNotUncompleted} from '@/lib/ritual-session-guards';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import {dateToYMD} from '@/lib/date-utils';

export const DEFAULT_RITUAL_SESSION_LIMIT = 60;
export const MAX_RITUAL_SESSION_LIMIT = 400;

type EveningRow = {
  id: string;
  date: string;
  completed: number;
  duration_sec: number | null;
  session_json: string | null;
};

type RitualListOptions = {limit?: number; offset?: number};

function resolveRitualPagination(limitOrOptions?: number | RitualListOptions) {
  if (typeof limitOrOptions === 'number') {
    return {
      limit: Math.min(Math.max(limitOrOptions, 1), MAX_RITUAL_SESSION_LIMIT),
      offset: 0,
    };
  }
  const limit = Math.min(
    Math.max(limitOrOptions?.limit ?? DEFAULT_RITUAL_SESSION_LIMIT, 1),
    MAX_RITUAL_SESSION_LIMIT
  );
  const offset = Math.min(Math.max(limitOrOptions?.offset ?? 0, 0), 10_000);
  return {limit, offset};
}

function rowToSession(row: EveningRow): EveningResetSession | null {
  if (!row.session_json) return null;
  return parseJsonOr<EveningResetSession | null>(row.session_json, null);
}

export function getCompletedEveningResetForDate(
  userId: string,
  date: string
): EveningResetSession | null {
  const row = dbGet<EveningRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM evening_resets
      WHERE user_id = ? AND date = ? AND completed = 1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, date]
  );
  if (!row) return null;
  return rowToSession(row);
}

export function countEveningResetSessions(userId: string): number {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM evening_resets WHERE user_id = ?`,
    [userId]
  );
  return row?.count ?? 0;
}

export function listEveningResetSessions(
  userId: string,
  limitOrOptions?: number | RitualListOptions
): EveningResetSession[] {
  const {limit, offset} = resolveRitualPagination(limitOrOptions);
  const rows = dbAll<EveningRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM evening_resets
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  return rows.map(rowToSession).filter((s): s is EveningResetSession => s !== null);
}

export function getEveningResetSessionById(
  userId: string,
  sessionId: string
): EveningResetSession | null {
  const row = dbGet<EveningRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM evening_resets
      WHERE user_id = ? AND id = ?
      LIMIT 1`,
    [userId, sessionId]
  );
  if (!row) return null;
  return rowToSession(row);
}

export function saveEveningResetSession(userId: string, session: EveningResetSession): void {
  const existing = dbGet<{user_id: string | null; completed: number}>(
    `SELECT user_id, completed FROM evening_resets WHERE id = ?`,
    [session.id]
  );
  if (existing && existing.user_id !== userId) {
    throw new Error(`Evening reset ${session.id} is owned by another user`);
  }
  assertRitualNotUncompleted(existing?.completed === 1, session.completed);

  const date = dateToYMD(new Date(session.completedAt ?? session.startedAt ?? Date.now()));

  dbRun(
    `INSERT OR REPLACE INTO evening_resets
       (id, user_id, date, duration_sec, completed, mode,
        readiness_score, tomorrows_win, emotional_dump_word_count,
        blocker_mentioned, skipped_steps,
        tomorrow_constraint, what_worked, what_failed, energy_forecast,
        tomorrow_takeaway,
        session_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?,
       ?,
       COALESCE((SELECT created_at FROM evening_resets WHERE id = ?), datetime('now')))`,
    [
      session.id,
      userId,
      date,
      session.durationSeconds ?? 0,
      session.completed ? 1 : 0,
      session.mode,
      session.readinessScore ?? 0,
      session.tomorrowsWin ?? null,
      session.emotionalDumpWordCount ?? null,
      session.blockerMentioned ? 1 : 0,
      JSON.stringify(session.skippedSteps ?? []),
      session.tomorrow_constraint ?? null,
      session.what_worked ?? null,
      session.what_failed ?? null,
      session.energy_forecast ?? null,
      session.tomorrow_takeaway ?? null,
      JSON.stringify(session),
      session.id,
    ]
  );
}
