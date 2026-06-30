import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {countInsights, listInsights, MAX_INSIGHTS_LIST_OFFSET} from '@/lib/life-coach/repository';
import {toAiCoachingInsightsResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonOk} from '@/lib/life-coach/server';
import {offsetCapMetadata, parseLimitOffset} from '@/lib/list-pagination';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {limit, offset, requestedOffset, offsetCapped} = parseLimitOffset(
    new URL(request.url).searchParams,
    {defaultLimit: 50, maxLimit: 200, maxOffset: MAX_INSIGHTS_LIST_OFFSET}
  );

  if (offsetCapped) {
    console.warn(
      `[insights] offset capped at ${MAX_INSIGHTS_LIST_OFFSET} (requested ${requestedOffset}, user ${current.user.id})`
    );
  }

  try {
    const [insights, total_count] = await Promise.all([
      listInsights(undefined, current.user.id, {limit, offset}),
      countInsights(undefined, current.user.id),
    ]);
    return jsonOk({
      insights: toAiCoachingInsightsResponse(insights),
      limit,
      offset,
      total_count,
      ...offsetCapMetadata(requestedOffset, offsetCapped, MAX_INSIGHTS_LIST_OFFSET),
    });
  } catch (error) {
    return jsonError('Could not load insights.', 500, String(error));
  }
}
