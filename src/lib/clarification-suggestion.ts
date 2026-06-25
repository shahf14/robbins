type ClarificationSuggestionState = {
  dismissedUntil?: string;
};

const KEY = 'clarification_suggestion_v1';

function parseState(): ClarificationSuggestionState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' ? (value as ClarificationSuggestionState) : {};
  } catch {
    return {};
  }
}

function saveState(state: ClarificationSuggestionState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function isClarificationSuggestionAvailable(now = new Date()): boolean {
  const {dismissedUntil} = parseState();
  if (!dismissedUntil) return true;
  return new Date(dismissedUntil).getTime() <= now.getTime();
}

export function dismissClarificationSuggestion(days: number) {
  const dismissedUntil = new Date();
  dismissedUntil.setDate(dismissedUntil.getDate() + days);
  saveState({dismissedUntil: dismissedUntil.toISOString()});
}

export function clearClarificationSuggestionState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
