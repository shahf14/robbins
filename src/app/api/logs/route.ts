import {badRequest, serverError} from '@/lib/api-response';
import {
  formatJerusalemLogDate,
  isValidLogDate,
  readClientLogLines,
} from '@/lib/client-logs';
import {requireAdmin} from '@/lib/db/admin-guard';

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const {searchParams} = new URL(request.url);
  const date = searchParams.get('date')?.trim() || formatJerusalemLogDate();
  const limit = Number(searchParams.get('limit') ?? 200);

  if (!isValidLogDate(date)) {
    return badRequest('Invalid date. Use YYYY-MM-DD.');
  }

  if (!Number.isFinite(limit) || limit < 1) {
    return badRequest('Invalid limit.');
  }

  try {
    const lines = await readClientLogLines(date, limit);
    return Response.json({lines});
  } catch {
    return serverError('Could not read logs.');
  }
}
