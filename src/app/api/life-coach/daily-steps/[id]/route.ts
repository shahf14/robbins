import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  DailyStepRelationError,
  deleteDailyBabyStep,
  updateDailyBabyStep,
} from '@/lib/life-coach/repository';
import {toDailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {z} from 'zod';
import {
  dailyStepDifficultySchema,
  dailyStepStatusSchema,
  lifeDomainSchema,
} from '@/lib/life-coach/schemas';
import {isIsoDate, jsonError, jsonMutation, jsonNoContent, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

const dailyStepPatchSchema = z.object({
  goal_id: z.string().uuid().nullable().optional(),
  domain: lifeDomainSchema.optional(),
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(1000).optional(),
  estimated_minutes: z.coerce.number().int().min(1).max(60).optional(),
  difficulty: dailyStepDifficultySchema.optional(),
  scheduled_date: z.string().date().optional(),
  rescheduled_from: z.string().date().optional(),
  status: dailyStepStatusSchema.optional(),
  is_general: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, dailyStepPatchSchema);
  if (!parsed.ok) return parsed.response;

  const {id} = await params;

  try {
    if (parsed.data.scheduled_date && !isIsoDate(parsed.data.scheduled_date)) {
      return jsonError('Invalid scheduled_date. Expected YYYY-MM-DD.', 400);
    }
    const step = await updateDailyBabyStep(id, parsed.data, current.user.id);
    return jsonMutation({step: toDailyBabyStepResponse(step)});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    if (error instanceof DailyStepRelationError) {
      return jsonError(error.message, 400);
    }
    return jsonError('Could not update daily step.', 500, String(error));
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {id} = await params;

  try {
    await deleteDailyBabyStep(id, current.user.id);
    return jsonNoContent();
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    return jsonError('Could not delete daily step.', 500, String(error));
  }
}
