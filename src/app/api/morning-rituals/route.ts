/**
 * GET  /api/morning-rituals  → list the current user's ritual sessions
 * POST /api/morning-rituals  → save (insert/replace) one ritual session
 *
 * Backed purely by the local SQLite DB.
 */
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listMorningRitualSessions,
  saveMorningRitualSession,
} from '@/lib/db/repositories/morning-rituals';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import {badRequest, serverError} from '@/lib/api-response';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const sessions = listMorningRitualSessions(current.user.id);
  return Response.json({sessions});
}

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  let session: MorningRitualSession;
  try {
    session = (await request.json()) as MorningRitualSession;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (
    !session?.id ||
    typeof session.id !== 'string' ||
    !Array.isArray(session.gratitudeEntries)
  ) {
    return badRequest('Invalid morning ritual session');
  }

  try {
    saveMorningRitualSession(current.user.id, session);
    return Response.json({ok: true});
  } catch {
    return serverError('Could not save morning ritual session');
  }
}
