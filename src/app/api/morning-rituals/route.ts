/**
 * GET  /api/morning-rituals  → list the current user's ritual sessions
 * POST /api/morning-rituals  → save (insert/replace) one ritual session
 *
 * Backed purely by the local SQLite DB.
 */
import {morningRitualSessionSchema} from '@/lib/api-body-schemas';
import {jsonError, jsonMutation, jsonOk} from '@/lib/life-coach/server';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  countMorningRitualSessions,
  DEFAULT_RITUAL_SESSION_LIMIT,
  listMorningRitualSessions,
  MAX_RITUAL_SESSION_LIMIT,
  saveMorningRitualSession,
} from '@/lib/db/repositories/morning-rituals';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import {RitualSessionUncompleteError} from '@/lib/ritual-session-guards';
import {JSON_BODY_LIMITS, readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';
import {offsetCapMetadata, parseLimitOffset} from '@/lib/list-pagination';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const {limit, offset, requestedOffset, offsetCapped} = parseLimitOffset(
    new URL(request.url).searchParams,
    {defaultLimit: DEFAULT_RITUAL_SESSION_LIMIT, maxLimit: MAX_RITUAL_SESSION_LIMIT}
  );

  const sessions = listMorningRitualSessions(current.user.id, {limit, offset});
  const total_count = countMorningRitualSessions(current.user.id);

  return jsonOk({
    sessions,
    limit,
    offset,
    total_count,
    ...offsetCapMetadata(requestedOffset, offsetCapped),
  });
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
    return jsonMutation();
  } catch (error) {
    if (error instanceof RitualSessionUncompleteError) {
      return jsonError(error.message, 409);
    }
    return jsonError('Could not save morning ritual session', 500);
  }
}
