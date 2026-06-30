import {refreshToneEffectiveness} from '@/lib/coach-tone';
import {
  buildAutoSkipCoachOutcome,
  type SkipEventInput,
} from '@/lib/formulation/skip-adaptation-routing';
import {recordNewSkipBarrier} from '@/lib/formulation/skip-adaptation-server';
import {saveSkipCoachAdjustment} from '@/lib/skip-coach-loop/repository';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getUserParticipantProfile,
  listDailyBabyStepsForDate,
  updateDailyBabyStepStatus,
  upsertDailyReflection,
} from '@/lib/life-coach/repository';
import {getSupportContextForUser} from '@/lib/support-context/formulation-support-context';
import type {CoachingStyle, PreferredActionWindow} from '@/lib/user-preferences';
import {jsonError, jsonOk, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {dailyStepStatusUpdateSchema} from '@/lib/life-coach/schemas';
import {InvalidDailyStepStatusTransitionError} from '@/lib/life-coach/daily-step-status-transitions';

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, dailyStepStatusUpdateSchema);
  if (!parsed.ok) {
    return parsed.response;
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

    if (!step) {
      return jsonError('Daily step not found.', 404);
    }

    const isTerminalStatus =
      parsed.data.status === 'completed' ||
      parsed.data.status === 'skipped' ||
      parsed.data.status === 'partial';
    const hasReflection = Boolean(
      parsed.data.blocker_reason || parsed.data.reflection_text
    );

    // Profile is needed by tone refresh and skip adaptation; fetch once.
    const profile =
      isTerminalStatus || hasReflection
        ? await getUserParticipantProfile(current.user.id)
        : null;
    const locale = profile?.preferred_language ?? 'he';

    if (profile) {
      refreshToneEffectiveness(
        current.user.id,
        (profile.coaching_style ?? 'supportive') as CoachingStyle,
        locale
      );
    }

    // Skip-coach adaptation loop. This must run even when the user also supplied
    // a blocker reason / reflection text — that is precisely the signal it
    // consumes, so it cannot be short-circuited by the reflection branch below.
    if (
      profile &&
      (parsed.data.status === 'skipped' || parsed.data.status === 'partial')
    ) {
      const {formulation} = await getSupportContextForUser(current.user.id);
      const skipCtx = formulation.skip_adaptation;
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

    if (hasReflection) {
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

      return jsonOk({
        step,
        reflection,
        completion_snapshot: {
          completed_steps: completedSteps,
          total_steps: existingSteps.length,
        },
      });
    }

    return jsonOk({step});
  } catch (error) {
    if (error instanceof InvalidDailyStepStatusTransitionError) {
      return jsonError('Invalid step status transition.', 409);
    }
    return jsonError('Could not update daily step status.', 500, String(error));
  }
}
