import {addMinutesToTime} from '@/lib/schedule-content';
import {loadUserPreferences} from '@/lib/user-preferences';

const LEGACY_REMINDER_KEY = 'daily_reminder';
const LEGACY_LAST_KEY = 'daily_reminder_last';

export const SCHEDULE_REMINDER_KEYS = {
  morningEnabled: 'schedule_reminder_morning_enabled',
  eveningEnabled: 'schedule_reminder_evening_enabled',
  morningLast: 'schedule_reminder_morning_last',
  eveningLast: 'schedule_reminder_evening_last',
  active: 'schedule_reminders_active',
} as const;

export type ScheduleReminderPrefs = {
  morningEnabled: boolean;
  eveningEnabled: boolean;
  morningTime: string;
  eveningTime: string;
};

function getMorningReminderTime(wakeTime: string): string {
  return addMinutesToTime(wakeTime, 15);
}

function getEveningReminderTime(sleepTime: string): string {
  return addMinutesToTime(sleepTime, -45);
}

export function loadScheduleReminderPrefs(): ScheduleReminderPrefs {
  const prefs = loadUserPreferences();
  const morningTime = getMorningReminderTime(prefs.wake_time);
  const eveningTime = getEveningReminderTime(prefs.sleep_time);

  if (typeof window === 'undefined') {
    return {
      morningEnabled: true,
      eveningEnabled: false,
      morningTime,
      eveningTime,
    };
  }

  const legacy = window.localStorage.getItem(LEGACY_REMINDER_KEY);
  const migrated = window.localStorage.getItem(SCHEDULE_REMINDER_KEYS.morningEnabled);
  const morningEnabled =
    migrated != null
      ? window.localStorage.getItem(SCHEDULE_REMINDER_KEYS.morningEnabled) === 'true'
      : legacy != null || window.localStorage.getItem(SCHEDULE_REMINDER_KEYS.active) === 'true';
  const eveningEnabled =
    window.localStorage.getItem(SCHEDULE_REMINDER_KEYS.eveningEnabled) === 'true';

  return {morningEnabled, eveningEnabled, morningTime, eveningTime};
}

export function saveScheduleReminderPrefs(input: {
  morningEnabled: boolean;
  eveningEnabled: boolean;
}) {
  window.localStorage.setItem(
    SCHEDULE_REMINDER_KEYS.morningEnabled,
    input.morningEnabled ? 'true' : 'false'
  );
  window.localStorage.setItem(
    SCHEDULE_REMINDER_KEYS.eveningEnabled,
    input.eveningEnabled ? 'true' : 'false'
  );
  if (input.morningEnabled || input.eveningEnabled) {
    window.localStorage.setItem(SCHEDULE_REMINDER_KEYS.active, 'true');
  } else {
    window.localStorage.removeItem(SCHEDULE_REMINDER_KEYS.active);
  }
  window.localStorage.removeItem(LEGACY_REMINDER_KEY);
  window.localStorage.removeItem(LEGACY_LAST_KEY);
}

export async function requestScheduleReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.requestPermission();
}

function fireIfDue(
  enabled: boolean,
  targetTime: string,
  lastKey: string,
  title: string,
  body: string,
  now: Date
) {
  if (!enabled) {
    return;
  }
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (current !== targetTime) {
    return;
  }
  const today = now.toDateString();
  if (window.localStorage.getItem(lastKey) === today) {
    return;
  }
  window.localStorage.setItem(lastKey, today);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {body});
  }
}

export function pollScheduleReminders(messages: {
  morningTitle: string;
  morningBody: string;
  eveningTitle: string;
  eveningBody: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }
  const {morningEnabled, eveningEnabled, morningTime, eveningTime} = loadScheduleReminderPrefs();
  const now = new Date();
  fireIfDue(
    morningEnabled,
    morningTime,
    SCHEDULE_REMINDER_KEYS.morningLast,
    messages.morningTitle,
    messages.morningBody,
    now
  );
  fireIfDue(
    eveningEnabled,
    eveningTime,
    SCHEDULE_REMINDER_KEYS.eveningLast,
    messages.eveningTitle,
    messages.eveningBody,
    now
  );
}
