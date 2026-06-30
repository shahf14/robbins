import {getDb} from './sqlite';

export type AdminAuditAction =
  | 'db_tables_list'
  | 'db_table_view'
  | 'db_query'
  | 'db_sync';

function ensureAdminAuditTable(): void {
  getDb()
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_audit_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id TEXT NOT NULL,
         action TEXT NOT NULL,
         detail TEXT,
         ip TEXT,
         user_agent TEXT,
         created_at INTEGER NOT NULL
       )`
    )
    .run();
}

export function logAdminAccess(opts: {
  userId: string;
  action: AdminAuditAction;
  detail?: string;
  request?: Request;
}): void {
  ensureAdminAuditTable();

  const ip =
    opts.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    opts.request?.headers.get('x-real-ip')?.trim() ??
    null;
  const userAgent = opts.request?.headers.get('user-agent')?.slice(0, 512) ?? null;

  getDb()
    .prepare(
      `INSERT INTO admin_audit_logs (user_id, action, detail, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      opts.userId,
      opts.action,
      opts.detail?.slice(0, 2000) ?? null,
      ip,
      userAgent,
      Date.now()
    );
}
