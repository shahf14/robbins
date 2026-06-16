import type {AppLocale} from '@/i18n/config';
import {isExplorationLikertStatement} from '@/lib/formulation/exploration-likert';
import type {FormulationApproved, LlmExplorationQuestion} from '@/lib/life-coach/types';

const FORBIDDEN_PATTERNS = [
  /\bptsd\b/i,
  /\badhd\b/i,
  /\bocd\b/i,
  /\bdepression\b/i,
  /\banxiety disorder\b/i,
  /\bהפרעת\b/i,
  /\bדיכאון\b/i,
  /\bחרדה\b.*\bהפרעה\b/i,
  /\bptsd\b/i,
  /הבעיה שלך/i,
  /your problem is/i,
  /you need medication/i,
  /תרופות/i,
  /diagnos/i,
  /אבחון/i,
];

export type GuardResult = {
  ok: boolean;
  reasons: string[];
};

export function guardFormulationDraft(draft: FormulationApproved): GuardResult {
  const reasons: string[] = [];
  const blob = JSON.stringify(draft);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(blob)) {
      reasons.push(`forbidden_pattern:${pattern.source}`);
    }
  }

  if (!draft.uncertainties || draft.uncertainties.length < 1) {
    reasons.push('missing_uncertainties');
  }

  if (!draft.presenting_concern_user_words?.trim()) {
    reasons.push('missing_presenting_concern');
  }

  return {ok: reasons.length === 0, reasons};
}

export function guardExplorationQuestions(
  questions: LlmExplorationQuestion[],
  locale: AppLocale
): GuardResult {
  const reasons: string[] = [];
  const blob = JSON.stringify(questions);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(blob)) {
      reasons.push(`forbidden_pattern:${pattern.source}`);
    }
  }

  if (questions.length !== 15) {
    reasons.push('wrong_question_count');
  }

  const ids = questions.map((q) => q.id);
  const expected = Array.from({length: 15}, (_, i) => `q${String(i + 1).padStart(2, '0')}`);
  if (expected.some((id, i) => ids[i] !== id)) {
    reasons.push('invalid_question_ids');
  }

  for (const q of questions) {
    if (!q.text?.trim() || q.text.length < 8) {
      reasons.push(`empty_question:${q.id}`);
    }
    if (!isExplorationLikertStatement(q.text, locale)) {
      reasons.push(`not_likert_statement:${q.id}`);
    }
  }

  return {ok: reasons.length === 0, reasons};
}
