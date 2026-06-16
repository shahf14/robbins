import type {LlmExplorationAnswer} from '@/lib/life-coach/types';

/** Parses DB JSON; supports legacy `{ answer: "3" }` rows. */
export function normalizeLlmExplorationAnswers(raw: unknown): LlmExplorationAnswer[] {
  if (!Array.isArray(raw)) return [];

  const out: LlmExplorationAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = 'key' in item && typeof item.key === 'string' ? item.key : '';
    if (!/^q\d{2}$/.test(key)) continue;

    if ('score' in item && typeof item.score === 'number') {
      const score = Math.round(item.score);
      if (score >= 1 && score <= 5) out.push({key, score});
      continue;
    }

    if ('answer' in item && typeof item.answer === 'string') {
      const score = parseInt(item.answer.trim(), 10);
      if (score >= 1 && score <= 5) out.push({key, score});
    }
  }
  return out;
}
