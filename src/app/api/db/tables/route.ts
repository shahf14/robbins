import {requireAdmin} from '@/lib/db/admin-guard';
import {listTables, tableRowCount} from '@/lib/db/sqlite';
import {serverError} from '@/lib/api-response';

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const tables = listTables();
    const result = tables.map((name) => ({
      name,
      row_count: tableRowCount(name),
    }));
    return Response.json({tables: result});
  } catch {
    return serverError('Could not list database tables.');
  }
}
