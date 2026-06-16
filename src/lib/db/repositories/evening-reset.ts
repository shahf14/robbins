import {dbAll, dbGet, dbRun} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import {dateToYMD} from '@/lib/date-utils';

type EveningRow = {
  id: string;
  date: string;
  completed: number;
  duration_sec: number | null;
  session_json: string | null;
};

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

export function listEveningResetSessions(userId: string, limit = 60): EveningResetSession[] {
  const rows = dbAll<EveningRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM evening_resets
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?`,
    [userId, limit]
  );
  return rows.map(rowToSession).filter((s): s is EveningResetSession => s !== null);
}

export function saveEveningResetSession(userId: string, session: EveningResetSession): void {
  const existing = dbGet<{user_id: string | null}>(
    `SELECT user_id FROM evening_resets WHERE id = ?`,
    [session.id]
  );
  if (existing && existing.user_id !== userId) {
    throw new Error(`Evening reset ${session.id} is owned by another user`);
  }

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
