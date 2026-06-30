import {jsonMutation} from '@/lib/life-coach/server';
import {morningRitualContentPostSchema} from '@/lib/api-body-schemas';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listRitualContent,
  replaceAffirmations,
  replaceIdentities,
} from '@/lib/db/repositories/ritual-content';
import type {AffirmationItem, IdentityOption} from '@/lib/morning-ritual-types';
import {JSON_BODY_LIMITS, readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  return Response.json(listRitualContent(current.user.id));
}

export async function POST(request: Request) {
  const bodyResult = await readAuthenticatedJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.sessionPost,
    schema: morningRitualContentPostSchema,
  });
  if (!bodyResult.ok) return bodyResult.response;

  if (bodyResult.data.affirmations !== undefined) {
    replaceAffirmations(bodyResult.user.id, bodyResult.data.affirmations as AffirmationItem[]);
  }
  if (bodyResult.data.identities !== undefined) {
    replaceIdentities(bodyResult.user.id, bodyResult.data.identities as IdentityOption[]);
  }

  return jsonMutation();
}
