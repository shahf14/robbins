import {parseJsonOr} from '@/lib/safe-json';
import type {WizardLiveDraft} from '@/lib/formulation/wizard-live-draft';
import {wizardLiveDraftHasContent} from '@/lib/formulation/wizard-live-draft';

const DRAFT_KEY = 'formulation_session_draft';
const LIVE_DRAFT_PREFIX = 'formulation_live_draft:';

export type FormulationDraftPointer = {
  sessionId: string;
  phase: string;
};

function liveDraftStorageKey(sessionId: string, phase: string): string {
  return `${LIVE_DRAFT_PREFIX}${sessionId}:${phase}`;
}

export function saveFormulationDraftPointer(pointer: FormulationDraftPointer) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(pointer));
  } catch {
    // quota exceeded or disabled
  }
}

export function loadFormulationDraftPointer(): FormulationDraftPointer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return parseJsonOr<FormulationDraftPointer | null>(raw, null);
  } catch {
    return null;
  }
}

export function clearFormulationDraftPointer() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage disabled
  }
}

export function saveFormulationLiveDraft(
  sessionId: string,
  phase: string,
  draft: WizardLiveDraft
): void {
  if (typeof window === 'undefined') return;
  const key = liveDraftStorageKey(sessionId, phase);
  try {
    if (!wizardLiveDraftHasContent(draft, phase)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // quota exceeded or disabled
  }
}

export function loadFormulationLiveDraft(
  sessionId: string,
  phase: string
): WizardLiveDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(liveDraftStorageKey(sessionId, phase));
    if (!raw) return null;
    return parseJsonOr<WizardLiveDraft | null>(raw, null);
  } catch {
    return null;
  }
}

export function clearFormulationLiveDraft(sessionId: string, phase: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(liveDraftStorageKey(sessionId, phase));
  } catch {
    // storage disabled
  }
}

export function clearFormulationLiveDraftsForSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  const prefix = `${LIVE_DRAFT_PREFIX}${sessionId}:`;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage disabled
    }
  }
}
