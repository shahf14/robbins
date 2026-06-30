import {generateDailyCoachMessage} from '@/lib/daily-coach-message';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonOk, isIsoDate, parseLocaleQueryParam, startOfToday} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const {searchParams} = new URL(request.url);
  const date = searchParams.get('date') ?? startOfToday();
  if (!isIsoDate(date)) {
    return jsonError('Invalid date. Expected YYYY-MM-DD.', 400);
  }
  const localeResult = parseLocaleQueryParam(searchParams.get('locale'));
  if (!localeResult.ok) return localeResult.response;
  const locale = localeResult.locale;

  try {
    const message = await generateDailyCoachMessage(current.user.id, date, locale);
    return jsonOk({message});
  } catch (error) {
    return jsonError('Could not generate daily coach message.', 500, String(error));
  }
}
