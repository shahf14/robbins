import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {repairSchemaDrift} from './migrate.ts';
import {findMissingIncrementalColumns} from './schema-drift-repairs.ts';

test('repairSchemaDrift adds goals.create_idempotency_key on stale goals table', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  assert.ok(findMissingIncrementalColumns(db).some(
    (c) => c.table === 'goals' && c.column === 'create_idempotency_key'
  ));

  repairSchemaDrift(db);

  const cols = (db.pragma('table_info(goals)') as Array<{name: string}>).map((c) => c.name);
  assert.ok(cols.includes('create_idempotency_key'));
  assert.equal(findMissingIncrementalColumns(db).length, 0);
});

test('repairSchemaDrift adds formulation_sessions exploration columns', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE formulation_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  repairSchemaDrift(db);

  const cols = (db.pragma('table_info(formulation_sessions)') as Array<{name: string}>).map((c) => c.name);
  assert.ok(cols.includes('suggested_domain'));
  assert.ok(cols.includes('created_goal_id'));
  assert.ok(cols.includes('participant_gender'));
});

test('repairSchemaDrift is idempotent', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE goals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL)`);
  repairSchemaDrift(db);
  repairSchemaDrift(db);
  assert.equal(findMissingIncrementalColumns(db).length, 0);
});
