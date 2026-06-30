import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  findStoredIdempotencyPayload,
  storeIdempotencyPayload,
} from '@/lib/api-idempotency';
import {
  getUserParticipantProfile,
  listDailyBabyStepsForDate,
  updateDailyBabyStepStatus,
  upsertDailyReflection,
} from '@/lib/life-coach/repository';
import {getDailyBabyStepById} from '@/lib/life-coach/daily-step-repository';
import {dailyStepStatusUpdateSchema} from '@/lib/life-coach/schemas';
import {InvalidDailyStepStatusTransitionError} from '@/lib/life-coach/daily-step-status-transitions';
import {jsonError, jsonMutation, jsonOk, parseLifeCoachJsonBody, startOfToday} from '@/lib/life-coach/server';
import type {DailyBabyStep, UserProfile} from '@/lib/life-coach/types';
import {
  toDailyBabyStepResponse,
  toDailyReflectionResponse,
} from '@/lib/life-coach/response-dtos';
import {getSupportContextForUser} from '@/lib/support-context/formulation-support-context';
import type {CoachingStyle, PreferredActionWindow} from '@/lib/user-preferences';
import {saveSkipCoachAdjustment} from '@/lib/skip-coach-loop/repository';
import {recordNewSkipBarrier} from '@/lib/formulation/skip-adaptation-server';
import {
  buildAutoSkipCoachOutcome,
  type SkipEventInput,
} from '@/lib/formulation/skip-adaptation-routing';
import {refreshToneEffectiveness} from '@/lib/coach-tone';
import type {AppLocale} from '@/i18n/config';
import type {z} from 'zod';

type DailyStepStatusUpdateBody = z.infer<typeof dailyStepStatusUpdateSchema>;

async function applyDailyStepStatusSideEffects(
  userId: string,
  profile: UserProfile,
  step: DailyBabyStep,
  body: DailyStepStatusUpdateBody,
  locale: AppLocale
): Promise<void> {
  try {
    refreshToneEffectiveness(
      userId,
      (profile.coaching_style ?? 'supportive') as CoachingStyle,
      locale
    );

    if (body.status !== 'skipped' && body.status !== 'partial') {
      return;
    }

    const {formulation} = await getSupportContextForUser(userId);
    const skipCtx = formulation.skip_adaptation;
    if (!skipCtx) {
      return;
    }

    const skipInput: SkipEventInput = {
      status: body.status,
      blocker_reason: body.blocker_reason,
      reflection_text: body.reflection_text,
      actual_minutes: body.actual_minutes,
      value_feedback: body.value_feedback,
      step_title: step.title,
      step_estimated_minutes: step.estimated_minutes,
      scheduled_date: step.scheduled_date,
    };
    const preferredWindow = (profile.preferred_action_window ?? 'flexible') as PreferredActionWindow;
    const outcome = buildAutoSkipCoachOutcome(skipCtx, skipInput, locale, preferredWindow);
    saveSkipCoachAdjustment(userId, {
      skip_date: step.scheduled_date,
      step_id: step.id,
      goal_id: step.goal_id,
      blocker_reason: body.blocker_reason,
      coach_action: outcome.coach_action,
      adjustment: outcome.adjustment,
    });
    if (outcome.classification === 'new_barrier') {
      recordNewSkipBarrier(userId, skipInput, preferredWindow);
    }
  } catch (error) {
    console.error('[daily-step-status] side effect failed:', error);
  }
}

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
  const idempotencyKey = parsed.data.idempotency_key;

  if (idempotencyKey) {
    const cached = findStoredIdempotencyPayload(
      current.user.id,
      'daily-step-status',
      idempotencyKey
    );
    if (cached) {
      return Response.json(JSON.parse(cached));
    }
  }

  try {
    const beforeStep = getDailyBabyStepById(id, current.user.id);
    if (!beforeStep) {
      return jsonError('Daily step not found.', 404);
    }

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

    const statusChanged = beforeStep.status !== parsed.data.status;

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
    const locale = (profile?.preferred_language ?? 'he') as AppLocale;

    if (profile && statusChanged) {
      await applyDailyStepStatusSideEffects(
        current.user.id,
        profile,
        step,
        parsed.data,
        locale
      );
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

      const payload = {
        ok: true as const,
        step: toDailyBabyStepResponse(step),
        reflection: toDailyReflectionResponse(reflection),
        completion_snapshot: {
          completed_steps: completedSteps,
          total_steps: existingSteps.length,
        },
      };
      if (idempotencyKey) {
        storeIdempotencyPayload(
          current.user.id,
          'daily-step-status',
          idempotencyKey,
          id,
          payload
        );
      }
      return jsonMutation({
        step: payload.step,
        reflection: payload.reflection,
        completion_snapshot: payload.completion_snapshot,
      });
    }

    const payload = {
      ok: true as const,
      step: toDailyBabyStepResponse(step),
      reflection: null,
      completion_snapshot: null,
    };
    if (idempotencyKey) {
      storeIdempotencyPayload(
        current.user.id,
        'daily-step-status',
        idempotencyKey,
        id,
        payload
      );
    }
    return jsonMutation({
      step: payload.step,
      reflection: payload.reflection,
      completion_snapshot: payload.completion_snapshot,
    });
  } catch (error) {
    if (error instanceof InvalidDailyStepStatusTransitionError) {
      return jsonError('Invalid step status transition.', 409);
    }
    return jsonError('Could not update daily step status.', 500, String(error));
  }
}
