import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import Database from 'better-sqlite3';
import {initializeDatabaseConnection, setDbForTesting} from './db/sqlite.ts';

const here = dirname(fileURLToPath(import.meta.url));

const OVERLAP_SQL = `SELECT COUNT(*) as count FROM weekly_reviews
 WHERE user_id = ?
   AND period_start IS NOT NULL
   AND period_end IS NOT NULL
   AND period_start < ?
   AND period_end > ?`;

function hasOverlappingWeeklyReview(
  db: Database.Database,
  userId: string,
  periodStart: string,
  periodEnd: string
): boolean {
  const row = db.prepare(OVERLAP_SQL).get(userId, periodEnd, periodStart) as {count: number};
  return (row?.count ?? 0) > 0;
}

function withMemoryDb(run: (db: Database.Database) => void) {
  const db = new Database(':memory:');
  initializeDatabaseConnection(db);
  setDbForTesting(db);
  try {
    run(db);
  } finally {
    setDbForTesting(null);
    db.close();
  }
}

function seedWeeklyReview(
  db: Database.Database,
  userId: string,
  id: string,
  periodStart: string,
  periodEnd: string
) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)`).run(
    userId,
    now,
    now
  );
  db.prepare(
    `INSERT INTO ai_insights (id, user_id, insight_type, content, metadata, created_at)
     VALUES (?, ?, 'weekly_review', '', '{}', ?)`
  ).run(id, userId, now);
  db.prepare(
    `INSERT INTO weekly_reviews (id, user_id, period_start, period_end, summary, created_at)
     VALUES (?, ?, ?, ?, '', ?)`
  ).run(id, userId, periodStart, periodEnd, now);
}

test('weekly review overlap query catches shifted trailing windows', () => {
  withMemoryDb((db) => {
    seedWeeklyReview(db, 'user-1', 'review-1', '2026-06-18', '2026-06-24');

    assert.equal(hasOverlappingWeeklyReview(db, 'user-1', '2026-06-18', '2026-06-24'), true);
    assert.equal(hasOverlappingWeeklyReview(db, 'user-1', '2026-06-19', '2026-06-25'), true);
    assert.equal(hasOverlappingWeeklyReview(db, 'user-1', '2026-06-25', '2026-07-01'), false);
  });
});

test('hasWeeklyReviewForPeriod uses overlap SQL not exact period match', () => {
  const source = readFileSync(
    join(here, 'life-coach', 'reflection-insight-repository.ts'),
    'utf8'
  );
  assert.match(source, /period_start < \?/);
  assert.match(source, /period_end > \?/);
  assert.doesNotMatch(source, /period_start = \? AND period_end = \?/);
});
