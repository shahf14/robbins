import {requireAdmin} from '@/lib/db/admin-guard';
import {logAdminAccess} from '@/lib/db/admin-audit-log';
import {listTables, tableRowCount} from '@/lib/db/sqlite';
import {jsonError} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const tables = listTables();
    const result = tables.map((name) => ({
      name,
      row_count: tableRowCount(name),
    }));
    logAdminAccess({
      userId: guard.user.id,
      action: 'db_tables_list',
      detail: `${result.length} tables`,
      request,
    });
    return Response.json({tables: result});
  } catch {
    return jsonError('Could not list database tables.', 500);
  }
}
