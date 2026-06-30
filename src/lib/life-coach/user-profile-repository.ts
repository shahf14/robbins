import type {AiPersonalizationSummary} from '@/lib/ai-personalization-summary';
import {dbGet, dbRun} from '@/lib/db/sqlite';
import {
  normalizeLifeContextSelection,
  serializeLifeContextStatuses,
} from '@/lib/formulation/life-context';
import {LIFE_DOMAINS} from './types';
import type {LifeContextStatus, LifeDomain, UserProfile} from './types';
import {rowToUserProfile} from './repository-mappers';

export async function ensureUserProfile(
  user: {id: string; email?: string | null},
  input?: Partial<Pick<UserProfile, 'preferred_language' | 'timezone'>>
): Promise<UserProfile> {
  ensureUserProfileSync(user, input);
  const row = dbGet<Record<string, unknown>>(`SELECT * FROM users WHERE id = ?`, [user.id]);
  return rowToUserProfile(user.id, row, new Date().toISOString());
}

export function ensureUserProfileSync(
  user: {id: string; email?: string | null},
  input?: Partial<Pick<UserProfile, 'preferred_language' | 'timezone'>>
): void {
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO users (id, email, language, timezone, created_at, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       email = COALESCE(excluded.email, users.email),
       language = CASE WHEN ? IS NOT NULL THEN excluded.language ELSE users.language END,
       timezone = CASE WHEN ? IS NOT NULL THEN excluded.timezone ELSE users.timezone END,
       updated_at = excluded.updated_at`,
    [
      user.id,
      user.email ?? null,
      input?.preferred_language ?? 'en',
      input?.timezone ?? 'UTC',
      now,
      now,
      input?.preferred_language ?? null,
      input?.timezone ?? null,
    ]
  );
}

/** Deletes the user and all dependent records (explicit wipe — safe on all DB shapes). */
export async function deleteUserAccount(userId: string): Promise<void> {
  const {deleteUserAccountSync} = await import('@/lib/life-coach/user-account-delete');
  deleteUserAccountSync(userId);
}

export async function getUserParticipantProfile(userId: string): Promise<UserProfile> {
  const row = dbGet<Record<string, unknown>>(`SELECT * FROM users WHERE id = ?`, [userId]);
  return rowToUserProfile(userId, row, new Date().toISOString());
}

/**
 * Synchronous core of {@link updateUserParticipantProfile} — use this when the
 * profile write must participate in a caller's better-sqlite3 transaction.
 */
export function updateUserParticipantProfileSync(
  userId: string,
  input: {
    gender?: string | null;
    age?: number | null;
    life_context_statuses?: LifeContextStatus[];
    life_context_note?: string | null;
    wake_time?: string | null;
    sleep_time?: string | null;
    preferred_action_window?: import('@/lib/user-preferences').PreferredActionWindow | null;
    coaching_style?: import('@/lib/user-preferences').CoachingStyle | null;
    family_status?: import('@/lib/user-preferences').FamilyStatus | null;
    physical_considerations?: import('@/lib/user-preferences').PhysicalConsideration[] | null;
  }
): void {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.gender !== undefined) {
    sets.push('gender = ?');
    params.push(input.gender);
  }
  if (input.age !== undefined) {
    sets.push('age = ?');
    params.push(input.age);
  }
  if (input.life_context_statuses !== undefined) {
    const normalized = normalizeLifeContextSelection(input.life_context_statuses);
    sets.push('life_context_status = ?');
    params.push(
      normalized.length > 0 ? serializeLifeContextStatuses(normalized) : null
    );
  }
  if (input.life_context_note !== undefined) {
    sets.push('life_context_note = ?');
    params.push(input.life_context_note?.trim().slice(0, 200) || null);
  }
  if (input.wake_time !== undefined) {
    sets.push('wake_time = ?');
    params.push(input.wake_time);
  }
  if (input.sleep_time !== undefined) {
    sets.push('sleep_time = ?');
    params.push(input.sleep_time);
  }
  if (input.preferred_action_window !== undefined) {
    sets.push('preferred_action_window = ?');
    params.push(input.preferred_action_window);
  }
  if (input.coaching_style !== undefined) {
    sets.push('coaching_style = ?');
    params.push(input.coaching_style);
  }
  if (input.family_status !== undefined) {
    sets.push('family_status = ?');
    params.push(input.family_status);
  }
  if (input.physical_considerations !== undefined) {
    sets.push('physical_considerations = ?');
    params.push(
      input.physical_considerations !== null && input.physical_considerations.length > 0
        ? JSON.stringify(input.physical_considerations)
        : null
    );
  }

  params.push(userId);
  dbRun(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function updateUserParticipantProfile(
  userId: string,
  input: Parameters<typeof updateUserParticipantProfileSync>[1]
): Promise<void> {
  updateUserParticipantProfileSync(userId, input);
}

export type OnboardingServerStatus = {
  completedAt: string | null;
  primaryDomain: LifeDomain | null;
};

function parseOnboardingPrimaryDomain(value: unknown): LifeDomain | null {
  if (typeof value !== 'string') return null;
  return LIFE_DOMAINS.includes(value as LifeDomain) ? (value as LifeDomain) : null;
}

export async function getOnboardingServerStatus(userId: string): Promise<OnboardingServerStatus> {
  const row = dbGet<Record<string, unknown>>(
    `SELECT onboarding_completed_at, onboarding_primary_domain FROM users WHERE id = ?`,
    [userId]
  );
  return {
    completedAt:
      typeof row?.onboarding_completed_at === 'string' ? row.onboarding_completed_at : null,
    primaryDomain: parseOnboardingPrimaryDomain(row?.onboarding_primary_domain),
  };
}

export async function markUserOnboardingComplete(
  userId: string,
  primaryDomain?: LifeDomain | null,
  aiPersonalizationSummary?: AiPersonalizationSummary | null
): Promise<void> {
  const now = new Date().toISOString();
  if (aiPersonalizationSummary) {
    dbRun(
      `UPDATE users SET
        onboarding_completed_at = COALESCE(onboarding_completed_at, ?),
        onboarding_primary_domain = COALESCE(?, onboarding_primary_domain),
        ai_personalization_summary = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        now,
        primaryDomain ?? null,
        JSON.stringify(aiPersonalizationSummary),
        now,
        userId,
      ]
    );
    return;
  }

  dbRun(
    `UPDATE users SET
      onboarding_completed_at = COALESCE(onboarding_completed_at, ?),
      onboarding_primary_domain = COALESCE(?, onboarding_primary_domain),
      updated_at = ?
    WHERE id = ?`,
    [now, primaryDomain ?? null, now, userId]
  );
}

export async function isUserOnboardingComplete(userId: string): Promise<boolean> {
  const status = await getOnboardingServerStatus(userId);
  if (status.completedAt) return true;

  const countRow = dbGet<{c: number}>(
    `SELECT COUNT(*) as c FROM goals WHERE user_id = ? AND status IN ('active', 'completed')`,
    [userId]
  );
  if (Number(countRow?.c ?? 0) > 0) {
    await markUserOnboardingComplete(userId, status.primaryDomain);
    return true;
  }
  return false;
}
