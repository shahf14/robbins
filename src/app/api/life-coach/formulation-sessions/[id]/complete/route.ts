import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {completeFormulationSession, getFormulationSession} from '@/lib/life-coach/repository';
import {toFormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonMutation} from '@/lib/life-coach/server';

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const {id} = await params;

  try {
    const existing = await getFormulationSession(current.user.id, id);
    if (!existing) {
      return jsonError('Session not found.', 404);
    }
    if (!existing.coach_handoff) {
      return jsonError('Coach handoff is required before completing.', 400);
    }
    if (existing.status === 'completed') {
      return jsonMutation({session: toFormulationSessionResponse(existing)});
    }

    const session = await completeFormulationSession(current.user.id, id);
    return jsonMutation({session: toFormulationSessionResponse(session)});
  } catch (error) {
    return jsonError('Could not complete session.', 500, String(error));
  }
}
