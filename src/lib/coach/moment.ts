import type {AppLocale} from '@/i18n/config';
import type {CheckInEntry, CheckInTag} from '@/lib/check-in-types';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import {
  askVirtualCoach,
  COACH_EMOTIONS,
  type CoachEmotion,
  type CoachRequestPayload,
} from '@/lib/coach/client';
import {coachStateByTag} from '@/lib/coach/prefill';

const BLOCKER_EMOTION: Record<ReflectionBlockerReason, CoachEmotion> = {
  no_time: 'overwhelmed',
  forgot: 'avoidant',
  low_energy: 'flat',
  unclear_task: 'confused',
  emotional_resistance: 'avoidant',
  family_chaos: 'overwhelmed',
  other: 'disappointed',
};

const BLOCKER_ESCAPE: Record<ReflectionBlockerReason, number> = {
  no_time: 7,
  forgot: 5,
  low_energy: 8,
  unclear_task: 6,
  emotional_resistance: 8,
  family_chaos: 7,
  other: 6,
};

function resolveCoachEmotion(value: string | undefined, fallback: CoachEmotion): CoachEmotion {
  if (value && COACH_EMOTIONS.includes(value as CoachEmotion)) {
    return value as CoachEmotion;
  }
  return fallback;
}

export function buildCoachPayloadFromSkip(input: {
  locale: AppLocale;
  stepTitle: string;
  blocker_reason?: ReflectionBlockerReason | string | null;
  reflection_text?: string | null;
  energy?: number | null;
}): CoachRequestPayload {
  const blocker = (input.blocker_reason ?? 'other') as ReflectionBlockerReason;
  const emotion = BLOCKER_EMOTION[blocker] ?? 'disappointed';
  const escape = BLOCKER_ESCAPE[blocker] ?? 6;
  const energy = Math.max(1, Math.min(10, input.energy ?? 5));
  const parts = [
    input.locale === 'he'
      ? `דילגתי על הצעד: "${input.stepTitle}".`
      : `I skipped the step: "${input.stepTitle}".`,
    input.blocker_reason
      ? input.locale === 'he'
        ? `חסם: ${input.blocker_reason}.`
        : `Blocker: ${input.blocker_reason}.`
      : null,
    input.reflection_text?.trim() || null,
  ].filter(Boolean);

  return {
    language: input.locale,
    tone: 'tony_coach',
    emotionalState: emotion,
    escape,
    energy,
    userText: parts.join(' '),
  };
}

/** Best-effort coach moment — never throws; returns null on failure. */
export async function fetchCoachMomentSafe(
  payload: CoachRequestPayload
): Promise<string | null> {
  try {
    const result = await askVirtualCoach(payload);
    const text = result.response?.trim();
    return text || null;
  } catch {
    return null;
  }
}
