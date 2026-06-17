import {z} from 'zod';
import {
  getDailyBabyStepById,
  listDailyBabyStepsForDate,
  replaceDailyBabyStepWithCuratedContent,
} from '@/lib/life-coach/repository';
import {curatedTaskToStructuredDailyStep, curatedIdFromStepReasoning, getCuratedDailyTaskOption} from '@/lib/life-coach/curated-daily-tasks';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

const replaceCuratedSchema = z.object({
  replacement_task_id: z.string().trim().min(1),
  locale: z.enum(['he', 'en']).optional().default('he'),
});

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsed = replaceCuratedSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid curated replacement payload.', 400, parsed.error.flatten());
  }

  const {id} = await params;

  try {
    const currentStep = getDailyBabyStepById(id, current.user.id);
    if (!currentStep) return jsonError('Daily step not found.', 404);
    if (currentStep.status !== 'pending') {
      return jsonError('curated_not_pending', 409);
    }

    const currentCuratedId = curatedIdFromStepReasoning(currentStep.reasoning);
    if (!currentCuratedId) {
      return jsonError('curated_not_from_pool', 400);
    }

    const replacement = getCuratedDailyTaskOption(
      parsed.data.replacement_task_id,
      parsed.data.locale
    );
    if (!replacement || replacement.world !== currentStep.domain) {
      return jsonError('curated_wrong_domain', 400);
    }
    if (replacement.id === currentCuratedId) {
      return jsonError('curated_same_task', 400);
    }

    const sameDaySteps = await listDailyBabyStepsForDate(
      currentStep.scheduled_date,
      current.user.id
    );
    const selectedCuratedIds = new Set(
      sameDaySteps
        .filter((step) => step.id !== currentStep.id)
        .map((step) => curatedIdFromStepReasoning(step.reasoning))
        .filter((taskId): taskId is string => Boolean(taskId))
    );
    if (selectedCuratedIds.has(replacement.id)) {
      return jsonError('curated_already_in_plan', 409);
    }

    const structured = curatedTaskToStructuredDailyStep(
      replacement,
      currentStep.scheduled_date
    );
    const step = await replaceDailyBabyStepWithCuratedContent(
      currentStep.id,
      {
        title: structured.title,
        description: structured.description,
        estimated_minutes: structured.estimated_minutes,
        difficulty: structured.difficulty,
        reasoning: structured.reasoning ?? null,
        pain_addressed: structured.pain_addressed ?? null,
        success_signal: structured.success_signal ?? null,
      },
      current.user.id
    );

    return jsonOk({step});
  } catch (error) {
    return jsonError('Could not replace curated daily step.', 500, String(error));
  }
}
