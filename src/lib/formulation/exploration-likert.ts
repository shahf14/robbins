import type {AppLocale} from '@/i18n/config';
import {sanitizeLikertStatementText} from '@/lib/formulation/theme-phrases';
import type {LlmExplorationQuestion} from '@/lib/life-coach/types';

const ENGLISH_IN_HEBREW = /\b[a-z]{4,}(?:\s+[a-z]+){0,3}\b/i;
const RATING_SLUG = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;

const HEBREW_FIRST_PERSON = /(אני|לי|שלי|אותי|לאחרונה|בתקופה)/u;

/** True when text is a first-person statement suitable for 1–5 agree/disagree rating. */
export function isExplorationLikertStatement(text: string, locale: AppLocale): boolean {
  const t = text.trim();
  if (t.length < 12 || t.length > 320) return false;
  if (/[?؟]/.test(t)) return false;

  if (locale === 'he') {
    if (/^(איך|מה|למה|מתי|איפה|האם|כמה|מי)(?:\s|$)/u.test(t)) return false;
    if (/(משפיע על|השפעה על|תסביר|תארי|תאר|ספר\/י|ספר)/u.test(t)) return false;
    if (!HEBREW_FIRST_PERSON.test(t)) return false;
    if (RATING_SLUG.test(t)) return false;
    if (ENGLISH_IN_HEBREW.test(t)) return false;
    return true;
  }

  if (/^(how|what|why|when|where|who|which|do |does |did |is |are |can |could |would )\b/i.test(t)) {
    return false;
  }
  if (/\b(how does|how do|affect your|impact on your|explain|describe)\b/i.test(t)) {
    return false;
  }
  if (!/\b(i |i'm|my |me |lately|recently|feel )\b/i.test(t)) {
    return false;
  }
  return true;
}

export function mergeExplorationQuestionsWithLikertFallback(
  questions: LlmExplorationQuestion[],
  fallback: LlmExplorationQuestion[],
  locale: AppLocale
): LlmExplorationQuestion[] {
  const byId = new Map(fallback.map((q) => [q.id, q] as const));
  return questions.map((q) => {
    const sanitized = {...q, text: sanitizeLikertStatementText(q.text, locale)};
    if (isExplorationLikertStatement(sanitized.text, locale)) return sanitized;
    const fb = byId.get(q.id);
    return fb ? {...fb, text: sanitizeLikertStatementText(fb.text, locale)} : sanitized;
  });
}
