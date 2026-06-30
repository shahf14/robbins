import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getActiveDraftFormulation,
  getLatestCompletedFormulation,
} from '@/lib/life-coach/repository';
import {
  toNullableFormulationSessionResponse,
} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  try {
    const [draft, completed] = await Promise.all([
      getActiveDraftFormulation(current.user.id),
      getLatestCompletedFormulation(current.user.id),
    ]);
    return jsonOk({
      draft: toNullableFormulationSessionResponse(draft),
      completed: toNullableFormulationSessionResponse(completed),
    });
  } catch (error) {
    return jsonError('Could not load formulation sessions.', 500, String(error));
  }
}
