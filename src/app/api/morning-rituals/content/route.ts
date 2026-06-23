import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listRitualContent,
  replaceAffirmations,
  replaceIdentities,
} from '@/lib/db/repositories/ritual-content';
import type {AffirmationItem, IdentityOption} from '@/lib/morning-ritual-types';
import {readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  return Response.json(listRitualContent(current.user.id));
}

export async function POST(request: Request) {
  const bodyResult = await readAuthenticatedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const body = (bodyResult.data ?? {}) as {
    affirmations?: AffirmationItem[];
    identities?: IdentityOption[];
  };

  if (Array.isArray(body.affirmations)) {
    replaceAffirmations(bodyResult.user.id, body.affirmations);
  }
  if (Array.isArray(body.identities)) {
    replaceIdentities(bodyResult.user.id, body.identities);
  }

  return Response.json({ok: true});
}
