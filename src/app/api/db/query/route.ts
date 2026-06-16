import {requireAdmin} from '@/lib/db/admin-guard';
import {getDb} from '@/lib/db/sqlite';
import {badRequest} from '@/lib/api-response';

const MAX_QUERY_ROWS = 500;

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: {sql?: string};
  try {
    body = (await request.json()) as {sql?: string};
  } catch {
    return badRequest('Invalid JSON');
  }

  const sql = (body.sql ?? '').trim();
  if (!sql) return badRequest('sql is required');

  const start = Date.now();

  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (!stmt.readonly) {
      return badRequest('Only read-only statements are allowed in the query editor.');
    }

    let rows: unknown[] = [];
    let columns: string[] = [];
    if (stmt.reader) {
      rows = (stmt.all() as unknown[]).slice(0, MAX_QUERY_ROWS);
      columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
    } else {
      stmt.run();
    }

    return Response.json({
      columns,
      rows,
      rows_affected: null,
      duration_ms: Date.now() - start,
    });
  } catch {
    return Response.json({
      error: 'Query could not be executed.',
      duration_ms: Date.now() - start,
    }, {status: 400});
  }
}
