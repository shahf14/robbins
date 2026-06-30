import {jsonError} from '@/lib/life-coach/server';
import {requireAdmin} from '@/lib/db/admin-guard';
import {logAdminAccess} from '@/lib/db/admin-audit-log';
import {getDb} from '@/lib/db/sqlite';
import {JSON_BODY_LIMITS, readJsonBody} from '@/lib/read-json-body';
import {z} from 'zod';

const MAX_QUERY_ROWS = 500;

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const parsed = await readJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.defaultApi,
    schema: z.object({sql: z.string().max(16_384)}),
  });
  if (!parsed.ok) return parsed.response;

  const sql = parsed.data.sql.trim();
  if (!sql) return jsonError('sql is required', 400);

  const start = Date.now();

  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (!stmt.readonly) {
      return jsonError('Only read-only statements are allowed in the query editor.', 400);
    }

    let rows: unknown[] = [];
    let columns: string[] = [];
    if (stmt.reader) {
      for (const row of stmt.iterate()) {
        if (columns.length === 0 && row && typeof row === 'object') {
          columns = Object.keys(row as object);
        }
        rows.push(row);
        if (rows.length >= MAX_QUERY_ROWS) break;
      }
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
    return jsonError('Query could not be executed.', 400, undefined, {
      extra: {duration_ms: Date.now() - start},
    });
  } finally {
    logAdminAccess({
      userId: guard.user.id,
      action: 'db_query',
      detail: sql.slice(0, 500),
      request,
    });
  }
}
