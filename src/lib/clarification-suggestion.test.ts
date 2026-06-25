import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearClarificationSuggestionState,
  dismissClarificationSuggestion,
  isClarificationSuggestionAvailable,
} from './clarification-suggestion.ts';

test('clarification suggestion dismiss hides until expiry', () => {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  });

  try {
    clearClarificationSuggestionState();
    assert.equal(isClarificationSuggestionAvailable(), true);

    dismissClarificationSuggestion(7);
    assert.equal(isClarificationSuggestionAvailable(), false);

    clearClarificationSuggestionState();
    assert.equal(isClarificationSuggestionAvailable(), true);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});
