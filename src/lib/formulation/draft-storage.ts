import {parseJsonOr} from '@/lib/safe-json';

const DRAFT_KEY = 'formulation_session_draft';

export type FormulationDraftPointer = {
  sessionId: string;
  phase: string;
};

export function saveFormulationDraftPointer(pointer: FormulationDraftPointer) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(pointer));
  } catch { /* quota exceeded or disabled */ }
}

export function loadFormulationDraftPointer(): FormulationDraftPointer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return parseJsonOr<FormulationDraftPointer | null>(raw, null);
  } catch {
    return null;
  }
}

export function clearFormulationDraftPointer() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage disabled */ }
}
