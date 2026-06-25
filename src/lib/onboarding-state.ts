import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';
import type {AppLocale} from '@/i18n/config';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {clearProfileCompletionPromptState} from '@/lib/profile-completion';
import {clearClarificationSuggestionState} from '@/lib/clarification-suggestion';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeDomain,
} from './life-coach/types';

const KEY = 'onboarding_v2';

export const ONBOARDING_STATUS_CHANGED_EVENT = 'onboarding-status-changed';

export type OnboardingState = {
  completedAt: string | null;
  primaryDomain: LifeDomain | null;
  /** ISO date when the user completed step 1+ — used to calculate feature unlock */
  startedAt: string | null;
};

const DEFAULT: OnboardingState = {
  completedAt: null,
  primaryDomain: null,
  startedAt: null,
};

export function loadOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return {...DEFAULT, ...parseJsonObjectOr<Partial<OnboardingState>>(raw, {})};
  } catch {
    return DEFAULT;
  }
}

export function saveOnboardingState(patch: Partial<OnboardingState>) {
  if (typeof window === 'undefined') return;
  const current = loadOnboardingState();
  window.localStorage.setItem(KEY, JSON.stringify({...current, ...patch}));
  if (patch.completedAt) {
    window.dispatchEvent(new Event(ONBOARDING_STATUS_CHANGED_EVENT));
  }
}

export function isOnboardingComplete(): boolean {
  return loadOnboardingState().completedAt !== null;
}

/**
 * Reconcile local onboarding state with the server (the source of truth) in
 * BOTH directions. Pass only a confirmed server response — callers must not
 * invoke this on a network/auth failure (where the server state is unknown).
 *
 * - server complete  → record completion locally
 * - server incomplete → clear a stale local completion (e.g. after a server-side
 *   reset), so the user isn't left unlocked forever / a new device isn't stuck.
 */
export function applyServerOnboardingStatus(status: {
  completedAt: string | null;
  primaryDomain?: LifeDomain | null;
}) {
  const current = loadOnboardingState();

  if (status.completedAt) {
    const isFirstCompletion = !current.completedAt;
    saveOnboardingState({
      completedAt: status.completedAt,
      primaryDomain: status.primaryDomain ?? current.primaryDomain,
      startedAt: current.startedAt ?? status.completedAt,
    });
    if (isFirstCompletion && typeof window !== 'undefined') {
      clearProfileCompletionPromptState();
      clearClarificationSuggestionState();
    }
    return;
  }

  // Server says not complete. Only act if local disagrees, to avoid needless writes.
  if (current.completedAt) {
    saveOnboardingState({
      completedAt: null,
      primaryDomain: status.primaryDomain ?? current.primaryDomain,
      startedAt: current.startedAt,
    });
    // saveOnboardingState only emits the change event when completing; emit it
    // here too so listeners react to the revocation.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ONBOARDING_STATUS_CHANGED_EVENT));
    }
  }
}

export async function fetchServerOnboardingStatus(): Promise<{
  completedAt: string | null;
  primaryDomain: LifeDomain | null;
  complete: boolean;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/onboarding/status', {headers: mergeLocalAuthHeaders()});
    observeAuthResponse(res);
    if (!res.ok) return null;
    return (await res.json()) as {
      completedAt: string | null;
      primaryDomain: LifeDomain | null;
      complete: boolean;
    };
  } catch {
    return null;
  }
}

export type OnboardingCompletePayload = {
  primaryDomain?: LifeDomain | null;
  locale?: AppLocale;
  life_context_note?: string;
  life_context_statuses?: import('@/lib/life-coach/types').LifeContextStatus[];
  available_time?: AvailableTimePerDay;
  intensity_preference?: IntensityPreference;
  coaching_style?: import('@/lib/user-preferences').CoachingStyle;
  answers?: {
    whyThisDomain: string;
    whatBothersToday: string;
    whatIfNothingChanges: string;
    whatIfSucceeds: string;
  };
  insight?: string | null;
  goal_title?: string;
  goal_description?: string;
  domain_score?: number;
};

export async function markOnboardingCompleteOnServer(
  payload: OnboardingCompletePayload = {}
) {
  const res = await fetch('/api/onboarding/complete', {
    method: 'POST',
    headers: {...mergeLocalAuthHeaders(), 'Content-Type': 'application/json'},
    body: JSON.stringify({
      primaryDomain: payload.primaryDomain ?? null,
      locale: payload.locale,
      life_context_note: payload.life_context_note,
      life_context_statuses: payload.life_context_statuses,
      available_time: payload.available_time,
      intensity_preference: payload.intensity_preference,
      coaching_style: payload.coaching_style,
      answers: payload.answers,
      insight: payload.insight,
      goal_title: payload.goal_title,
      goal_description: payload.goal_description,
      domain_score: payload.domain_score,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to persist onboarding completion on server');
  }
  const data = (await res.json()) as {completedAt: string; primaryDomain: LifeDomain | null};
  applyServerOnboardingStatus(data);
  return data;
}

/** Days since onboarding was completed. Returns 0 if not yet complete. */
export function daysSinceOnboarding(): number {
  const state = loadOnboardingState();
  if (!state.completedAt) return 0;
  const ms = Date.now() - new Date(state.completedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
