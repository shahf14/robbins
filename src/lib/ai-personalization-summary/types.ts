import type {AppLocale} from '@/i18n/config';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeContextStatus,
  LifeDomain,
} from '@/lib/life-coach/types';
import type {CoachingStyle} from '@/lib/user-preferences';

export type PreferredActionSize = 'micro' | 'small' | 'standard';

export type EmotionalRisk =
  | 'fear_of_failure'
  | 'shame'
  | 'burnout'
  | 'overwhelm'
  | 'isolation';

type AiPersonalizationTone = {
  preferred_tone: string;
  avoid_tone: string;
  shame_sensitivity: 'low' | 'medium' | 'high';
};

export type AiPersonalizationSummary = {
  motivators: string[];
  likely_blockers: string[];
  preferred_action_size: PreferredActionSize;
  emotional_risk: EmotionalRisk[];
  tone: AiPersonalizationTone;
  identity_goal: string;
  generated_at: string;
  source: 'onboarding';
  locale: AppLocale;
  primary_domain: LifeDomain | null;
};

export type OnboardingPersonalizationInput = {
  locale: AppLocale;
  primary_domain?: LifeDomain | null;
  life_context_note?: string;
  life_context_statuses?: LifeContextStatus[];
  available_time?: AvailableTimePerDay;
  intensity_preference?: IntensityPreference;
  coaching_style?: CoachingStyle;
  answers?: {
    whyThisDomain: string;
    whatBothersToday: string;
    whatIfNothingChanges: string;
    whatIfSucceeds: string;
  };
  insight?: string | null;
  goal_title?: string;
  goal_description?: string;
  domain_score?: number;
};
