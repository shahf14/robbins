import {dateToYMD} from '@/lib/date-utils';
import {runImmediateTransaction} from '@/lib/db/immediate-transaction';
import {assertRitualNotUncompleted} from '@/lib/ritual-session-guards';
import {dbAll, dbGet, dbRun} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';

export const DEFAULT_RITUAL_SESSION_LIMIT = 60;
export const MAX_RITUAL_SESSION_LIMIT = 400;

type RitualRow = {
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

function rowToSession(row: RitualRow): MorningRitualSession | null {
  if (!row.session_json) return null;
  return parseJsonOr<MorningRitualSession | null>(row.session_json, null);
}

export function countMorningRitualSessions(userId: string): number {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM morning_rituals WHERE user_id = ?`,
    [userId]
  );
  return row?.count ?? 0;
}

/** List a user's morning ritual sessions, newest first. */
export function listMorningRitualSessions(
  userId: string,
  limitOrOptions?: number | RitualListOptions
): MorningRitualSession[] {
  const {limit, offset} = resolveRitualPagination(limitOrOptions);
  const rows = dbAll<RitualRow>(
    `SELECT id, date, completed, duration_sec, session_json
       FROM morning_rituals
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset]
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
  runImmediateTransaction(() => {
    const existing = dbGet<{user_id: string | null; completed: number}>(
      `SELECT user_id, completed FROM morning_rituals WHERE id = ?`,
      [session.id]
    );
    if (existing && existing.user_id !== userId) {
      throw new Error(`Morning ritual ${session.id} is owned by another user`);
    }
    assertRitualNotUncompleted(existing?.completed === 1, session.completed);

    const date = dateToYMD(new Date(session.completedAt ?? session.startedAt ?? Date.now()));

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
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
