import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

const QUEST_TYPES = ['focus', 'courage', 'recovery', 'connection'] as const;
export type QuestType = (typeof QUEST_TYPES)[number];

const CONNECTION_DOMAINS = new Set(['relationships', 'house_family', 'spirit']);
const COURAGE_HINTS = ['call', 'ask', 'difficult', 'conversation', 'confront', 'email', 'reach out'];
const RECOVERY_HINTS = ['rest', 'stretch', 'walk', 'breathe', 'sleep', 'hydrate', 'pause'];

export function classifyQuestType(step: DailyBabyStepResponse): QuestType {
  const text = `${step.title} ${step.description ?? ''}`.toLowerCase();

  if (CONNECTION_DOMAINS.has(step.domain)) {
    if (step.difficulty === 'hard' || COURAGE_HINTS.some((h) => text.includes(h))) {
      return 'courage';
    }
    return 'connection';
  }

  if (
    (step.difficulty === 'easy' && step.estimated_minutes <= 5) ||
    RECOVERY_HINTS.some((h) => text.includes(h))
  ) {
    return 'recovery';
  }

  if (step.difficulty === 'hard' || COURAGE_HINTS.some((h) => text.includes(h))) {
    return 'courage';
  }

  return 'focus';
}
