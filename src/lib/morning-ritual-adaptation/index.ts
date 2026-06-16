import type {CheckInTag} from '@/lib/check-in-types';
import type {AppLocale} from '@/i18n/config';
import {isLocale} from '@/i18n/config';
import {recommendCheckIn} from '@/lib/check-in-personalization';
import {dateToYMD} from '@/lib/date-utils';
import {getLatestMorningRitualForUser} from '@/lib/db/repositories/morning-rituals';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import {enforceEasyOnlySteps} from '@/lib/life-coach/adaptive-task-count';
import {fallbackTagForScores, parseMoodScore} from './calibration';
import {
  applyMoodStrategyToAdaptiveTaskCount,
  applyMoodStrategyToCalibration,
  enforceMoodStrategyOnSteps,
  moodStrategyForPrompt,
  resolveMoodActionStrategy,
  type MoodActionStrategy,
} from './mood-strategy';

export {MOOD_STRATEGY_PROMPT_BLOCK} from './mood-strategy';

const NEGATIVE_MOOD_TAGS = new Set<CheckInTag>([
  'stressed',
  'stuck',
  'distracted',
  'anxious',
  'exhausted',
  'burntOut',
  'apathetic',
]);

export type RitualAdaptationContext = {
  date: string;
  created_at: string;
  energy: number | null;
  mood: number | null;
  momentum: number | null;
  priority_action: string | null;
  primary_tag: string | null;
  focus: number | null;
  is_low_energy: boolean;
  is_negative_mood: boolean;
  mood_strategy: MoodActionStrategy | null;
  selected_tags: string[];
  source: 'today' | 'latest';
};

export const MORNING_RITUAL_ADAPTATION_PROMPT_BLOCK = [
  '## Morning ritual adaptation (PRIMARY — mandatory):',
  'Use latest_morning_ritual as the main daily adaptation signal — NOT reflections alone.',
  'Fields: energy, mood (state_score), momentum, priority_action (daily mission), primary_tag, mood_strategy, mood_action_hints.',
  'If latest_morning_ritual.energy <= 3: generate ONLY easy steps, max 10 minutes each, restorative/passive wording.',
  'If latest_morning_ritual.mood_strategy is set: follow mood_action_hints — mood drives action TYPE, not only energy.',
  'If latest_morning_ritual.is_negative_mood: low-friction steps only — environmental prep, 2-minute starts, passive actions.',
  'When priority_action aligns with an active goal, echo it in at least one step title or reasoning.',
  'If latest_morning_ritual is null: fall back to recent_reflections_compact and execution_history.',
].join('\n');

export function resolveLatestRitualAdaptation(
  userId: string,
  date: string
): RitualAdaptationContext | null {
  const session = getLatestMorningRitualForUser(userId, date);
  if (!session || !session.completed) return null;
  const sessionDate = dateToYMD(new Date(session.completedAt ?? session.startedAt));
  return mapMorningRitualToAdaptation(session, sessionDate, sessionDate === date ? 'today' : 'latest');
}

export function mapMorningRitualToAdaptation(
  session: MorningRitualSession,
  date: string,
  source: 'today' | 'latest'
): RitualAdaptationContext {
  const energy = normalizeScore(session.energyScore ?? parseMoodScore(session.moodBefore));
  const focus = normalizeScore(session.focusScore ?? 6);
  const primaryTag =
    session.primaryTag?.trim() ||
    (energy != null && focus != null ? fallbackTagForScores(focus, energy) : null);
  const selectedTags = primaryTag ? [primaryTag] : [];
  const priorityAction = session.dailyMission?.trim() || null;
  const recommendation =
    energy != null && focus != null
      ? recommendCheckIn(
          {
            focus,
            energy,
            selectedTags: selectedTags as CheckInTag[],
            priorityAction: priorityAction ?? '',
          },
          (isLocale(session.language) ? session.language : 'en') as AppLocale
        )
      : null;
  const mood = recommendation ? recommendation.stateScore : null;
  const momentum = recommendation ? recommendation.momentum : null;
  const mood_strategy = resolveMoodActionStrategy(primaryTag, selectedTags);

  return {
    date,
    created_at: session.completedAt ?? session.startedAt,
    energy,
    mood,
    momentum,
    priority_action: priorityAction,
    primary_tag: primaryTag,
    focus,
    is_low_energy: energy != null && energy <= 3,
    is_negative_mood: isNegativeMood(mood, primaryTag),
    mood_strategy,
    selected_tags: selectedTags,
    source,
  };
}

function normalizeScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 1 || value > 10) return null;
  return Math.round(value);
}

function isNegativeMood(mood: number | null, primaryTag: string | null): boolean {
  if (mood != null && mood <= 4) return true;
  if (primaryTag && NEGATIVE_MOOD_TAGS.has(primaryTag as CheckInTag)) return true;
  return false;
}

export function ritualAdaptationForPrompt(
  ritual: RitualAdaptationContext | null | undefined
): Record<string, unknown> | null {
  if (!ritual) return null;
  return {
    date: ritual.date,
    source: ritual.source,
    energy: ritual.energy,
    mood: ritual.mood,
    momentum: ritual.momentum,
    priority_action: ritual.priority_action,
    primary_tag: ritual.primary_tag,
    selected_tags: ritual.selected_tags,
    focus: ritual.focus,
    is_low_energy: ritual.is_low_energy,
    is_negative_mood: ritual.is_negative_mood,
    mood_strategy: ritual.mood_strategy,
    mood_action_hints: moodStrategyForPrompt(ritual.mood_strategy),
  };
}

export function applyRitualToAdaptiveTaskCount(
  count: AdaptiveTaskCount,
  ritual: RitualAdaptationContext | null | undefined
): AdaptiveTaskCount {
  if (!ritual) return count;

  if (ritual.is_low_energy) {
    return {
      max_steps: Math.min(count.max_steps, 1),
      easy_only: true,
      reason: 'low_energy',
    };
  }

  if (ritual.is_negative_mood) {
    count = {
      max_steps: Math.min(count.max_steps, 2),
      easy_only: count.easy_only || true,
      reason: count.reason === 'default' ? 'low_energy' : count.reason,
    };
  }

  return applyMoodStrategyToAdaptiveTaskCount(count, ritual);
}

export function applyRitualToCalibration(
  calibration: PersonalDifficultyCalibration,
  ritual: RitualAdaptationContext | null | undefined
): PersonalDifficultyCalibration {
  if (!ritual) return calibration;

  let adjusted = calibration;
  if (ritual.is_low_energy) {
    adjusted = {
      ...adjusted,
      difficulty_ceiling: 'easy',
      target_minutes: Math.min(adjusted.target_minutes, 8),
      max_minutes: Math.min(adjusted.max_minutes, 10),
      ramp_mode: adjusted.ramp_mode === 'raise' ? 'hold' : 'reduce',
    };
  }
  return applyMoodStrategyToCalibration(adjusted, ritual);
}

export function enforceRitualOnSteps(
  steps: StructuredDailyBabyStep[],
  ritual: RitualAdaptationContext | null | undefined
): StructuredDailyBabyStep[] {
  if (!ritual) return steps;

  if (ritual.is_low_energy) {
    return enforceEasyOnlySteps(steps).map((step) => ({
      ...step,
      difficulty: 'easy' as const,
      estimated_minutes: Math.max(5, Math.min(10, step.estimated_minutes)),
    }));
  }

  if (ritual.is_negative_mood) {
    steps = steps.map((step) => ({
      ...step,
      difficulty:
        step.difficulty === 'hard'
          ? ('easy' as const)
          : step.difficulty === 'medium'
            ? ('easy' as const)
            : step.difficulty,
      estimated_minutes: Math.min(step.estimated_minutes, 12),
    }));
  }

  return enforceMoodStrategyOnSteps(steps, ritual);
}
