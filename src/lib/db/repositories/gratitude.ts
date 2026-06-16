import {dbGet, getDb} from '../sqlite';
import {randomUUID} from 'crypto';

export type MorningRitualInput = {
  id?: string;
  user_id: string | null;
  date: string;
  mood_before: number | null;
  mood_after: number | null;
  triggers: string | null;     // JSON array or string[]
  duration_sec: number | null;
  completed: boolean;
  gratitude_entries?: string[]; // raw text entries
  session_json?: string | null;
};

export function bulkUpsertMorningRituals(rows: MorningRitualInput[]): void {
  const db = getDb();
  const ritualStmt = db.prepare(
    `INSERT OR REPLACE INTO morning_rituals
      (id, user_id, date, mood_before, mood_after, triggers, duration_sec, completed, session_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const gratitudeStmt = db.prepare(
    `INSERT OR REPLACE INTO gratitude_entries
      (id, user_id, ritual_id, date, entry_text, position)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const run = db.transaction((items: MorningRitualInput[]) => {
    for (const row of items) {
      const ritualId = row.id ?? randomUUID();
      const existing = dbGet<{user_id: string | null}>(
        `SELECT user_id FROM morning_rituals WHERE id = ?`,
        [ritualId]
      );
      if (existing && existing.user_id !== row.user_id) {
        throw new Error(`Morning ritual ${ritualId} is owned by another user`);
      }
      db.prepare(`DELETE FROM gratitude_entries WHERE ritual_id = ? AND user_id = ?`)
        .run(ritualId, row.user_id);
      ritualStmt.run(
        ritualId,
        row.user_id,
        row.date,
        row.mood_before,
        row.mood_after,
        typeof row.triggers === 'string' ? row.triggers : JSON.stringify(row.triggers ?? []),
        row.duration_sec,
        row.completed ? 1 : 0,
        row.session_json ?? null
      );

      const entries = row.gratitude_entries ?? [];
      entries.forEach((text, idx) => {
        if (text?.trim()) {
          gratitudeStmt.run(randomUUID(), row.user_id, ritualId, row.date, text.trim(), idx + 1);
        }
      });
    }
  });

  run(rows);
}
