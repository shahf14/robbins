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
  follow_up_answers?: Array<{key: string; answer: string}>;
  llm_exploration_answers?: LlmExplorationAnswer[];
};
