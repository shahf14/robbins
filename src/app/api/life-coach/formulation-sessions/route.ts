import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {createFormulationSession} from '@/lib/life-coach/repository';
import {formulationSessionCreateSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonOk, resolveLocale} from '@/lib/life-coach/server';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = formulationSessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid payload.', 400, parsed.error.flatten());
  }

  try {
    const locale = resolveLocale(parsed.data.locale ?? null);
    const session = await createFormulationSession(current.user.id, locale);
    return jsonOk({session});
  } catch (error) {
    return jsonError('Could not create formulation session.', 500, String(error));
  }
}
