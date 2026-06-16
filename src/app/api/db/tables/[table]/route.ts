import {requireAdmin} from '@/lib/db/admin-guard';
import {listTables, dbAll, dbGet, getDb} from '@/lib/db/sqlite';
import {serverError, notFound} from '@/lib/api-response';

const PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 120;

function parsePage(value: string | null) {
  const parsed = parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export async function GET(
  request: Request,
  {params}: {params: Promise<{table: string}>}
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const {table} = await params;

  // Whitelist: only tables that exist in the DB
  const allowed = listTables();
  if (!allowed.includes(table)) {
    return notFound('Table not found');
  }

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get('page'));
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);

  const offset = (page - 1) * PAGE_SIZE;

  try {
    // Get column names
    const colRows = getDb().pragma(`table_info("${table}")`) as Array<{name: string; type: string}>;
    const columns = colRows.map((c) => ({name: c.name, type: c.type}));

    // Count rows (with optional basic search on first text column)
    const textCol = colRows.find((c) => c.type.toLowerCase().includes('text'))?.name;
    let countSql = `SELECT COUNT(*) as total FROM "${table}"`;
    let dataSql = `SELECT * FROM "${table}"`;
    const sqlParams: unknown[] = [];

    if (search && textCol) {
      const where = ` WHERE "${textCol}" LIKE ?`;
      countSql += where;
      dataSql += where;
      sqlParams.push(`%${search}%`);
    }

    dataSql += ` ORDER BY rowid DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

    const totalRow = dbGet<{total: number}>(countSql, sqlParams);
    const rows = dbAll(dataSql, sqlParams);
    const total = totalRow?.total ?? 0;

    return Response.json({
      table,
      columns,
      rows,
      total,
      page,
      page_size: PAGE_SIZE,
      total_pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch {
    return serverError('Could not load table data.');
  }
}
