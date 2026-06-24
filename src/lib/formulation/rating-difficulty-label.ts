import type {AppLocale} from '@/i18n/config';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
  getPolarityForQuestionId,
} from '@/lib/formulation/guided-questions';
import {distressWeight} from '@/lib/formulation/passive-ratings';

/** Phenomenological difficulty phrasing when user disagreed with a positive statement (low score). */
const INVERTED_DIFFICULTY_HE: Record<string, string> = {
  day_energy: 'חוסר אנרגיה ומותשות במהלך היום',
  focus: 'קושי להתרכז במה שחשוב לי',
  sense_of_control: 'קושי לשמור על תחושת שליטה על מה שקורה',
  motivation: 'חוסר מוטיבציה לעשות דברים',
  sleep_quality: 'השינה לא מספקת לאחרונה',
};

const INVERTED_DIFFICULTY_EN: Record<string, string> = {
  day_energy: 'Low energy and fatigue during the day',
  focus: 'Difficulty focusing on what matters to me',
  sense_of_control: 'Difficulty feeling in control of what happens',
  motivation: 'Lack of motivation to do things',
  sleep_quality: 'Sleep has not been restorative lately',
};

/**
 * Label for formulation/synthesis: invert positive statements when low agree (1–2).
 * Negative statements keep agreed wording when score is high distress.
 */
export function difficultyLabelFromRating(
  ratingId: string,
  score: number,
  locale: AppLocale
): string {
  const q = getGuidedQuestionById(ratingId);
  if (!q) return ratingId;

  const body = getGuidedQuestionBody(q, locale).replace(/\.$/, '');
  const polarity = getPolarityForQuestionId(ratingId);

  if (polarity === 'positive' && score <= 2) {
    const map = locale === 'he' ? INVERTED_DIFFICULTY_HE : INVERTED_DIFFICULTY_EN;
    return map[ratingId] ?? body;
  }

  if (distressWeight(ratingId, score) < 3) {
    return body;
  }

  return body;
}
