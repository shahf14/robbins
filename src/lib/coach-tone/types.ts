import type {CoachingStyle} from '@/lib/user-preferences';

export type ToneVersionStats = {
  impressions: number;
  completions: number;
  skips: number;
  skips_after_copy: number;
  completion_rate: number;
};

export type ToneEffectiveness = {
  base_style: CoachingStyle;
  effective_style: CoachingStyle;
  preferred_tone: string;
  avoid_tone: string;
  by_tone: Record<CoachingStyle, ToneVersionStats>;
  completion_by_tone: Record<CoachingStyle, number>;
  updated_at: string;
};

export type DynamicCoachTone = {
  base_style: CoachingStyle;
  effective_style: CoachingStyle;
  preferred_tone: string;
  avoid_tone: string;
  tone_effectiveness: ToneEffectiveness;
};
