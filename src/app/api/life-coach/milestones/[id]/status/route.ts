import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {updateMilestoneStatus} from '@/lib/life-coach/repository';
import {milestoneStatusUpdateSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonOk, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const parsed = await parseLifeCoachJsonBody(request, milestoneStatusUpdateSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {id} = await params;
  try {
    const milestone = await updateMilestoneStatus(id, parsed.data.status, current.user.id);
    return jsonOk({milestone});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Milestone not found.', 404);
    return jsonError('Could not update milestone.', 500, String(error));
  }
}
