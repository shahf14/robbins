import type {CheckInTag} from '@/lib/check-in-types';
import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import {enforceEasyOnlySteps} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {RitualAdaptationContext} from './index';

export type MoodActionStrategy =
  | 'calming_clear'
  | 'tiny_compassionate'
  | 'physical_release'
  | 'clarity_step'
  | 'challenge';

const TAG_TO_STRATEGY: Partial<Record<CheckInTag | string, MoodActionStrategy>> = {
  anxious: 'calming_clear',
  sad: 'tiny_compassionate',
  apathetic: 'tiny_compassionate',
  exhausted: 'tiny_compassionate',
  burntOut: 'tiny_compassionate',
  disappointed: 'tiny_compassionate',
  flat: 'tiny_compassionate',
  angry: 'physical_release',
  overwhelmed: 'physical_release',
  stressed: 'physical_release',
  avoidant: 'physical_release',
  confused: 'clarity_step',
  stuck: 'clarity_step',
  distracted: 'clarity_step',
  motivated: 'challenge',
  driven: 'challenge',
  laserFocused: 'challenge',
  inspired: 'challenge',
  disciplined: 'challenge',
  excited: 'challenge',
};

const STRATEGY_ORDER: MoodActionStrategy[] = [
  'calming_clear',
  'tiny_compassionate',
  'physical_release',
  'clarity_step',
  'challenge',
];

export function resolveMoodActionStrategy(
  primaryTag: string | null,
  selectedTags: string[] = []
): MoodActionStrategy | null {
  const candidates = [primaryTag, ...selectedTags].filter(Boolean) as string[];
  for (const strategy of STRATEGY_ORDER) {
    if (candidates.some((tag) => TAG_TO_STRATEGY[tag] === strategy)) {
      return strategy;
    }
  }
  return null;
}

export const MOOD_STRATEGY_PROMPT_BLOCK = [
  '## Mood-based action strategy (mandatory when latest_morning_ritual.mood_strategy is set):',
  'Adapt step TYPE and SIZE to mood — not only energy score.',
  'Use latest_morning_ritual.mood_strategy and mood_action_hints from the payload.',
  'Mappings:',
  '- calming_clear (anxious): calming tone, ONE clear micro-deliverable — never vague or large tasks.',
  '- tiny_compassionate (sad/low): 3-5 minute easy steps, warm permission-giving language.',
  '- physical_release (angry/stressed): light movement or body release — walk, stretch, shake-out.',
  '- clarity_step (confused/stuck): mapping, choose-one, or write-three-bullets — reduce ambiguity first.',
  '- challenge (motivated): may use medium difficulty and up to 15-20 min if energy allows.',
  'anxious MUST NOT get ambiguous goals, multi-part projects, or steps over 8 minutes.',
].join('\n');

export function moodStrategyForPrompt(
  strategy: MoodActionStrategy | null | undefined
): Record<string, unknown> | null {
  if (!strategy) return null;
  const hints: Record<MoodActionStrategy, string> = {
    calming_clear: 'calming + clear single deliverable, max 8 min, easy only',
    tiny_compassionate: 'tiny + compassionate, max 5 min, easy only',
    physical_release: 'physical release or light movement, 8-12 min, easy/medium',
    clarity_step: 'clarity step — map, choose, or list; max 10 min, easy',
    challenge: 'stretch challenge allowed if energy >= 5; otherwise cap at easy 12 min',
  };
  return {
    strategy,
    hint: hints[strategy],
  };
}

export function applyMoodStrategyToAdaptiveTaskCount(
  count: AdaptiveTaskCount,
  ritual: RitualAdaptationContext | null | undefined
): AdaptiveTaskCount {
  if (!ritual?.mood_strategy) return count;

  switch (ritual.mood_strategy) {
    case 'calming_clear':
    case 'tiny_compassionate':
      return {
        max_steps: Math.min(count.max_steps, 1),
        easy_only: true,
        reason: count.reason === 'default' ? 'low_energy' : count.reason,
      };
    case 'clarity_step':
      return {
        max_steps: Math.min(count.max_steps, 2),
        easy_only: true,
        reason: count.reason,
      };
    case 'physical_release':
      return {
        max_steps: Math.min(count.max_steps, 2),
        easy_only: count.easy_only,
        reason: count.reason,
      };
    case 'challenge':
      return count;
    default:
      return count;
  }
}

export function applyMoodStrategyToCalibration(
  calibration: PersonalDifficultyCalibration,
  ritual: RitualAdaptationContext | null | undefined
): PersonalDifficultyCalibration {
  if (!ritual?.mood_strategy) return calibration;

  switch (ritual.mood_strategy) {
    case 'calming_clear':
      return {
        ...calibration,
        difficulty_ceiling: 'easy',
        target_minutes: Math.min(calibration.target_minutes, 6),
        max_minutes: Math.min(calibration.max_minutes, 8),
        ramp_mode: 'reduce',
      };
    case 'tiny_compassionate':
      return {
        ...calibration,
        difficulty_ceiling: 'easy',
        target_minutes: Math.min(calibration.target_minutes, 5),
        max_minutes: Math.min(calibration.max_minutes, 5),
        ramp_mode: 'reduce',
      };
    case 'clarity_step':
      return {
        ...calibration,
        difficulty_ceiling: 'easy',
        target_minutes: Math.min(calibration.target_minutes, 8),
        max_minutes: Math.min(calibration.max_minutes, 10),
        ramp_mode: 'hold',
      };
    case 'physical_release':
      return {
        ...calibration,
        difficulty_ceiling:
          calibration.difficulty_ceiling === 'hard' ? 'medium' : calibration.difficulty_ceiling,
        target_minutes: Math.min(Math.max(calibration.target_minutes, 8), 12),
        max_minutes: Math.min(calibration.max_minutes, 12),
        ramp_mode: 'hold',
      };
    case 'challenge':
      if (ritual.is_low_energy) {
        return {
          ...calibration,
          difficulty_ceiling: 'easy',
          max_minutes: Math.min(calibration.max_minutes, 12),
        };
      }
      return calibration;
    default:
      return calibration;
  }
}

export function enforceMoodStrategyOnSteps(
  steps: StructuredDailyBabyStep[],
  ritual: RitualAdaptationContext | null | undefined
): StructuredDailyBabyStep[] {
  if (!ritual?.mood_strategy) return steps;

  switch (ritual.mood_strategy) {
    case 'calming_clear':
      return enforceEasyOnlySteps(steps).map((step) => ({
        ...step,
        difficulty: 'easy' as const,
        estimated_minutes: Math.min(step.estimated_minutes, 8),
      }));
    case 'tiny_compassionate':
      return enforceEasyOnlySteps(steps).map((step) => ({
        ...step,
        difficulty: 'easy' as const,
        estimated_minutes: Math.min(step.estimated_minutes, 5),
      }));
    case 'clarity_step':
      return enforceEasyOnlySteps(steps).map((step) => ({
        ...step,
        difficulty: 'easy' as const,
        estimated_minutes: Math.min(step.estimated_minutes, 10),
      }));
    case 'physical_release':
      return steps.map((step) => ({
        ...step,
        difficulty: step.difficulty === 'hard' ? ('medium' as const) : step.difficulty,
        estimated_minutes: Math.min(step.estimated_minutes, 12),
      }));
    case 'challenge':
      if (ritual.is_low_energy) {
        return enforceEasyOnlySteps(steps).map((step) => ({
          ...step,
          estimated_minutes: Math.min(step.estimated_minutes, 12),
        }));
      }
      return steps;
    default:
      return steps;
  }
}
