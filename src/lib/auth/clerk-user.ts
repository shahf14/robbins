import {auth, currentUser} from '@clerk/nextjs/server';
import {isClerkConfigured} from '@/lib/auth/clerk-config';
import {ensureUserProfile} from '@/lib/life-coach/user-profile-repository';
import {dbGet, dbRun} from '@/lib/db/sqlite';
import {randomUUID} from 'crypto';

export {isClerkConfigured} from '@/lib/auth/clerk-config';

export function isClerkEnabled(): boolean {
  return isClerkConfigured();
}

type AuthUser = {id: string; email: string};

export async function resolveClerkDbUser(): Promise<AuthUser | null> {
  const {userId} = await auth();
  if (!userId) return null;

  const existing = dbGet<{id: string; email: string | null}>(
    `SELECT id, email FROM users WHERE clerk_id = ?`,
    [userId]
  );

  if (existing) {
    return {id: existing.id, email: existing.email ?? ''};
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    '';

  const id = randomUUID();
  const now = new Date().toISOString();

  dbRun(
    `INSERT INTO users (id, email, clerk_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, email || null, userId, now, now]
  );

  await ensureUserProfile({id, email});

  return {id, email};
}

export async function upsertClerkUserFromWebhook(input: {
  clerkId: string;
  email?: string | null;
  deleted?: boolean;
}): Promise<void> {
  if (input.deleted) {
    const row = dbGet<{id: string}>(`SELECT id FROM users WHERE clerk_id = ?`, [input.clerkId]);
    if (row) {
      dbRun(`DELETE FROM users WHERE id = ?`, [row.id]);
    }
    return;
  }

  const existing = dbGet<{id: string}>(
    `SELECT id FROM users WHERE clerk_id = ?`,
    [input.clerkId]
  );

  if (existing) {
    if (input.email) {
      dbRun(`UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?`, [
        input.email,
        existing.id,
      ]);
    }
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO users (id, email, clerk_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.email ?? null, input.clerkId, now, now]
  );
  await ensureUserProfile({id, email: input.email ?? undefined});
}
