import {dateToYMD} from '@/lib/date-utils';
import {dbAll, dbGet, dbRun, getDb} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';

type RitualRow = {
  id: string;
  date: string;
  completed: number;
  duration_sec: number | null;
  session_json: string | null;
};

function rowToSession(row: RitualRow): MorningRitualSession | null {
  if (!row.session_json) return null;
  return parseJsonOr<MorningRitualSession | null>(row.session_json, null);
}

/** List a user's morning ritual sessions, newest first. */
export function listMorningRitualSessions(userId: string, limit = 60): MorningRitualSession[] {
  const rows = dbAll<RitualRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM morning_rituals
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?`,
    [userId, limit]
  );
  return rows.map(rowToSession).filter((s): s is MorningRitualSession => s !== null);
}

/** Latest completed morning ritual for a date (today first), else most recent on or before that date. */
export function getLatestMorningRitualForUser(
  userId: string,
  date: string
): MorningRitualSession | null {
  const todayRow = dbGet<RitualRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM morning_rituals
      WHERE user_id = ? AND date = ? AND completed = 1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, date]
  );
  const session = todayRow ? rowToSession(todayRow) : null;
  if (session) return session;

  const fallbackRow = dbGet<RitualRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM morning_rituals
      WHERE user_id = ? AND date <= ? AND completed = 1
      ORDER BY date DESC, created_at DESC
      LIMIT 1`,
    [userId, date]
  );
  return fallbackRow ? rowToSession(fallbackRow) : null;
}

export function saveMorningRitualSession(userId: string, session: MorningRitualSession): void {
  const existing = dbGet<{user_id: string | null}>(
    `SELECT user_id FROM morning_rituals WHERE id = ?`,
    [session.id]
  );
  if (existing && existing.user_id !== userId) {
    throw new Error(`Morning ritual ${session.id} is owned by another user`);
  }

  const date = dateToYMD(new Date(session.completedAt ?? session.startedAt ?? Date.now()));
  const db = getDb();
  const save = db.transaction(() => {
    dbRun(
      `INSERT OR REPLACE INTO morning_rituals
         (id, user_id, date, mood_before, mood_after, triggers, duration_sec, completed, mode,
          selected_affirmation_id, breathing_rounds_done, skipped_steps,
          visualization_duration_sec, gratitude_generic_flags, gratitude_target_types,
          mission_changed_from_yesterday, breathing_full_pattern_done,
          visualization_content_type, session_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         COALESCE((SELECT created_at FROM morning_rituals WHERE id = ?), datetime('now')))`,
      [
        session.id,
        userId,
        date,
        toNumber(session.moodBefore),
        toNumber(session.moodAfter),
        JSON.stringify(session.gratitudeTriggerKeys ?? []),
        session.durationSeconds ?? 0,
        session.completed ? 1 : 0,
        session.mode,
        session.selectedAffirmationId,
        session.breathingRoundsDone ?? null,
        JSON.stringify(session.skippedSteps ?? []),
        session.visualizationDurationSec ?? null,
        JSON.stringify(session.gratitudeGenericFlags ?? []),
        JSON.stringify(session.gratitudeTargetTypes ?? []),
        session.missionChangedFromYesterday ? 1 : 0,
        session.breathingFullPatternDone ? 1 : 0,
        session.visualizationContentType ?? null,
        JSON.stringify(session),
        session.id,
      ]
    );

    dbRun(`DELETE FROM gratitude_entries WHERE ritual_id = ? AND user_id = ?`, [session.id, userId]);
    session.gratitudeEntries.forEach((text, index) => {
      if (!text.trim()) return;
      dbRun(
        `INSERT INTO gratitude_entries
          (id, user_id, ritual_id, date, entry_text, position, trigger_key,
           entry_duration_sec, was_edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${session.id}:${index}`,
          userId,
          session.id,
          date,
          text.trim(),
          index + 1,
          session.gratitudeTriggerKeys?.[index] ?? session.gratitudeTriggerKey ?? null,
          session.gratitudeEntryDurationsSec?.[index] ?? null,
          session.gratitudeWasEdited?.[index] ? 1 : 0,
        ]
      );
    });
  });

  save();
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
