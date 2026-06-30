import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {listInsights} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

function parsePagination(request: Request): {limit: number; offset: number} {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? 50);
  const offsetRaw = Number(url.searchParams.get('offset') ?? 0);
  return {
    limit: Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50,
    offset: Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0,
  };
}

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {limit, offset} = parsePagination(request);

  try {
    const insights = await listInsights(undefined, current.user.id, {limit, offset});
    return jsonOk({insights, limit, offset});
  } catch (error) {
    return jsonError('Could not load insights.', 500, String(error));
  }
}
