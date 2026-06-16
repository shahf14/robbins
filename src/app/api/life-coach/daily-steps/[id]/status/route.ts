import {refreshToneEffectiveness} from '@/lib/coach-tone';
import {
  buildAutoSkipCoachOutcome,
  buildSkipAdaptationContext,
  type SkipEventInput,
} from '@/lib/formulation/skip-adaptation-routing';
import {recordNewSkipBarrier} from '@/lib/formulation/skip-adaptation-server';
import {saveSkipCoachAdjustment} from '@/lib/skip-coach-loop/repository';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getLatestCompletedFormulation,
  getUserParticipantProfile,
  listDailyBabyStepsForDate,
  updateDailyBabyStepStatus,
  upsertDailyReflection,
} from '@/lib/life-coach/repository';import type {CoachingStyle, PreferredActionWindow} from '@/lib/user-preferences';
import {jsonError, jsonOk, startOfToday} from '@/lib/life-coach/server';
import {dailyStepStatusUpdateSchema} from '@/lib/life-coach/schemas';

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsed = dailyStepStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Invalid daily step status payload.', 400, parsed.error.flatten());
  }

  const {id} = await params;

  try {
    const step = await updateDailyBabyStepStatus(id, {
      status: parsed.data.status,
      actual_minutes: parsed.data.actual_minutes,
      blocker_category: parsed.data.blocker_category,
      reflection_text: parsed.data.reflection_text || null,
      blocker_reason: parsed.data.blocker_reason,
      first_viewed_at: parsed.data.first_viewed_at ?? undefined,
      coach_message_impression_at: parsed.data.coach_message_impression_at ?? undefined,
      primary_cta_clicked_at: parsed.data.primary_cta_clicked_at ?? undefined,
      read_description: parsed.data.read_description,
      value_feedback: parsed.data.value_feedback,
    }, current.user.id);

    if (parsed.data.blocker_reason || parsed.data.reflection_text) {
      const today = step.scheduled_date || startOfToday();
      const existingSteps = await listDailyBabyStepsForDate(today, current.user.id);
      const completedSteps = existingSteps.filter((item) => item.status === 'completed').length;

      const reflection = await upsertDailyReflection(current.user.id, {
        date: today,
        mood_score: null,
        energy_score: null,
        reflection_text: parsed.data.reflection_text || null,
        blocker_reason: parsed.data.blocker_reason,
        writing_duration_sec: parsed.data.writing_duration_sec,
        reflection_word_count: parsed.data.reflection_word_count,
        self_blame_language: parsed.data.self_blame_language,
      });

      const profile = await getUserParticipantProfile(current.user.id);
      refreshToneEffectiveness(
        current.user.id,
        (profile.coaching_style ?? 'supportive') as CoachingStyle,
        profile.preferred_language ?? 'he'
      );

      return jsonOk({
        step,
        reflection,
        completion_snapshot: {
          completed_steps: completedSteps,
          total_steps: existingSteps.length,
        },
      });
    }

    if (parsed.data.status === 'completed' || parsed.data.status === 'skipped' || parsed.data.status === 'partial') {
      const profile = await getUserParticipantProfile(current.user.id);
      const locale = profile.preferred_language ?? 'he';
      refreshToneEffectiveness(
        current.user.id,
        (profile.coaching_style ?? 'supportive') as CoachingStyle,
        locale
      );

      if (parsed.data.status === 'skipped' || parsed.data.status === 'partial') {
        const formulation = await getLatestCompletedFormulation(current.user.id).catch(() => null);
        const skipCtx = formulation ? buildSkipAdaptationContext(formulation, locale) : null;
        if (skipCtx) {
          const skipInput: SkipEventInput = {
            status: parsed.data.status,
            blocker_reason: parsed.data.blocker_reason,
            reflection_text: parsed.data.reflection_text,
            actual_minutes: parsed.data.actual_minutes,
            value_feedback: parsed.data.value_feedback,
            step_title: step.title,
            step_estimated_minutes: step.estimated_minutes,
            scheduled_date: step.scheduled_date,
          };
          const outcome = buildAutoSkipCoachOutcome(
            skipCtx,
            skipInput,
            locale,
            (profile.preferred_action_window ?? 'flexible') as PreferredActionWindow
          );
          saveSkipCoachAdjustment(current.user.id, {
            skip_date: step.scheduled_date,
            step_id: step.id,
            goal_id: step.goal_id,
            blocker_reason: parsed.data.blocker_reason,
            coach_action: outcome.coach_action,
            adjustment: outcome.adjustment,
          });
          if (outcome.classification === 'new_barrier') {
            recordNewSkipBarrier(
              current.user.id,
              skipInput,
              (profile.preferred_action_window ?? 'flexible') as PreferredActionWindow
            );
          }
        }
      }
    }
    return jsonOk({step});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    return jsonError('Could not update daily step status.', 500, String(error));
  }
}
