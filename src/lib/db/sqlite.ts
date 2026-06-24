import path from 'path';
import Database from 'better-sqlite3';
import {repairSchemaDrift, runMigrations} from './migrate.ts';
import {SCHEMA_SQL} from './schema.ts';

// The DB file lives at <project-root>/data/life-coach.db
const DB_PATH = path.join(process.cwd(), 'data', 'life-coach.db');

let _db: Database.Database | null = null;

/**
 * Apply pragmas, the base schema, and pending migrations to a connection.
 * Exported so tests can initialize an in-memory database identically to
 * production (see `setDbForTesting`).
 */
export function initializeDatabaseConnection(db: Database.Database): void {
  // Performance / safety pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  // Wait up to 5s for a competing writer instead of failing immediately with
  // SQLITE_BUSY (matters when a second worker boots against the same file).
  db.pragma('busy_timeout = 5000');

  // Apply schema (all CREATE TABLE IF NOT EXISTS — safe to run every time)
  db.exec(SCHEMA_SQL);

  // Versioned, idempotent migrations (gated by PRAGMA user_version).
  runMigrations(db);
}

/**
 * Test seam: inject an already-initialized database (e.g.
 * `const db = new Database(':memory:'); initializeDatabaseConnection(db);`)
 * so repository code that calls `getDb()` operates against it. Pass `null` to
 * reset back to the lazily-opened file database.
 */
export function setDbForTesting(db: Database.Database | null): void {
  _db = db;
}

export function getDb(): Database.Database {
  if (_db) {
    repairSchemaDrift(_db);
    return _db;
  }

  _db = new Database(DB_PATH);
  initializeDatabaseConnection(_db);

  return _db;
}

/** Convenience: run a SELECT and return all rows */
export function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

/** Convenience: run a SELECT and return one row */
export function dbGet<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

/** Convenience: run INSERT / UPDATE / DELETE */
export function dbRun(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

/** Return all table names in the DB (excluding sqlite internal tables) */
export function listTables(): string[] {
  const rows = dbAll<{name: string}>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return rows.map((r) => r.name);
}

/** Return row count for a specific table */
export function tableRowCount(table: string): number {
  // table name comes from listTables() so it is safe — still whitelist-validated in the route
  const row = dbGet<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM "${table}"`);
  return row?.['COUNT(*)'] ?? 0;
}
