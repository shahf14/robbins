import {loadFormulationDraftPointer} from '@/lib/formulation/draft-storage';
import {isOnboardingComplete} from '@/lib/onboarding-state';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {
  DOMAIN_GOAL_DRAFT_KEY,
  HEALTH_GOAL_DRAFT_KEY,
  ONBOARDING_DRAFT_KEY,
} from '@/lib/draft-storage-keys';

export {DOMAIN_GOAL_DRAFT_KEY} from '@/lib/draft-storage-keys';

type OpenProcessKind = 'onboarding' | 'health_goal' | 'domain_goal' | 'clarification';

export type OpenProcessDraft = {
  kind: OpenProcessKind;
  href: string;
};

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
    const raw = window.localStorage.getItem(DOMAIN_GOAL_DRAFT_KEY);
    if (raw) {
      const parsed = parseJsonObjectOr<{domain?: string; step?: number}>(raw, {});
      if (parsed.domain && typeof parsed.step === 'number' && parsed.step > 1) {
        drafts.push({kind: 'domain_goal', href: `/life-coach/${parsed.domain}`});
      }
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
