import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import Database from 'better-sqlite3';
import {initializeDatabaseConnection, setDbForTesting} from './db/sqlite.ts';
import {checkAndIncrementRateLimit} from './ai-rate-limit-store.ts';

function withMemoryDb(run: () => void) {
  const db = new Database(':memory:');
  initializeDatabaseConnection(db);
  setDbForTesting(db);
  try {
    run();
  } finally {
    setDbForTesting(null);
    db.close();
  }
}

test('checkAndIncrementRateLimit allows requests up to the limit then blocks', () => {
  withMemoryDb(() => {
    const opts = {
      action: 'test-action',
      userId: 'user-1',
      limit: 3,
      windowMs: 60_000,
      globalLimit: 50,
      globalWindowMs: 60_000,
    };

    assert.deepEqual(checkAndIncrementRateLimit(opts), {ok: true});
    assert.deepEqual(checkAndIncrementRateLimit(opts), {ok: true});
    assert.deepEqual(checkAndIncrementRateLimit(opts), {ok: true});

    const blocked = checkAndIncrementRateLimit(opts);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.limit, 3);
    }
  });
});

test('checkAndIncrementRateLimit resets count after the window expires', () => {
  withMemoryDb(() => {
    const opts = {
      action: 'expiry-action',
      userId: 'user-2',
      limit: 1,
      windowMs: 1_000,
      globalLimit: 50,
      globalWindowMs: 60_000,
      now: Date.now(),
    };

    assert.deepEqual(checkAndIncrementRateLimit(opts), {ok: true});
    assert.equal(checkAndIncrementRateLimit(opts).ok, false);

    assert.deepEqual(
      checkAndIncrementRateLimit({...opts, now: opts.now! + 2_000}),
      {ok: true}
    );
  });
});

test('rate limit store uses atomic increment SQL', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'ai-rate-limit-store.ts'), 'utf8');
  assert.match(source, /count \+ 1/);
  assert.match(source, /RETURNING count, reset_at/);
  assert.match(source, /BEGIN IMMEDIATE/);
});
