import {
  loadFormulationDraftPointer,
  loadFormulationLiveDraft,
} from '@/lib/formulation/draft-storage';
import {wizardLiveDraftHasContent} from '@/lib/formulation/wizard-live-draft';
import {HEALTH_GOAL_DRAFT_KEY, ONBOARDING_DRAFT_KEY} from '@/lib/draft-storage-keys';
import {isOnboardingComplete} from '@/lib/onboarding-state';
import {
  domainGoalDraftHasProgress,
  loadDomainGoalWizardDraft,
} from '@/lib/open-process-drafts';
import {parseJsonObjectOr} from '@/lib/safe-json';

/** True when local draft storage suggests in-progress wizard / goal work. */
export function hasUnsavedJourneyDraft(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (window.localStorage.getItem(HEALTH_GOAL_DRAFT_KEY)) {
      return true;
    }
  } catch {
    /* storage disabled */
  }

  const domainDraft = loadDomainGoalWizardDraft();
  if (domainDraft && domainGoalDraftHasProgress(domainDraft)) {
    return true;
  }

  if (!isOnboardingComplete()) {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const parsed = parseJsonObjectOr<{step?: number}>(raw, {});
        if ((typeof parsed.step === 'number' ? parsed.step : 0) >= 2) {
          return true;
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
  }

  const pointer = loadFormulationDraftPointer();
  if (pointer?.sessionId && pointer.phase) {
    const live = loadFormulationLiveDraft(pointer.sessionId, pointer.phase);
    if (live && wizardLiveDraftHasContent(live, pointer.phase)) {
      return true;
    }
  }

  return false;
}

export function localizedPathWithQuery(pathname: string): string {
  if (typeof window === 'undefined') return pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  return `${pathname}${search}${hash}`;
}
