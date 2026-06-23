import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {ParticipantGender} from '@/lib/formulation/participant-profile';
import type {PassiveRatingItem} from '@/lib/formulation/passive-ratings';
import type {LlmExplorationAnswer} from '@/lib/life-coach/types';

export type ConsentLiveDraft = {
  life_context_statuses: LifeContextStatus[];
  life_context_status_note?: string;
  gender: ParticipantGender | null;
  age: number | null;
  age_prefer_not?: boolean;
};

export type WizardLiveDraft = {
  consent?: ConsentLiveDraft;
  passive_ratings?: PassiveRatingItem[];
  follow_up_answers?: Array<{key: string; answer: string; clarification?: string}>;
  llm_exploration_answers?: LlmExplorationAnswer[];
};

export function wizardLiveDraftHasContent(draft: WizardLiveDraft, phase: string): boolean {
  switch (phase) {
    case 'consent':
      return draft.consent != null;
    case 'open':
      return (draft.passive_ratings?.length ?? 0) > 0;
    case 'dimensions':
      return (draft.follow_up_answers?.length ?? 0) > 0;
    case 'exploration':
      return (draft.llm_exploration_answers?.length ?? 0) > 0;
    default:
      return false;
  }
}
