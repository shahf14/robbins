import {jsonError} from '@/lib/life-coach/server';
import {
  formatJerusalemLogDate,
  isValidLogDate,
} from '@/lib/client-logs';
import {readClientLogLines} from '@/lib/client-log-storage';
import {requireAdmin} from '@/lib/db/admin-guard';

const DEFAULT_LOG_LIMIT = 200;
const MAX_LOG_LIMIT = 500;

function parseLogLimit(value: string | null): number {
  const raw = Number(value ?? DEFAULT_LOG_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LOG_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LOG_LIMIT);
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const {searchParams} = new URL(request.url);
  const date = searchParams.get('date')?.trim() || formatJerusalemLogDate();
  const limit = parseLogLimit(searchParams.get('limit'));

  if (!isValidLogDate(date)) {
    return jsonError('Invalid date. Use YYYY-MM-DD.', 400);
  }

  try {
    const lines = await readClientLogLines(date, limit);
    return Response.json({lines, limit, limit_max: MAX_LOG_LIMIT});
  } catch {
    return jsonError('Could not read logs.', 500);
  }
}
