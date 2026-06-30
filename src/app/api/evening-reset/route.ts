import {eveningResetSessionSchema} from '@/lib/api-body-schemas';
import {isLocale, type AppLocale} from '@/i18n/config';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  countEveningResetSessions,
  DEFAULT_RITUAL_SESSION_LIMIT,
  getEveningResetSessionById,
  listEveningResetSessions,
  MAX_RITUAL_SESSION_LIMIT,
  saveEveningResetSession,
} from '@/lib/db/repositories/evening-reset';
import {briefingFieldsFromSession} from '@/lib/evening-reset/briefing';
import {resolveTomorrowTakeaway} from '@/lib/evening-reset/tomorrow-takeaway';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import {jsonError, jsonMutation, jsonOk} from '@/lib/life-coach/server';
import {offsetCapMetadata, parseLimitOffset} from '@/lib/list-pagination';
import {RitualSessionUncompleteError} from '@/lib/ritual-session-guards';
import {JSON_BODY_LIMITS, readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const {limit, offset, requestedOffset, offsetCapped} = parseLimitOffset(
    new URL(request.url).searchParams,
    {defaultLimit: DEFAULT_RITUAL_SESSION_LIMIT, maxLimit: MAX_RITUAL_SESSION_LIMIT}
  );

  const sessions = listEveningResetSessions(current.user.id, {limit, offset});
  const total_count = countEveningResetSessions(current.user.id);

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
    schema: eveningResetSessionSchema,
  });
  if (!body.ok) return body.response;

  const session = body.data as EveningResetSession;

  try {
    const existing = getEveningResetSessionById(body.user.id, session.id);
    if (existing?.tomorrow_takeaway?.trim()) {
      return jsonMutation({session: existing, takeaway_source: 'stored'});
    }

    const locale = isLocale(session.language) ? session.language : ('he' as AppLocale);
    const briefing = briefingFieldsFromSession(session);
    const takeaway = await resolveTomorrowTakeaway({locale, session, briefing});
    const enriched: EveningResetSession = {
      ...session,
      ...briefing,
      tomorrow_takeaway: takeaway.text,
    };
    saveEveningResetSession(body.user.id, enriched);
    return jsonMutation({session: enriched, takeaway_source: takeaway.source});
  } catch (error) {
    if (error instanceof RitualSessionUncompleteError) {
      return jsonError(error.message, 409);
    }
    return jsonError('Could not save evening reset session', 500);
  }
}
