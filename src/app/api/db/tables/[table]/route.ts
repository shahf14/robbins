import {requireAdmin} from '@/lib/db/admin-guard';
import {logAdminAccess} from '@/lib/db/admin-audit-log';
import {listTables, dbAll, dbGet} from '@/lib/db/sqlite';
import {jsonError} from '@/lib/life-coach/server';

const PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 120;
const MAX_TABLE_VIEW_OFFSET = 10_000;

function parsePage(value: string | null) {
  const parsed = parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function resolvePagination(pageParam: string | null): {
  page: number;
  offset: number;
  requestedPage: number;
  pageCapped: boolean;
} {
  const requestedPage = parsePage(pageParam);
  const requestedOffset = (requestedPage - 1) * PAGE_SIZE;
  const offset = Math.min(requestedOffset, MAX_TABLE_VIEW_OFFSET);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  return {
    page,
    offset,
    requestedPage,
    pageCapped: requestedOffset > MAX_TABLE_VIEW_OFFSET,
  };
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
    return jsonError('Table not found', 404);
  }

  const url = new URL(request.url);
  const {page, offset, requestedPage, pageCapped} = resolvePagination(url.searchParams.get('page'));
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);

  if (pageCapped) {
    console.warn(
      `[db-table] page offset capped at ${MAX_TABLE_VIEW_OFFSET} (requested page ${requestedPage}, table ${table}, user ${guard.user.id})`
    );
  }

  try {
    const tableRow = dbGet<{name: string}>(
      'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', table]
    );
    if (!tableRow) {
      return jsonError('Table not found', 404);
    }

    const colRows = dbAll<{name: string; type: string}>(
      'SELECT name, type FROM pragma_table_info(?)',
      [table]
    );
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

    dataSql += ` ORDER BY rowid DESC LIMIT ? OFFSET ?`;
    const dataParams = [...sqlParams, PAGE_SIZE, offset];

    const totalRow = dbGet<{total: number}>(countSql, sqlParams);
    const rows = dbAll(dataSql, dataParams);
    const total = totalRow?.total ?? 0;

    logAdminAccess({
      userId: guard.user.id,
      action: 'db_table_view',
      detail: JSON.stringify({table, page, search: search || null, total}),
      request,
    });

    return Response.json({
      table,
      columns,
      rows,
      total,
      page,
      page_size: PAGE_SIZE,
      total_pages: Math.ceil(total / PAGE_SIZE),
      ...(pageCapped
        ? {
            page_requested: requestedPage,
            page_capped: true,
            offset_max: MAX_TABLE_VIEW_OFFSET,
          }
        : {}),
    });
  } catch {
    return jsonError('Could not load table data.', 500);
  }
}
