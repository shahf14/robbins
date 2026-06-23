/**
 * GET  /api/morning-rituals  → list the current user's ritual sessions
 * POST /api/morning-rituals  → save (insert/replace) one ritual session
 *
 * Backed purely by the local SQLite DB.
 */
import {morningRitualSessionSchema} from '@/lib/api-body-schemas';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listMorningRitualSessions,
  saveMorningRitualSession,
} from '@/lib/db/repositories/morning-rituals';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import {serverError} from '@/lib/api-response';
import {JSON_BODY_LIMITS, readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const sessions = listMorningRitualSessions(current.user.id);
  return Response.json({sessions});
}

export async function POST(request: Request) {
  const body = await readAuthenticatedJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.sessionPost,
    schema: morningRitualSessionSchema,
  });
  if (!body.ok) return body.response;

  const session = body.data as MorningRitualSession;

  try {
    saveMorningRitualSession(body.user.id, session);
    return Response.json({ok: true});
  } catch {
    return serverError('Could not save morning ritual session');
  }
}
