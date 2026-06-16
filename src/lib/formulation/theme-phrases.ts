import type {AppLocale} from '@/i18n/config';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
  GUIDED_QUESTIONS_BANK,
} from '@/lib/formulation/guided-questions';
import type {RatedThemeInsight} from '@/lib/formulation/formulation-insights';
import {lifeContextThemeFallback} from '@/lib/life-context-labels';
import type {LifeContextStatus} from '@/lib/life-coach/types';

/** Smooth Hebrew/English phrase for LLM templates — never raw ids or English slugs. */
export function humanThemePhraseFromInsights(
  themes: RatedThemeInsight[],
  lifeContexts: LifeContextStatus[],
  locale: AppLocale
): string {
  if (themes.length === 0) {
    const fromContext = lifeContextThemeFallback(lifeContexts, locale);
    if (fromContext) return fromContext;
    return locale === 'he' ? 'מה שעולה עכשיו' : 'what feels most pressing now';
  }

  const labels = themes.slice(0, 2).map((t) => shortThemeLabel(t.id, locale));

  if (locale === 'he') {
    if (labels.length === 1) return labels[0];
    return `${labels[0]} ו${labels[1]}`;
  }

  return labels.join(' and ');
}

export function shortThemeLabel(ratingId: string, locale: AppLocale): string {
  const overridesHe: Record<string, string> = {
    sleep_quality: 'איכות השינה',
    male_provider_pressure_between_jobs:
      'לחץ סביב הפרנסה ותפקיד המפרנס בזמן מעבר עבודה',
    between_jobs_financial_stress: 'לחץ כלכלי במעבר בין עבודות',
    between_jobs_identity_gap: 'פער זהותי במעבר תעסוקתי',
    transition_instability: 'חוסר יציבות במעבר',
    work_pressure: 'לחץ בעבודה',
    student_academic_pressure: 'לחץ בלימודים',
    self_criticism: 'ביקורת עצמית',
    avoidance: 'הימנעות',
    worry_load: 'עומס דאגות',
    new_parent_guilt_rest: 'אשמה והיעדר מנוחה כהורה',
  };

  const overridesEn: Record<string, string> = {
    sleep_quality: 'sleep quality',
    male_provider_pressure_between_jobs:
      'pressure around providing and the breadwinner role during a job transition',
    between_jobs_financial_stress: 'financial stress during a job transition',
    work_pressure: 'work pressure',
    self_criticism: 'self-criticism',
    avoidance: 'avoidance',
  };

  const map = locale === 'he' ? overridesHe : overridesEn;
  if (map[ratingId]) return map[ratingId];

  const q = getGuidedQuestionById(ratingId);
  if (q) {
    const body = getGuidedQuestionBody(q, locale).replace(/\.$/, '');
    return body.length > 72 ? `${body.slice(0, 72)}…` : body;
  }

  return ratingId.replace(/_/g, ' ');
}

const EN_SLUG_IN_HEBREW =
  /\b(sleep quality|male provider|provider pressure|between jobs|financial stress|identity gap|work pressure|self criticism|self-criticism)\b/gi;

const RATING_ID_IN_TEXT = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

/** Strip internal ids / English slugs from Likert statement text shown to users. */
export function sanitizeLikertStatementText(text: string, locale: AppLocale): string {
  let out = text.trim();

  for (const row of GUIDED_QUESTIONS_BANK.questions) {
    const label = shortThemeLabel(row.id, locale);
    const tokens = [row.id, row.id.replace(/_/g, ' '), row.id.replace(/_/g, '-')];
    for (const token of tokens) {
      if (token.length > 4 && out.toLowerCase().includes(token.toLowerCase())) {
        out = out.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), label);
      }
    }
  }

  if (locale === 'he') {
    out = out
      .replace(EN_SLUG_IN_HEBREW, (m) => {
        const key = m.toLowerCase();
        if (key.includes('sleep')) return 'איכות השינה';
        if (key.includes('provider')) return 'לחץ סביב הפרנסה ותפקיד המפרנס';
        if (key.includes('between jobs')) return 'מעבר בין עבודות';
        if (key.includes('work')) return 'לחץ בעבודה';
        if (key.includes('self')) return 'ביקורת עצמית';
        return m;
      })
      .replace(RATING_ID_IN_TEXT, (slug) => shortThemeLabel(slug, 'he'));
  }

  return out.replace(/\s{2,}/g, ' ').trim();
}
