import {SCHEDULE_REMINDER_KEYS} from '@/lib/schedule-reminders';
import {
  DOMAIN_GOAL_DRAFT_KEY,
  HEALTH_GOAL_DRAFT_KEY,
  ONBOARDING_DRAFT_KEY,
} from '@/lib/draft-storage-keys';
import {getLocalAuthHeaders} from '@/lib/auth/client-headers';

const USER_LOCAL_STORAGE_KEYS = [
  'onboarding_v2',
  'onboarding_wizard_v1',
  ONBOARDING_DRAFT_KEY,
  'user_preferences',
  'morning_ritual_affirmations',
  'morning_ritual_identities',
  'morning_ritual_sessions',
  'daily_checkins',
  'daily_checkin_draft',
  'onboarding_complete',
  'evening_reset_sessions',
  'formulation_session_draft',
  HEALTH_GOAL_DRAFT_KEY,
  DOMAIN_GOAL_DRAFT_KEY,
  'robbins_comeback_chain',
  'robbins_goal_contracts',
  'robbins_friction_skips',
  'robbins_home_how_it_works_collapsed',
  'home_focus_draft',
  'profile_completion_prompts_v1',
  'profile_completion_prompts_v2',
  'clarification_suggestion_v1',
  'preferred_language',
  'daily_reminder',
  'daily_reminder_last',
  ...Object.values(SCHEDULE_REMINDER_KEYS),
] as const;

const USER_LOCAL_STORAGE_PREFIXES = [
  'robbins_feature_seen_',
  'robbins_feature_hint_dismissed_',
] as const;

export type UserResetFailureKind = 'auth' | 'server' | 'offline';

export class UserResetError extends Error {
  readonly kind: UserResetFailureKind;
  readonly status?: number;

  constructor(kind: UserResetFailureKind, message: string, status?: number) {
    super(message);
    this.name = 'UserResetError';
    this.kind = kind;
    this.status = status;
  }
}

function localAuthHeaders(): HeadersInit {
  return getLocalAuthHeaders();
}

function clearUserLocalStorage(): void {
  if (typeof window === 'undefined') return;

  for (const key of USER_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  const dynamicKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (USER_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      dynamicKeys.push(key);
    }
  }

  for (const key of dynamicKeys) {
    window.localStorage.removeItem(key);
  }
}

async function readResetErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {error?: string};
    if (body.error?.trim()) return body.error.trim();
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || `Request failed (${response.status}).`;
}

/** Clears server account data first; local storage is wiped only after server success. */
export async function resetAllUserData(): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/user/reset', {
      method: 'POST',
      headers: localAuthHeaders(),
      credentials: 'same-origin',
    });
  } catch {
    throw new UserResetError(
      'offline',
      'Could not reach the server to reset your account.'
    );
  }

  if (!response.ok) {
    const message = await readResetErrorMessage(response);
    const kind: UserResetFailureKind =
      response.status === 401 || response.status === 403 ? 'auth' : 'server';
    throw new UserResetError(kind, message, response.status);
  }

  clearUserLocalStorage();
}

export function isUserResetError(error: unknown): error is UserResetError {
  return error instanceof UserResetError;
}
