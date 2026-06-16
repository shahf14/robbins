import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {deleteGoal, getGoalById, listMilestonesForGoal, updateGoal} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';
import {goalUpdateInputSchema} from '@/lib/life-coach/schemas';

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {id} = await params;

  try {
    const goal = await getGoalById(id, current.user.id);

    if (!goal) {
      return jsonError('Goal not found.', 404);
    }

    const milestones = await listMilestonesForGoal(id, current.user.id);
    return jsonOk({goal, milestones});
  } catch (error) {
    return jsonError('Could not load goal.', 500, String(error));
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsed = goalUpdateInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Invalid goal update payload.', 400, parsed.error.flatten());
  }

  const {id} = await params;

  try {
    const goal = await updateGoal(id, parsed.data, {userId: current.user.id});
    return jsonOk({goal});
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
    return jsonOk({ok: true});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Goal not found.', 404);
    return jsonError('Could not delete goal.', 500, String(error));
  }
}
