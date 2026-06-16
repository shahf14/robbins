import {getDb} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {AffirmationItem, IdentityOption} from '@/lib/morning-ritual-types';

type RitualContentType = 'affirmation' | 'identity';

export function listRitualContent(userId: string) {
  const rows = getDb().prepare(
    `SELECT content_type, item_json
       FROM ritual_content
      WHERE user_id = ?
      ORDER BY created_at DESC`
  ).all(userId) as Array<{content_type: RitualContentType; item_json: string}>;

  const affirmations: AffirmationItem[] = [];
  const identities: IdentityOption[] = [];

  for (const row of rows) {
    if (row.content_type === 'affirmation') {
      const item = parseJsonOr<AffirmationItem | null>(row.item_json, null);
      if (item) affirmations.push(item);
    } else {
      const item = parseJsonOr<IdentityOption | null>(row.item_json, null);
      if (item) identities.push(item);
    }
  }

  return {affirmations, identities};
}

export function replaceAffirmations(userId: string, items: AffirmationItem[]) {
  replaceContent(userId, 'affirmation', items);
}

export function replaceIdentities(userId: string, items: IdentityOption[]) {
  replaceContent(userId, 'identity', items);
}

function replaceContent(
  userId: string,
  contentType: RitualContentType,
  items: Array<AffirmationItem | IdentityOption>
) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO ritual_content
      (id, user_id, content_type, item_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    db.prepare(`DELETE FROM ritual_content WHERE user_id = ? AND content_type = ?`)
      .run(userId, contentType);

    for (const item of items) {
      const createdAt = item.createdAt || new Date().toISOString();
      insert.run(item.id, userId, contentType, JSON.stringify(item), createdAt, new Date().toISOString());
    }
  })();
}
