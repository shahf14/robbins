import {formulationApi} from '@/lib/life-coach/api-client';
import type {UserPreferences} from '@/lib/user-preferences';

export function syncSchedulePrefsToServer(
  prefs: Pick<UserPreferences, 'wake_time' | 'sleep_time' | 'preferred_action_window'>
) {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  return formulationApi.updateParticipantProfile({
    wake_time: prefs.wake_time,
    sleep_time: prefs.sleep_time,
    preferred_action_window: prefs.preferred_action_window,
  });
}
