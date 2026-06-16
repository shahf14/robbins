import type {AppLocale} from '@/i18n/config';
import {buildSkipCoachAdjustment} from '@/lib/skip-coach-loop';
import {saveSkipCoachAdjustment} from '@/lib/skip-coach-loop/repository';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {getUserParticipantProfile} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, resolveLocale, startOfToday} from '@/lib/life-coach/server';
import {skipCoachAdjustmentInputSchema} from '@/lib/life-coach/schemas';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsed = skipCoachAdjustmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid skip coach payload.', 400, parsed.error.flatten());
  }

  try {
    const profile = await getUserParticipantProfile(current.user.id);
    const locale = resolveLocale(
      (typeof body === 'object' && body && 'locale' in body
        ? (body as {locale?: string}).locale
        : profile.preferred_language) as AppLocale | undefined
    );
    const currentWindow = (profile.preferred_action_window ?? 'flexible') as PreferredActionWindow;
    const adjustment = buildSkipCoachAdjustment(
      parsed.data.coach_action,
      locale,
      currentWindow
    );

    const saved = saveSkipCoachAdjustment(current.user.id, {
      skip_date: parsed.data.skip_date ?? startOfToday(),
      step_id: parsed.data.step_id ?? null,
      goal_id: parsed.data.goal_id ?? null,
      blocker_reason: parsed.data.blocker_reason ?? null,
      coach_action: parsed.data.coach_action,
      adjustment,
    });

    return jsonOk({adjustment: saved});
  } catch (error) {
    return jsonError('Could not save skip coach adjustment.', 500, String(error));
  }
}
