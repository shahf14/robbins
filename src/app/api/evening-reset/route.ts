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

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const sessions = listEveningResetSessions(current.user.id);
  return Response.json({sessions});
}

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  let session: EveningResetSession;
  try {
    session = (await request.json()) as EveningResetSession;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!session?.id || typeof session.id !== 'string') {
    return badRequest('Invalid evening reset session');
  }

  try {
    const locale = isLocale(session.language) ? session.language : ('he' as AppLocale);
    const briefing = briefingFieldsFromSession(session);
    const takeaway = await resolveTomorrowTakeaway({locale, session, briefing});
    const enriched: EveningResetSession = {
      ...session,
      ...briefing,
      tomorrow_takeaway: takeaway.text,
    };
    saveEveningResetSession(current.user.id, enriched);
    return Response.json({ok: true, session: enriched, takeaway_source: takeaway.source});
  } catch {
    return serverError('Could not save evening reset session');
  }
}
