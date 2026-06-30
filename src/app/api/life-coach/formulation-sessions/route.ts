import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {createFormulationSession} from '@/lib/life-coach/repository';
import {toFormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import {formulationSessionCreateSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonMutation, jsonOk, resolveLocale, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const parsed = await parseLifeCoachJsonBody(request, formulationSessionCreateSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const locale = resolveLocale(parsed.data.locale ?? null);
    const session = await createFormulationSession(current.user.id, locale);
    return jsonMutation({session: toFormulationSessionResponse(session)});
  } catch (error) {
    return jsonError('Could not create formulation session.', 500, String(error));
  }
}
