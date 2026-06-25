import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {repairSchemaDrift} from './migrate.ts';
import {
  deleteTriggerNeedsRepair,
  findMissingIncrementalColumns,
} from './schema-drift-repairs.ts';

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

test('repairSchemaDrift replaces stale delete triggers that reference health_phases', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE goals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
    CREATE TABLE milestones (id TEXT PRIMARY KEY, goal_id TEXT);
    CREATE TABLE daily_steps (id TEXT PRIMARY KEY, goal_id TEXT);
    CREATE TRIGGER trg_goals_delete_dependents
    AFTER DELETE ON goals
    BEGIN
      DELETE FROM milestones WHERE goal_id = OLD.id;
      DELETE FROM daily_steps WHERE goal_id = OLD.id;
      DELETE FROM health_phases WHERE goal_id = OLD.id;
    END
  `);

  assert.ok(
    deleteTriggerNeedsRepair(db, {
      name: 'trg_goals_delete_dependents',
      createSql: '',
      requiredFragments: ['weekly_goal_focus'],
    })
  );

  repairSchemaDrift(db);

  const sql = (
    db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?`)
      .get('trg_goals_delete_dependents') as {sql: string}
  ).sql;
  assert.ok(!sql.includes('health_phases'));
  assert.ok(sql.includes('weekly_goal_focus'));
});
