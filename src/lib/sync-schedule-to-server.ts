import {formulationApi} from '@/lib/life-coach/api-client';
import type {UserPreferences} from '@/lib/user-preferences';

/** Push schedule + coaching + life-context prefs to the server profile API. */
export async function syncUserPreferencesToServer(prefs: UserPreferences): Promise<void> {
  if (typeof window === 'undefined') return;

  await formulationApi.updateParticipantProfile({
    life_context_statuses: prefs.life_context_statuses ?? [],
    life_context_note: prefs.life_context_note?.trim() || null,
    gender: prefs.gender ?? null,
    age: prefs.age ?? null,
    wake_time: prefs.wake_time,
    sleep_time: prefs.sleep_time,
    preferred_action_window: prefs.preferred_action_window,
    coaching_style: prefs.coaching_style,
    family_status: prefs.family_status ?? null,
    physical_considerations: prefs.physical_considerations ?? null,
  });
}

export function syncSchedulePrefsToServer(
  prefs: Pick<UserPreferences, 'wake_time' | 'sleep_time' | 'preferred_action_window'>
): Promise<void> {
  return syncUserPreferencesToServer(prefs as UserPreferences);
}
