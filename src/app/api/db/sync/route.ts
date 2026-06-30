/**
 * POST /api/db/sync
 * Receives localStorage data from the client and writes it to SQLite.
 *
 * Body shape:
 * {
 *   checkins?: CheckInEntry[],
 *   morning_rituals?: MorningRitualSession[],
 * }
 */
import {
  dbSyncBodySchema,
  dbSyncCheckinItemSchema,
  dbSyncMorningRitualItemSchema,
} from '@/lib/api-body-schemas';
import {requireAdmin} from '@/lib/db/admin-guard';
import {logAdminAccess} from '@/lib/db/admin-audit-log';
import {bulkUpsertCheckins} from '@/lib/db/repositories/checkins';
import {bulkUpsertMorningRituals} from '@/lib/db/repositories/gratitude';
import {dateToYMD} from '@/lib/date-utils';
import {jsonError, jsonMutation} from '@/lib/life-coach/server';
import {JSON_BODY_LIMITS, readJsonBody} from '@/lib/read-json-body';

import {z} from 'zod';

type RawCheckin = z.infer<typeof dbSyncCheckinItemSchema>;
type RawRitual = z.infer<typeof dbSyncMorningRitualItemSchema>;

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: {checkins?: RawCheckin[]; morning_rituals?: RawRitual[]};
  const parsed = await readJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.dbSync,
    schema: dbSyncBodySchema,
  });
  if (!parsed.ok) return parsed.response;
  body = parsed.data;

  const userId = guard.user.id;
  if ((body.checkins?.length ?? 0) > 1000 || (body.morning_rituals?.length ?? 0) > 1000) {
    return jsonError('Import is limited to 1000 records per collection.', 413);
  }
  const stats = {checkins: 0, morning_rituals: 0, gratitude_entries: 0};

  try {
    // ── Checkins ──────────────────────────────────────────────────────────
    if (Array.isArray(body.checkins) && body.checkins.length > 0) {
      const rows = body.checkins.map((c) => ({
        id: c.id,
        user_id: userId,
        date: c.date ?? toIsoDate(c.createdAt),
        focus_score: c.focus ?? null,
        energy_score: c.energy ?? null,
        state_score: c.stateScore ?? null,
        momentum: c.momentum ?? null,
        primary_tag: c.primaryTag ?? null,
        selected_tags: JSON.stringify(c.selectedTags ?? []),
        priority_action: c.priorityAction ?? null,
        recommendation_type: c.recommendationType ?? null,
        insight_key: c.insightKey ?? null,
        coach_support: c.coachSupport ?? null,
        challenge_done: c.challengeDone ? 1 : 0,
        follow_ups: JSON.stringify(c.followUps ?? []),
        session_duration_sec: c.sessionDurationSec ?? null,
        slider_adjustments: c.sliderAdjustments ?? null,
        opened_coach_support: c.openedCoachSupport ? 1 : 0,
        priority_action_word_count: c.priorityActionWordCount ?? null,
        rewrote_priority_action_count: c.rewrotePriorityActionCount ?? 0,
        tag_valence_shift: c.tagValenceShift ?? null,
        energy_focus_divergence: c.energyFocusDivergence ?? null,
        physical_complaint_mentioned: c.physicalComplaintMentioned ? 1 : 0,
        help_engagement_depth: c.helpEngagementDepth ?? null,
        stated_action_completed: c.statedActionCompleted == null ? null : c.statedActionCompleted ? 1 : 0,
        entry_json: JSON.stringify(c),
      }));
      bulkUpsertCheckins(rows);
      stats.checkins = rows.length;
    }

    // ── Morning Rituals + Gratitude ───────────────────────────────────────
    if (Array.isArray(body.morning_rituals) && body.morning_rituals.length > 0) {
      const rows = body.morning_rituals.map((r) => ({
        id: r.id,
        user_id: userId,
        date: r.date ?? toIsoDate(r.completedAt ?? r.startedAt),
        mood_before: toNumber(r.moodBefore),
        mood_after: toNumber(r.moodAfter),
        triggers: JSON.stringify(r.triggers ?? []),
        duration_sec: r.durationSec ?? null,
        completed: r.completed ?? false,
        gratitude_entries: r.gratitudeEntries ?? [],
        session_json: JSON.stringify(r),
      }));
      bulkUpsertMorningRituals(rows);
      stats.morning_rituals = rows.length;
      stats.gratitude_entries = rows.reduce((sum, r) => sum + (r.gratitude_entries?.length ?? 0), 0);
    }

    logAdminAccess({
      userId: guard.user.id,
      action: 'db_sync',
      detail: JSON.stringify(stats),
      request,
    });

    return jsonMutation({synced: stats});
  } catch {
    return jsonError('Could not import local storage data.', 500);
  }
}

function toNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(ts?: string | number | null): string {
  return dateToYMD(ts ? new Date(ts) : new Date());
}
