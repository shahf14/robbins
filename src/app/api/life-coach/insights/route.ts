import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {listInsights} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  try {
    const insights = await listInsights(undefined, current.user.id);
    return jsonOk({insights});
  } catch (error) {
    return jsonError('Could not load insights.', 500, String(error));
  }
}
