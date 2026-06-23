import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import {SCHEMA_SQL} from '../schema.ts';

function createDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

test('content studio schema creates governed content tables', () => {
  const db = createDb();
  const rows = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name LIKE 'content_%'
    ORDER BY name
  `).all() as Array<{name: string}>;

  assert.deepEqual(rows.map((row) => row.name), [
    'content_audit_events',
    'content_eval_cases',
    'content_governance_checks',
    'content_item_versions',
    'content_items',
  ]);
});

test('content items enforce source, risk, status and priority constraints', () => {
  const db = createDb();

  assert.throws(() => {
    db.prepare(`
      INSERT INTO content_items (
        id, title, content_type, journey, source, status, risk, locales_json, path,
        description, runtime_use_json, governance_json, registry_checksum
      ) VALUES (
        'bad-source', 'Bad', 'ui_copy', 'global', 'spreadsheet', 'published', 'low', '["en"]', 'x',
        'desc', '[]', '[]', 'abc'
      )
    `).run();
  }, /CHECK constraint failed/);

  assert.throws(() => {
    db.prepare(`
      INSERT INTO content_items (
        id, title, content_type, journey, source, status, risk, locales_json, path,
        migration_priority, description, runtime_use_json, governance_json, registry_checksum
      ) VALUES (
        'bad-priority', 'Bad', 'ui_copy', 'global', 'messages', 'published', 'low', '["en"]', 'x',
        9, 'desc', '[]', '[]', 'abc'
      )
    `).run();
  }, /CHECK constraint failed/);
});

test('content item versions cascade when a content item is deleted', () => {
  const db = createDb();
  db.prepare(`
    INSERT INTO content_items (
      id, title, content_type, journey, source, status, risk, locales_json, path,
      description, runtime_use_json, governance_json, registry_checksum
    ) VALUES (
      'messages-ui-copy', 'Messages', 'ui_copy', 'global', 'messages', 'published', 'medium', '["en","he"]', 'messages/{locale}.json',
      'desc', '[]', '[]', 'abc'
    )
  `).run();
  db.prepare(`
    INSERT INTO content_item_versions (id, content_item_id, checksum, item_json)
    VALUES ('version-1', 'messages-ui-copy', 'abc', '{}')
  `).run();

  db.prepare('DELETE FROM content_items WHERE id = ?').run('messages-ui-copy');

  const row = db.prepare('SELECT COUNT(*) AS count FROM content_item_versions').get() as {count: number};
  assert.equal(row.count, 0);
});

test('content audit events keep history when content item is deleted', () => {
  const db = createDb();
  db.prepare(`
    INSERT INTO content_items (
      id, title, content_type, journey, source, status, risk, locales_json, path,
      description, runtime_use_json, governance_json, registry_checksum
    ) VALUES (
      'audit-item', 'Audit', 'ui_copy', 'global', 'messages', 'published', 'low', '["en"]', 'messages/en.json',
      'desc', '[]', '[]', 'abc'
    )
  `).run();
  db.prepare(`
    INSERT INTO content_audit_events (id, content_item_id, event_type, metadata_json)
    VALUES ('audit-1', 'audit-item', 'registry_sync', '{}')
  `).run();

  db.prepare('DELETE FROM content_items WHERE id = ?').run('audit-item');

  const row = db.prepare('SELECT content_item_id FROM content_audit_events WHERE id = ?').get('audit-1') as {
    content_item_id: string | null;
  };
  assert.equal(row.content_item_id, null);
});
