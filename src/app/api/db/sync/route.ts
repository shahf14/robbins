/**
 * POST /api/db/sync
 * Receives localStorage data from the client and writes it to SQLite.
 *
 * Body shape:
 * {
 *   user_id?: string,
 *   checkins?: CheckInEntry[],
 *   morning_rituals?: MorningRitualSession[],
 * }
 */
import {requireAdmin} from '@/lib/db/admin-guard';
import {bulkUpsertCheckins} from '@/lib/db/repositories/checkins';
import {bulkUpsertMorningRituals} from '@/lib/db/repositories/gratitude';
import {dateToYMD} from '@/lib/date-utils';
import {badRequest, serverError, payloadTooLarge} from '@/lib/api-response';

type RawCheckin = {
  id?: string;
  date?: string;
  createdAt?: string;
  focus?: number;
  energy?: number;
  stateScore?: number;
  momentum?: number;
  primaryTag?: string;
  selectedTags?: string[];
  priorityAction?: string;
  recommendationType?: string;
  insightKey?: string;
  coachSupport?: string;
  challengeDone?: boolean;
  followUps?: string[];
  sessionDurationSec?: number;
  sliderAdjustments?: number;
  openedCoachSupport?: boolean;
  priorityActionWordCount?: number;
  rewrotePriorityActionCount?: number;
  tagValenceShift?: number;
  energyFocusDivergence?: number;
  physicalComplaintMentioned?: boolean;
  helpEngagementDepth?: string;
  statedActionCompleted?: boolean | null;
  [key: string]: unknown;
};

type RawRitual = {
  id?: string;
  date?: string;
  startedAt?: string;
  completedAt?: string | null;
  moodBefore?: number | string | null;
  moodAfter?: number | string | null;
  triggers?: string[];
  durationSec?: number;
  completed?: boolean;
  gratitudeEntries?: string[];
  [key: string]: unknown;
};

function normalizeSyncBody(value: unknown): {
  user_id?: string;
  checkins: RawCheckin[];
  morning_rituals: RawRitual[];
} {
  const body = value && typeof value === 'object' ? value as {
    user_id?: unknown;
    checkins?: unknown;
    morning_rituals?: unknown;
  } : {};
  return {
    user_id: typeof body.user_id === 'string' ? body.user_id : undefined,
    checkins: Array.isArray(body.checkins) ? body.checkins as RawCheckin[] : [],
    morning_rituals: Array.isArray(body.morning_rituals) ? body.morning_rituals as RawRitual[] : [],
  };
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: ReturnType<typeof normalizeSyncBody>;
  try {
    body = normalizeSyncBody(await request.json());
  } catch {
    return badRequest('Invalid JSON');
  }

  const userId = body.user_id ?? guard.user.id;
  if ((body.checkins?.length ?? 0) > 1000 || (body.morning_rituals?.length ?? 0) > 1000) {
    return payloadTooLarge('Import is limited to 1000 records per collection.');
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

    return Response.json({ok: true, synced: stats});
  } catch {
    return serverError('Could not import local storage data.');
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
