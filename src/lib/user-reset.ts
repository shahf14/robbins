import {SCHEDULE_REMINDER_KEYS} from '@/lib/schedule-reminders';
import {
  DOMAIN_GOAL_DRAFT_KEY,
  HEALTH_GOAL_DRAFT_KEY,
  ONBOARDING_DRAFT_KEY,
} from '@/lib/draft-storage-keys';
import {LOCAL_AUTH_TOKEN_STORAGE_KEY} from '@/lib/auth-storage-keys';

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
  'preferred_language',
  'daily_reminder',
  'daily_reminder_last',
  ...Object.values(SCHEDULE_REMINDER_KEYS),
] as const;

const USER_LOCAL_STORAGE_PREFIXES = [
  'robbins_feature_seen_',
  'robbins_feature_hint_dismissed_',
] as const;

function localAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = window.sessionStorage.getItem(LOCAL_AUTH_TOKEN_STORAGE_KEY)?.trim();
  return token ? {Authorization: `Bearer ${token}`} : {};
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

export async function resetAllUserData(): Promise<void> {
  let serverCleared = false;

  try {
    const response = await fetch('/api/user/reset', {
      method: 'POST',
      headers: localAuthHeaders(),
    });
    serverCleared = response.ok;
  } catch {
    serverCleared = false;
  }

  clearUserLocalStorage();

  if (!serverCleared) {
    console.warn('[reset] Server data could not be cleared; local storage was reset.');
  }
}
