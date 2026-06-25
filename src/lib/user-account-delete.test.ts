import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import {initializeDatabaseConnection, setDbForTesting} from './db/sqlite.ts';
import {deleteUserAccountSync} from './life-coach/user-account-delete.ts';

test('deleteUserAccountSync repairs stale health_phases goal trigger via getDb', () => {
  const db = new Database(':memory:');
  initializeDatabaseConnection(db);
  db.exec(`
    DROP TRIGGER IF EXISTS trg_goals_delete_dependents;
    CREATE TRIGGER trg_goals_delete_dependents
    AFTER DELETE ON goals
    BEGIN
      DELETE FROM milestones WHERE goal_id = OLD.id;
      DELETE FROM daily_steps WHERE goal_id = OLD.id;
      DELETE FROM health_phases WHERE goal_id = OLD.id;
    END;
  `);
  setDbForTesting(db);

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)`).run(
    'user-stale',
    now,
    now
  );
  db.prepare(
    `INSERT INTO goals (id, user_id, domain, title, created_at, updated_at)
     VALUES (?, ?, 'health', 'Goal', ?, ?)`
  ).run('goal-stale', 'user-stale', now, now);

  deleteUserAccountSync('user-stale');

  assert.equal(
    (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE id = ?`).get('user-stale') as {c: number}).c,
    0
  );
  assert.equal(
    (db.prepare(`SELECT COUNT(*) AS c FROM goals WHERE user_id = ?`).get('user-stale') as {c: number}).c,
    0
  );

  setDbForTesting(null);
});

test('deleteUserAccountSync removes user goals and formulation sessions', () => {
  const db = new Database(':memory:');
  initializeDatabaseConnection(db);
  setDbForTesting(db);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`
  ).run('user-a', 'a@test.com', now, now);
  db.prepare(
    `INSERT INTO goals (id, user_id, domain, title, created_at, updated_at)
     VALUES (?, ?, 'health', 'Goal', ?, ?)`
  ).run('goal-a', 'user-a', now, now);
  db.prepare(
    `INSERT INTO formulation_sessions (id, user_id, locale, status, current_phase, created_goal_id, started_at, updated_at)
     VALUES (?, ?, 'he', 'completed', 'complete', ?, ?, ?)`
  ).run('form-a', 'user-a', 'goal-a', now, now);

  deleteUserAccountSync('user-a');

  assert.equal(
    (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE id = ?`).get('user-a') as {c: number}).c,
    0
  );
  assert.equal(
    (db.prepare(`SELECT COUNT(*) AS c FROM goals WHERE user_id = ?`).get('user-a') as {c: number}).c,
    0
  );
  assert.equal(
    (
      db.prepare(`SELECT COUNT(*) AS c FROM formulation_sessions WHERE user_id = ?`).get('user-a') as {
        c: number;
      }
    ).c,
    0
  );

  setDbForTesting(null);
});

test('deleteUserAccountSync clears skip_coach_adjustments without user FK', () => {
  const db = new Database(':memory:');
  initializeDatabaseConnection(db);
  setDbForTesting(db);

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)`).run(
    'user-b',
    now,
    now
  );
  db.prepare(
    `INSERT INTO skip_coach_adjustments (id, user_id, skip_date, coach_action, adjustment_json)
     VALUES (?, ?, '2026-01-01', 'shrink_tomorrow', '{}')`
  ).run('skip-a', 'user-b');

  deleteUserAccountSync('user-b');

  assert.equal(
    (
      db.prepare(`SELECT COUNT(*) AS c FROM skip_coach_adjustments WHERE user_id = ?`).get('user-b') as {
        c: number;
      }
    ).c,
    0
  );

  setDbForTesting(null);
});
