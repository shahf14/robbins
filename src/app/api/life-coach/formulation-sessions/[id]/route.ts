import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getFormulationSession,
  patchFormulationSession,
} from '@/lib/life-coach/repository';
import {formulationSessionPatchSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonOk, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const {id} = await params;
  try {
    const session = await getFormulationSession(current.user.id, id);
    if (!session) {
      return jsonError('Session not found.', 404);
    }
    return jsonOk({session});
  } catch (error) {
    return jsonError('Could not load session.', 500, String(error));
  }
}

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const {id} = await params;
  const parsed = await parseLifeCoachJsonBody(request, formulationSessionPatchSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const existing = await getFormulationSession(current.user.id, id);
    if (!existing) {
      return jsonError('Session not found.', 404);
    }
    if (existing.status === 'crisis_stopped' && parsed.data.phase !== 'navigate') {
      return jsonError('Session stopped for safety.', 403);
    }
    if (existing.status === 'completed') {
      return jsonError('Session already completed.', 403);
    }

    const result = await patchFormulationSession(current.user.id, id, parsed.data);
    return jsonOk({
      session: result.session,
      risk_needs_follow_up: result.risk_needs_follow_up ?? false,
    });
  } catch (error) {
    return jsonError('Could not update session.', 500, String(error));
  }
}
