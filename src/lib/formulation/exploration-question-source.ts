import type {AppLocale} from '@/i18n/config';
import {buildFallbackExplorationQuestions} from '@/lib/formulation/exploration-fallback';
import type {FormulationSession, LlmExplorationQuestion} from '@/lib/life-coach/types';

/** True when all 15 texts match the static fallback templates (not LLM-personalized). */
export function isFallbackExplorationBundle(
  questions: LlmExplorationQuestion[],
  session: FormulationSession,
  locale: AppLocale
): boolean {
  if (questions.length !== 15) return false;
  const fallback = buildFallbackExplorationQuestions(session, locale);
  return questions.every((q, i) => q.text === fallback[i]?.text);
}
