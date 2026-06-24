import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {ONBOARDING_DRAFT_KEY} from '@/lib/draft-storage-keys';
import type {AppLocale} from '@/i18n/config';

export type WizardState = {
  step: 1 | 2;
  draftRestored: boolean;
  locale: AppLocale;
  lifeContextStatuses: LifeContextStatus[];
  lifeContextNote: string;
  selectedDomain: LifeDomain | null;
  error: string | null;
  saving: boolean;
};

export const INITIAL_ONBOARDING_WIZARD_STATE: WizardState = {
  step: 1,
  draftRestored: false,
  locale: 'en',
  lifeContextStatuses: [],
  lifeContextNote: '',
  selectedDomain: null,
  error: null,
  saving: false,
};

type OnboardingDraft = {
  step?: number;
  lifeContextStatuses?: LifeContextStatus[];
  lifeContextNote?: string;
  selectedDomain?: LifeDomain | null;
};

export function saveDraft(s: WizardState) {
  if (typeof window === 'undefined') return;
  const draft: OnboardingDraft = {
    step: s.step,
    lifeContextStatuses: s.lifeContextStatuses,
    lifeContextNote: s.lifeContextNote,
    selectedDomain: s.selectedDomain,
  };
  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): Partial<WizardState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const draft = parseJsonObjectOr<OnboardingDraft>(raw, {});
    const selectedDomain =
      draft.selectedDomain && LIFE_DOMAINS.includes(draft.selectedDomain)
        ? draft.selectedDomain
        : null;
    const hasContext =
      (draft.lifeContextStatuses?.length ?? 0) > 0 ||
      Boolean(draft.lifeContextNote?.trim()) ||
      selectedDomain;

    if (!hasContext) return null;

    return {
      lifeContextStatuses: draft.lifeContextStatuses ?? [],
      lifeContextNote: draft.lifeContextNote ?? '',
      selectedDomain,
      step: selectedDomain && (draft.step ?? 1) > 1 ? 2 : 1,
    };
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window !== 'undefined') localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}
