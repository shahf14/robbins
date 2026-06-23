import {loadFormulationDraftPointer} from '@/lib/formulation/draft-storage';
import {isOnboardingComplete} from '@/lib/onboarding-state';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {
  DOMAIN_GOAL_DRAFT_KEY,
  HEALTH_GOAL_DRAFT_KEY,
  ONBOARDING_DRAFT_KEY,
} from '@/lib/draft-storage-keys';

export {DOMAIN_GOAL_DRAFT_KEY} from '@/lib/draft-storage-keys';

export type DomainGoalWizardDraft = {
  domain: string;
  step: number;
  category: string;
  customCategory: string;
  goalText: string;
  milestone30: string;
  milestone60: string;
  milestone90: string;
};

type OpenProcessKind = 'onboarding' | 'health_goal' | 'domain_goal' | 'clarification';

export type OpenProcessDraft = {
  kind: OpenProcessKind;
  href: string;
};

export function loadDomainGoalWizardDraft(): DomainGoalWizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DOMAIN_GOAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = parseJsonObjectOr<Partial<DomainGoalWizardDraft>>(raw, {});
    if (!parsed.domain || typeof parsed.step !== 'number') return null;
    return {
      domain: parsed.domain,
      step: parsed.step,
      category: parsed.category ?? '',
      customCategory: parsed.customCategory ?? '',
      goalText: parsed.goalText ?? '',
      milestone30: parsed.milestone30 ?? '',
      milestone60: parsed.milestone60 ?? '',
      milestone90: parsed.milestone90 ?? '',
    };
  } catch {
    return null;
  }
}

export function getDomainGoalDraftForDomain(domain: string): DomainGoalWizardDraft | null {
  const draft = loadDomainGoalWizardDraft();
  if (draft && draft.domain === domain && domainGoalDraftHasProgress(draft)) {
    return draft;
  }
  return null;
}

export function hasDomainGoalDraftForDomain(domain: string): boolean {
  return getDomainGoalDraftForDomain(domain) !== null;
}

export function domainGoalDraftHasProgress(draft: DomainGoalWizardDraft): boolean {
  return draft.step > 1 || draft.category.trim().length > 0;
}

export function saveDomainGoalWizardDraft(draft: DomainGoalWizardDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOMAIN_GOAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota exceeded or disabled
  }
}

export function listOpenProcessDrafts(): OpenProcessDraft[] {
  if (typeof window === 'undefined') return [];

  const drafts: OpenProcessDraft[] = [];

  if (!isOnboardingComplete()) {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const parsed = parseJsonObjectOr<{step?: number}>(raw, {});
        const step = typeof parsed.step === 'number' ? parsed.step : 0;
        if (step >= 2 && step < 6) {
          drafts.push({kind: 'onboarding', href: '/onboarding'});
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
  }

  try {
    if (window.localStorage.getItem(HEALTH_GOAL_DRAFT_KEY)) {
      drafts.push({kind: 'health_goal', href: '/life-coach/health'});
    }
  } catch {
    /* storage disabled */
  }

  try {
    const draft = loadDomainGoalWizardDraft();
    if (draft && domainGoalDraftHasProgress(draft)) {
      drafts.push({kind: 'domain_goal', href: `/life-coach/${draft.domain}?resumeGoal=1`});
    }
  } catch {
    /* ignore */
  }

  const clarification = loadFormulationDraftPointer();
  if (clarification?.sessionId) {
    drafts.push({
      kind: 'clarification',
      href: `/clarification?resume=${clarification.sessionId}`,
    });
  }

  return drafts;
}

export function clearDomainGoalWizardDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DOMAIN_GOAL_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
