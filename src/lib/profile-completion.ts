export type ProfileCompletionPromptKey =
  | 'preferred_action_window'
  | 'coaching_style'
  | 'available_time_per_day'
  | 'intensity_preference'
  | 'physical_considerations';

type PromptStateEntry = {
  answeredAt?: string;
  dismissedUntil?: string;
};

type PromptState = Partial<Record<ProfileCompletionPromptKey, PromptStateEntry>>;

const KEY = 'profile_completion_prompts_v2';

function parseState(): PromptState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' ? (value as PromptState) : {};
  } catch {
    return {};
  }
}

function saveState(state: PromptState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function isProfilePromptAvailable(key: ProfileCompletionPromptKey, now = new Date()): boolean {
  const entry = parseState()[key];
  if (!entry) return true;
  if (entry.answeredAt) return false;
  if (!entry.dismissedUntil) return true;
  return new Date(entry.dismissedUntil).getTime() <= now.getTime();
}

export function markProfilePromptAnswered(key: ProfileCompletionPromptKey) {
  const state = parseState();
  state[key] = {answeredAt: new Date().toISOString()};
  saveState(state);
}

export function dismissProfilePrompt(key: ProfileCompletionPromptKey, days: number) {
  const state = parseState();
  const dismissedUntil = new Date();
  dismissedUntil.setDate(dismissedUntil.getDate() + days);
  state[key] = {
    ...state[key],
    dismissedUntil: dismissedUntil.toISOString(),
  };
  saveState(state);
}

export function clearProfileCompletionPromptState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
