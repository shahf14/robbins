import {defaultLocale, isLocale, type AppLocale} from '@/i18n/config';
import {
  isParticipantGender,
  normalizeParticipantAge,
  type ParticipantGender,
} from '@/lib/formulation/participant-profile';
import {parseJsonObjectOr} from '@/lib/safe-json';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeContextStatus,
} from '@/lib/life-coach/types';
import {AVAILABLE_TIME_OPTIONS, INTENSITY_PREFERENCES} from '@/lib/life-coach/types';

export const FAMILY_STATUSES = [
  'single',
  'in_relationship',
  'married',
  'married_with_kids',
  'other',
] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const PREFERRED_ACTION_WINDOWS = ['morning', 'midday', 'evening', 'flexible'] as const;
export type PreferredActionWindow = (typeof PREFERRED_ACTION_WINDOWS)[number];

export const PHYSICAL_CONSIDERATIONS = [
  'low_intensity',
  'physical_limitation',
  'pregnancy_postpartum',
] as const;
export type PhysicalConsideration = (typeof PHYSICAL_CONSIDERATIONS)[number];

const userPreferencesKey = 'user_preferences';
export const userPreferencesChangedEvent = 'user-preferences-changed';

export const COACHING_STYLES = ['supportive', 'direct', 'motivational'] as const;
export type CoachingStyle = (typeof COACHING_STYLES)[number];

export type UserPreferences = {
  preferred_language: AppLocale;
  display_name: string;
  timezone: string;
  wake_time: string;
  sleep_time: string;
  preferred_action_window: PreferredActionWindow;
  coaching_style: CoachingStyle;
  behavioral_analytics_enabled: boolean;
  available_time_per_day: AvailableTimePerDay;
  intensity_preference: IntensityPreference;
  family_status?: FamilyStatus;
  gender?: ParticipantGender | null;
  age?: number | null;
  age_prefer_not?: boolean;
  life_context_statuses?: LifeContextStatus[];
  life_context_note?: string;
  physical_considerations?: PhysicalConsideration[];
};

const defaultUserPreferences: UserPreferences = {
  preferred_language: defaultLocale,
  display_name: '',
  timezone: 'Asia/Jerusalem',
  wake_time: '07:00',
  sleep_time: '22:30',
  preferred_action_window: 'flexible',
  coaching_style: 'supportive',
  behavioral_analytics_enabled: true,
  available_time_per_day: 10,
  intensity_preference: 'balanced',
};

function isCoachingStyle(v: unknown): v is CoachingStyle {
  return typeof v === 'string' && (COACHING_STYLES as readonly string[]).includes(v);
}

function isFamilyStatus(v: unknown): v is FamilyStatus {
  return typeof v === 'string' && (FAMILY_STATUSES as readonly string[]).includes(v as FamilyStatus);
}

function isPreferredActionWindow(v: unknown): v is PreferredActionWindow {
  return typeof v === 'string' && (PREFERRED_ACTION_WINDOWS as readonly string[]).includes(v as PreferredActionWindow);
}

function isAvailableTime(v: unknown): v is AvailableTimePerDay {
  return typeof v === 'number' && (AVAILABLE_TIME_OPTIONS as readonly number[]).includes(v as AvailableTimePerDay);
}

function isIntensity(v: unknown): v is IntensityPreference {
  return typeof v === 'string' && (INTENSITY_PREFERENCES as readonly string[]).includes(v as IntensityPreference);
}

function isPhysicalConsideration(v: unknown): v is PhysicalConsideration {
  return typeof v === 'string' && (PHYSICAL_CONSIDERATIONS as readonly string[]).includes(v as PhysicalConsideration);
}

function normalizeUserPreferences(value: Partial<UserPreferences>): UserPreferences {
  return {
    preferred_language:
      value.preferred_language && isLocale(value.preferred_language)
        ? value.preferred_language
        : defaultUserPreferences.preferred_language,
    display_name: typeof value.display_name === 'string' ? value.display_name.trim().slice(0, 60) : '',
    timezone:
      value.timezone ||
      (typeof window !== 'undefined'
        ? getBrowserTimezone()
        : defaultUserPreferences.timezone),
    wake_time:
      typeof value.wake_time === 'string' && /^\d{2}:\d{2}$/.test(value.wake_time)
        ? value.wake_time
        : defaultUserPreferences.wake_time,
    sleep_time:
      typeof value.sleep_time === 'string' && /^\d{2}:\d{2}$/.test(value.sleep_time)
        ? value.sleep_time
        : defaultUserPreferences.sleep_time,
    preferred_action_window: isPreferredActionWindow(value.preferred_action_window)
      ? value.preferred_action_window
      : defaultUserPreferences.preferred_action_window,
    coaching_style: isCoachingStyle(value.coaching_style) ? value.coaching_style : defaultUserPreferences.coaching_style,
    available_time_per_day: isAvailableTime(value.available_time_per_day)
      ? value.available_time_per_day
      : defaultUserPreferences.available_time_per_day,
    intensity_preference: isIntensity(value.intensity_preference)
      ? value.intensity_preference
      : defaultUserPreferences.intensity_preference,
    family_status: isFamilyStatus(value.family_status) ? value.family_status : undefined,
    behavioral_analytics_enabled:
      typeof value.behavioral_analytics_enabled === 'boolean'
        ? value.behavioral_analytics_enabled
        : defaultUserPreferences.behavioral_analytics_enabled,
    gender:
      value.gender && isParticipantGender(value.gender) ? value.gender : undefined,
    age: normalizeParticipantAge(value.age) ?? undefined,
    age_prefer_not: value.age_prefer_not === true ? true : undefined,
    life_context_statuses: Array.isArray(value.life_context_statuses)
      ? (value.life_context_statuses as LifeContextStatus[])
      : undefined,
    life_context_note:
      typeof value.life_context_note === 'string'
        ? value.life_context_note.trim().slice(0, 200) || undefined
        : undefined,
    physical_considerations: Array.isArray(value.physical_considerations)
      ? value.physical_considerations.filter(isPhysicalConsideration)
      : undefined,
  };
}

/** Fields saved in settings that should be read-only in formulation step 1. */
export function participantProfileLocksFromPreferences(
  prefs: UserPreferences
): {life_context_statuses: boolean; gender: boolean; age: boolean} {
  return {
    life_context_statuses: (prefs.life_context_statuses?.length ?? 0) > 0,
    gender: prefs.gender != null,
    age: prefs.age != null || prefs.age_prefer_not === true,
  };
}

export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return defaultUserPreferences;
  }

  try {
    const raw = window.localStorage.getItem(userPreferencesKey);

    if (!raw) {
      return {
        ...defaultUserPreferences,
        timezone: getBrowserTimezone(),
      };
    }

    return normalizeUserPreferences(parseJsonObjectOr<Partial<UserPreferences>>(raw, {}));
  } catch {
    return defaultUserPreferences;
  }
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultUserPreferences.timezone;
  } catch {
    return defaultUserPreferences.timezone;
  }
}

export function saveUserPreferences(value: Partial<UserPreferences>) {
  if (typeof window === 'undefined') {
    return defaultUserPreferences;
  }

  const next = normalizeUserPreferences({
    ...loadUserPreferences(),
    ...value
  });

  window.localStorage.setItem(userPreferencesKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<UserPreferences>(userPreferencesChangedEvent, {detail: next}));

  return next;
}
