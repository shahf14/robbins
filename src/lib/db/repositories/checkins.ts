import {dbRun, dbGet, getDb} from '../sqlite';
import {randomUUID} from 'crypto';
import {parseJsonOr} from '@/lib/safe-json';
import type {CheckInEntry} from '@/lib/check-in-types';
import {dateToYMD} from '@/lib/date-utils';

export type CheckinRow = {
  id: string;
  user_id: string | null;
  date: string;
  focus_score: number | null;
  energy_score: number | null;
  state_score: number | null;
  momentum: number | null;
  primary_tag: string | null;
  selected_tags: string | null;   // JSON
  priority_action: string | null;
  recommendation_type: string | null;
  insight_key: string | null;
  coach_support: string | null;
  challenge_done: number;
  follow_ups: string | null;      // JSON
  session_duration_sec: number | null;
  slider_adjustments: number | null;
  opened_coach_support: number;
  priority_action_word_count: number | null;
  rewrote_priority_action_count: number;
  tag_valence_shift: number | null;
  energy_focus_divergence: number | null;
  physical_complaint_mentioned: number;
  help_engagement_depth: string | null;
  stated_action_completed: number | null;
  entry_json: string | null;
  created_at: string;
};

export type CheckinInput = Omit<CheckinRow, 'id' | 'created_at' | 'entry_json'> & {
  id?: string;
  entry_json?: string | null;
};

function upsertCheckin(input: CheckinInput): void {
  dbRun(
    `INSERT INTO checkins
      (id, user_id, date, focus_score, energy_score, state_score, momentum,
       primary_tag, selected_tags, priority_action, recommendation_type,
       insight_key, coach_support, challenge_done, follow_ups, session_duration_sec,
       slider_adjustments, opened_coach_support, priority_action_word_count,
       rewrote_priority_action_count, tag_valence_shift, energy_focus_divergence,
       physical_complaint_mentioned, help_engagement_depth, stated_action_completed,
       entry_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       focus_score=excluded.focus_score,
       energy_score=excluded.energy_score,
       state_score=excluded.state_score,
       momentum=excluded.momentum,
       primary_tag=excluded.primary_tag,
       selected_tags=excluded.selected_tags,
       priority_action=excluded.priority_action,
       recommendation_type=excluded.recommendation_type,
       insight_key=excluded.insight_key,
       coach_support=excluded.coach_support,
       challenge_done=excluded.challenge_done,
       follow_ups=excluded.follow_ups,
       session_duration_sec=excluded.session_duration_sec,
       slider_adjustments=excluded.slider_adjustments,
       opened_coach_support=excluded.opened_coach_support,
       priority_action_word_count=excluded.priority_action_word_count,
       rewrote_priority_action_count=excluded.rewrote_priority_action_count,
       tag_valence_shift=excluded.tag_valence_shift,
       energy_focus_divergence=excluded.energy_focus_divergence,
       physical_complaint_mentioned=excluded.physical_complaint_mentioned,
       help_engagement_depth=excluded.help_engagement_depth,
       stated_action_completed=excluded.stated_action_completed,
       entry_json=COALESCE(excluded.entry_json, checkins.entry_json)`,
    [
      input.id ?? randomUUID(),
      input.user_id,
      input.date,
      input.focus_score,
      input.energy_score,
      input.state_score,
      input.momentum,
      input.primary_tag,
      typeof input.selected_tags === 'string'
        ? input.selected_tags
        : JSON.stringify(input.selected_tags ?? []),
      input.priority_action,
      input.recommendation_type,
      input.insight_key,
      input.coach_support,
      input.challenge_done ? 1 : 0,
      typeof input.follow_ups === 'string'
        ? input.follow_ups
        : JSON.stringify(input.follow_ups ?? []),
      input.session_duration_sec,
      input.slider_adjustments,
      input.opened_coach_support ? 1 : 0,
      input.priority_action_word_count,
      input.rewrote_priority_action_count,
      input.tag_valence_shift,
      input.energy_focus_divergence,
      input.physical_complaint_mentioned ? 1 : 0,
      input.help_engagement_depth,
      input.stated_action_completed,
      input.entry_json ?? null,
    ]
  );
}

export function bulkUpsertCheckins(rows: CheckinInput[]): void {
  // Mirror upsertCheckin's ON CONFLICT update so re-syncing an existing check-in
  // preserves created_at (not in the update list) and keeps the prior entry_json
  // when none is supplied. INSERT OR REPLACE would delete+reinsert the row,
  // resetting created_at and dropping entry_json.
  const stmt = getDb().prepare(
    `INSERT INTO checkins
      (id, user_id, date, focus_score, energy_score, state_score, momentum,
       primary_tag, selected_tags, priority_action, recommendation_type,
       insight_key, coach_support, challenge_done, follow_ups, session_duration_sec,
       slider_adjustments, opened_coach_support, priority_action_word_count,
       rewrote_priority_action_count, tag_valence_shift, energy_focus_divergence,
       physical_complaint_mentioned, help_engagement_depth, stated_action_completed,
       entry_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date=excluded.date,
       focus_score=excluded.focus_score,
       energy_score=excluded.energy_score,
       state_score=excluded.state_score,
       momentum=excluded.momentum,
       primary_tag=excluded.primary_tag,
       selected_tags=excluded.selected_tags,
       priority_action=excluded.priority_action,
       recommendation_type=excluded.recommendation_type,
       insight_key=excluded.insight_key,
       coach_support=excluded.coach_support,
       challenge_done=excluded.challenge_done,
       follow_ups=excluded.follow_ups,
       session_duration_sec=excluded.session_duration_sec,
       slider_adjustments=excluded.slider_adjustments,
       opened_coach_support=excluded.opened_coach_support,
       priority_action_word_count=excluded.priority_action_word_count,
       rewrote_priority_action_count=excluded.rewrote_priority_action_count,
       tag_valence_shift=excluded.tag_valence_shift,
       energy_focus_divergence=excluded.energy_focus_divergence,
       physical_complaint_mentioned=excluded.physical_complaint_mentioned,
       help_engagement_depth=excluded.help_engagement_depth,
       stated_action_completed=excluded.stated_action_completed,
       entry_json=COALESCE(excluded.entry_json, checkins.entry_json)`
  );
  const run = getDb().transaction((items: CheckinInput[]) => {
    for (const row of items) {
      const existing = dbGet<{user_id: string | null}>(
        `SELECT user_id FROM checkins WHERE id = ?`,
        [row.id]
      );
      if (existing && existing.user_id !== row.user_id) {
        throw new Error(`Check-in ${row.id} is owned by another user`);
      }
      stmt.run(
        row.id ?? randomUUID(), row.user_id, row.date,
        row.focus_score, row.energy_score, row.state_score, row.momentum,
        row.primary_tag,
        typeof row.selected_tags === 'string' ? row.selected_tags : JSON.stringify(row.selected_tags ?? []),
        row.priority_action, row.recommendation_type, row.insight_key,
        row.coach_support, row.challenge_done ? 1 : 0,
        typeof row.follow_ups === 'string' ? row.follow_ups : JSON.stringify(row.follow_ups ?? []),
        row.session_duration_sec, row.slider_adjustments, row.opened_coach_support ? 1 : 0,
        row.priority_action_word_count, row.rewrote_priority_action_count,
        row.tag_valence_shift, row.energy_focus_divergence,
        row.physical_complaint_mentioned ? 1 : 0, row.help_engagement_depth,
        row.stated_action_completed, row.entry_json ?? null
      );
    }
  });
  run(rows);
}

export function listCheckinRowsForPeriod(userId: string, periodStart: string, periodEnd: string): CheckinRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM checkins
        WHERE user_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC`
    )
    .all(userId, periodStart, periodEnd) as CheckinRow[];
}
