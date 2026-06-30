import {eveningResetSessionSchema} from '@/lib/api-body-schemas';
import {isLocale, type AppLocale} from '@/i18n/config';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  listEveningResetSessions,
  saveEveningResetSession,
} from '@/lib/db/repositories/evening-reset';
import {briefingFieldsFromSession} from '@/lib/evening-reset/briefing';
import {resolveTomorrowTakeaway} from '@/lib/evening-reset/tomorrow-takeaway';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import {badRequest, serverError} from '@/lib/api-response';
import {RitualSessionUncompleteError} from '@/lib/ritual-session-guards';
import {JSON_BODY_LIMITS, readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const sessions = listEveningResetSessions(current.user.id);
  return Response.json({sessions});
}

export async function POST(request: Request) {
  const body = await readAuthenticatedJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.sessionPost,
    schema: eveningResetSessionSchema,
  });
  if (!body.ok) return body.response;

  const session = body.data as EveningResetSession;

  try {
    const locale = isLocale(session.language) ? session.language : ('he' as AppLocale);
    const briefing = briefingFieldsFromSession(session);
    const takeaway = await resolveTomorrowTakeaway({locale, session, briefing});
    const enriched: EveningResetSession = {
      ...session,
      ...briefing,
      tomorrow_takeaway: takeaway.text,
    };
    saveEveningResetSession(body.user.id, enriched);
    return Response.json({ok: true, session: enriched, takeaway_source: takeaway.source});
  } catch (error) {
    if (error instanceof RitualSessionUncompleteError) {
      return Response.json({error: error.message}, {status: 409});
    }
    return serverError('Could not save evening reset session');
  }
}
