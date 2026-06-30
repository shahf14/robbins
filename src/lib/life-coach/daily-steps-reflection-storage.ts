import {parseJsonOr} from '@/lib/safe-json';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';

const KEY = 'robbins_daily_reflection_modal';

export type ReflectionModalDraft = {
  stepId: string;
  action: 'skipped' | 'partial';
  blockerCategory: 'external' | 'internal' | 'unclear' | null;
  blockerReason: ReflectionBlockerReason | null;
  deepDiveAnswer: string;
  reflectionText: string;
  moodScore: number;
  energyScore: number;
};

function isValidDraft(value: unknown): value is ReflectionModalDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as ReflectionModalDraft;
  return (
    typeof draft.stepId === 'string' &&
    draft.stepId.length > 0 &&
    (draft.action === 'skipped' || draft.action === 'partial') &&
    typeof draft.deepDiveAnswer === 'string' &&
    typeof draft.reflectionText === 'string' &&
    typeof draft.moodScore === 'number' &&
    typeof draft.energyScore === 'number'
  );
}

export function loadReflectionModalDraft(): ReflectionModalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = parseJsonOr<unknown>(raw, null);
    if (!isValidDraft(parsed)) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveReflectionModalDraft(draft: ReflectionModalDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // quota exceeded or disabled
  }
}

export function clearReflectionModalDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // storage disabled
  }
}
