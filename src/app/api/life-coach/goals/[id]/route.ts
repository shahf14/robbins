import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {deleteGoal, updateGoal} from '@/lib/life-coach/repository';
import {toGoalResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonMutation, jsonNoContent, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {goalUpdateInputSchema} from '@/lib/life-coach/schemas';

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, goalUpdateInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {id} = await params;

  try {
    const goal = await updateGoal(id, parsed.data, {userId: current.user.id});
    return jsonMutation({goal: toGoalResponse(goal)});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Goal not found.', 404);
    return jsonError('Could not update goal.', 500, String(error));
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const {id} = await params;

  try {
    await deleteGoal(id, current.user.id);
    return jsonNoContent();
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Goal not found.', 404);
    return jsonError('Could not delete goal.', 500, String(error));
  }
}
