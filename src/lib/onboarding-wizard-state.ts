import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeContextStatus,
  LifeDomain,
} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import type {ParticipantGender} from '@/lib/formulation/participant-profile';
import {
  buildOnboardingAiContext,
  onboardingAiContextPayload,
} from '@/lib/onboarding-ai-context';
import {
  EMPTY_QUICK_CLARIFICATION,
  isQuickClarificationReady,
  type QuickClarificationInput,
} from '@/lib/onboarding-clarification';
import type {
  CoachingStyle,
  FamilyStatus,
  PhysicalConsideration,
  PreferredActionWindow,
} from '@/lib/user-preferences';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {addDaysYMD, dateToYMD} from '@/lib/date-utils';
import {ONBOARDING_DRAFT_KEY} from '@/lib/draft-storage-keys';
import type {AppLocale} from '@/i18n/config';

export const TOTAL_STEPS = 6;

// Must match goalCreateInputSchema title max — keeping them in sync prevents
// the "valid in UI, rejected by API" bug where 200 chars passed the form but
// the schema only accepts 140.
export const GOAL_TITLE_MAX = 140;

export function localDatePlusDays(days: number, from = new Date()): string {
  return addDaysYMD(dateToYMD(from), days);
}

export type Answers = {
  whyThisDomain:        string;
  whatBothersToday:     string;
  whatIfNothingChanges: string;
  whatIfSucceeds:       string;
};

export type FirstStepData = {
  title:             string;
  description:       string;
  estimated_minutes: number;
};

export type ProposedGoal = {
  title:          string;
  description:    string;
  success_metric: string;
};

export type WizardState = {
  step:           1 | 2 | 3 | 4 | 5 | 6;
  draftRestored:  boolean;
  name:                    string;
  locale:                  AppLocale;
  gender:                  ParticipantGender | null;
  lifeContextStatuses:     LifeContextStatus[];
  lifeContextNote:         string;
  wakeTime:                string;
  sleepTime:               string;
  preferredActionWindow:   PreferredActionWindow;
  availableTime:           AvailableTimePerDay;
  intensityPreference:     IntensityPreference;
  coachingStyle:           CoachingStyle;
  familyStatus:            FamilyStatus | '';
  age:                     string;
  agePreferNot:            boolean;
  physicalConsiderations:  PhysicalConsideration[];
  domainScores:   Record<LifeDomain, number>;
  selectedDomain: LifeDomain | null;
  answers:            Answers;
  quickClarification: QuickClarificationInput;
  insight:            string | null;
  insightLoading:     boolean;
  proposedGoal:        ProposedGoal | null;
  goalLoading:         boolean;
  editedTitle:         string;
  editedSuccessMetric: string;
  goalId:              string | null;
  firstStep:   FirstStepData | null;
  stepLoading: boolean;
  firstStepCompleted: boolean;
  error:  string | null;
  saving: boolean;
};

const DEFAULT_SCORES = Object.fromEntries(
  LIFE_DOMAINS.map((d) => [d, 5])
) as Record<LifeDomain, number>;

export const INITIAL_ONBOARDING_WIZARD_STATE: WizardState = {
  step: 1, draftRestored: false,
  name: '', locale: 'en', gender: null, lifeContextStatuses: [], lifeContextNote: '',
  wakeTime: '07:00', sleepTime: '22:30', preferredActionWindow: 'flexible',
  availableTime: 10, intensityPreference: 'balanced', coachingStyle: 'supportive',
  familyStatus: '', age: '', agePreferNot: false, physicalConsiderations: [],
  domainScores: DEFAULT_SCORES, selectedDomain: null,
  answers: {whyThisDomain: '', whatBothersToday: '', whatIfNothingChanges: '', whatIfSucceeds: ''},
  quickClarification: EMPTY_QUICK_CLARIFICATION,
  insight: null, insightLoading: false,
  proposedGoal: null, goalLoading: false, editedTitle: '', editedSuccessMetric: '', goalId: null,
  firstStep: null, stepLoading: false, firstStepCompleted: false,
  error: null, saving: false,
};

type DraftFields = Pick<WizardState,
  | 'step' | 'name' | 'locale' | 'gender' | 'lifeContextStatuses'
  | 'lifeContextNote'
  | 'wakeTime' | 'sleepTime' | 'preferredActionWindow' | 'availableTime'
  | 'intensityPreference' | 'coachingStyle' | 'familyStatus'
  | 'age' | 'agePreferNot' | 'physicalConsiderations'
  | 'domainScores' | 'selectedDomain' | 'answers' | 'quickClarification' | 'insight'
  | 'editedTitle' | 'editedSuccessMetric' | 'proposedGoal'
  | 'goalId' | 'firstStep'
>;

export function saveDraft(s: WizardState) {
  if (typeof window === 'undefined') return;
  const draft: DraftFields = {
    step: s.step, name: s.name, locale: s.locale, gender: s.gender,
    lifeContextStatuses: s.lifeContextStatuses, lifeContextNote: s.lifeContextNote,
    wakeTime: s.wakeTime, sleepTime: s.sleepTime,
    preferredActionWindow: s.preferredActionWindow, availableTime: s.availableTime,
    intensityPreference: s.intensityPreference, coachingStyle: s.coachingStyle,
    familyStatus: s.familyStatus, age: s.age, agePreferNot: s.agePreferNot,
    physicalConsiderations: s.physicalConsiderations,
    domainScores: s.domainScores, selectedDomain: s.selectedDomain, answers: s.answers,
    quickClarification: s.quickClarification,
    insight: s.insight, editedTitle: s.editedTitle, editedSuccessMetric: s.editedSuccessMetric,
    proposedGoal: s.proposedGoal,
    goalId: s.step >= 5 ? s.goalId : null,
    firstStep: s.step >= 5 ? s.firstStep : null,
  };
  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

function draftHasProposedGoal(draft: Partial<WizardState>): boolean {
  return !!draft.proposedGoal?.title?.trim() || !!draft.editedTitle?.trim();
}

function draftHasFirstWin(draft: Partial<WizardState>): boolean {
  return !!draft.goalId && !!draft.firstStep?.title?.trim();
}

function normalizeDraftStep(draft: Partial<WizardState>): WizardState['step'] | null {
  if (typeof draft.step !== 'number' || draft.step <= 1) return null;

  let step = draft.step as WizardState['step'];
  const hasGoal = draftHasProposedGoal(draft);
  const hasFirstWin = draftHasFirstWin(draft);

  if (step >= 4 && !hasGoal) {
    step = 3;
  }

  if (step === 5 && !hasFirstWin) {
    step = hasGoal ? 4 : 3;
  }

  if (step >= 3 && !draft.selectedDomain) {
    step = 2;
  }

  if (
    step >= 5 &&
    (!draft.selectedDomain || !LIFE_DOMAINS.includes(draft.selectedDomain))
  ) {
    step = 2;
  }

  return step;
}

export function loadDraft(): Partial<WizardState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const draft = parseJsonObjectOr<Partial<WizardState>>(raw, {});
    const step = normalizeDraftStep(draft);
    if (!step) return null;

    const hasProposedGoal = draftHasProposedGoal(draft);
    const proposedGoal =
      draft.proposedGoal ??
      (hasProposedGoal && draft.editedTitle?.trim()
        ? {
            title: draft.editedTitle.trim(),
            description: '',
            success_metric: draft.editedSuccessMetric?.trim() || '',
          }
        : null);

    const rolledBackFromStep5 = draft.step === 5 && step < 5;
    const quickClarification = draft.quickClarification ?? EMPTY_QUICK_CLARIFICATION;
    const insight =
      draft.insight && isQuickClarificationReady(quickClarification) ? draft.insight : null;

    return {
      ...draft,
      step,
      quickClarification,
      insight,
      proposedGoal,
      goalId: step >= 5 ? draft.goalId ?? null : null,
      firstStep: step >= 5 ? draft.firstStep ?? null : null,
      editedTitle: proposedGoal?.title ?? draft.editedTitle ?? '',
      editedSuccessMetric:
        draft.editedSuccessMetric ?? proposedGoal?.success_metric ?? '',
      ...(rolledBackFromStep5 || step < 4 ? {goalId: null, firstStep: null} : {}),
      ...(step < 4 ? {proposedGoal: null, editedTitle: '', editedSuccessMetric: ''} : {}),
    };
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window !== 'undefined') localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export function profileFieldsFromState(s: WizardState) {
  return {
    locale: s.locale,
    availableTime: s.availableTime,
    intensityPreference: s.intensityPreference,
    coachingStyle: s.coachingStyle,
    familyStatus: s.familyStatus,
    age: s.age,
    agePreferNot: s.agePreferNot,
    gender: s.gender,
    lifeContextStatuses: s.lifeContextStatuses,
    wakeTime: s.wakeTime,
    sleepTime: s.sleepTime,
    preferredActionWindow: s.preferredActionWindow,
    physicalConsiderations: s.physicalConsiderations,
  };
}

export function aiPayload(s: WizardState, domain: LifeDomain, extra: Record<string, unknown> = {}) {
  return {
    ...onboardingAiContextPayload(
      buildOnboardingAiContext({
        ...profileFieldsFromState(s),
        domain,
        domainScore: s.domainScores[domain],
      })
    ),
    locale: s.locale,
    domain,
    ...extra,
  };
}

export async function callOnboardingAi(
  mode: 'insight' | 'goal_proposal' | 'first_step',
  body: Record<string, unknown>
) {
  const res = await fetch('/api/onboarding/ai', {
    method: 'POST',
    headers: mergeLocalAuthHeaders(),
    body: JSON.stringify({mode, ...body}),
  });
  if (!res.ok) throw new Error('AI request failed');
  return res.json() as Promise<Record<string, unknown>>;
}
