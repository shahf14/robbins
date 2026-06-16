import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {isIsoDate, jsonError, jsonOk, startOfToday} from '@/lib/life-coach/server';
import {resolveDailyFocusContext} from '@/lib/daily-focus-context';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date') || startOfToday();

  if (!isIsoDate(date)) {
    return jsonError('Invalid date. Expected YYYY-MM-DD.', 400);
  }

  try {
    const dailyFocus = await resolveDailyFocusContext(current.user.id, date);
    return jsonOk({dailyFocus});
  } catch (error) {
    return jsonError('Could not load daily focus.', 500, String(error));
  }
}
