import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {getFormulationGate} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  try {
    const gate = await getFormulationGate(current.user.id);
    return jsonOk({gate});
  } catch (error) {
    return jsonError('Could not load formulation gate.', 500, String(error));
  }
}
