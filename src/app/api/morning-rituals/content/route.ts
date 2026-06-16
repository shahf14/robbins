import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listRitualContent,
  replaceAffirmations,
  replaceIdentities,
} from '@/lib/db/repositories/ritual-content';
import type {AffirmationItem, IdentityOption} from '@/lib/morning-ritual-types';
import {badRequest} from '@/lib/api-response';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  return Response.json(listRitualContent(current.user.id));
}

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  let body: {affirmations?: AffirmationItem[]; identities?: IdentityOption[]};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (Array.isArray(body.affirmations)) {
    replaceAffirmations(current.user.id, body.affirmations);
  }
  if (Array.isArray(body.identities)) {
    replaceIdentities(current.user.id, body.identities);
  }

  return Response.json({ok: true});
}
