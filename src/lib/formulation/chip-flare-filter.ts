import type {AppLocale} from '@/i18n/config';
import enMessages from '../../../messages/en.json';
import heMessages from '../../../messages/he.json';
import type {FormulationSession} from '@/lib/life-coach/types';

export type ChipSeverity = 'not_at_all' | 'a_little' | 'moderate' | 'a_lot' | 'not_sure' | 'unknown';

const CHIP_KEYS: ChipSeverity[] = ['not_at_all', 'a_little', 'moderate', 'a_lot', 'not_sure', 'unknown'];

function chipLabels(locale: AppLocale): Record<Exclude<ChipSeverity, 'unknown'>, string> {
  const chips =
    locale === 'he' ? heMessages.formulation.followUps.chips : enMessages.formulation.followUps.chips;
  return chips as Record<Exclude<ChipSeverity, 'unknown'>, string>;
}

export function parseChipSeverity(answer: string, locale: AppLocale): ChipSeverity {
  const raw = answer.trim();
  if (CHIP_KEYS.includes(raw as ChipSeverity) && raw !== 'unknown') {
    return raw as ChipSeverity;
  }

  const labels = chipLabels(locale);
  for (const key of ['not_at_all', 'a_little', 'moderate', 'a_lot', 'not_sure'] as const) {
    if (raw === labels[key]) return key;
  }

  if (/בכלל לא|not at all/i.test(raw)) return 'not_at_all';
  if (/^קצת$|a little/i.test(raw)) return 'a_little';
  if (/בינוני|moderate/i.test(raw)) return 'moderate';
  if (/הרבה|a lot/i.test(raw)) return 'a_lot';
  if (/לא בטוח|not sure/i.test(raw)) return 'not_sure';

  return 'unknown';
}

export function chipAnswerDisplayLabel(answer: string, locale: AppLocale): string {
  const severity = parseChipSeverity(answer, locale);
  if (severity === 'unknown') return answer;
  return chipLabels(locale)[severity];
}

type ChipFlareEntry = {
  follow_up_key: string;
  question_key: string | null;
  chip: ChipSeverity;
  /** Rating id that triggered this follow-up in step 3 (null = context-only prompt). */
  source_rating_key: string | null;
};

export type ChipFlareState = {
  suppressed_rating_ids: Set<string>;
  downgraded_rating_ids: Set<string>;
  confirmed_rating_ids: Set<string>;
  entries: ChipFlareEntry[];
};

export function buildChipFlareState(session: FormulationSession, locale: AppLocale): ChipFlareState {
  const suppressed_rating_ids = new Set<string>();
  const downgraded_rating_ids = new Set<string>();
  const confirmed_rating_ids = new Set<string>();
  const entries: ChipFlareEntry[] = [];

  for (const a of session.prior_question_answers) {
    const meta =
      session.rating_follow_ups.find((f) => f.key === a.key) ??
      session.rating_follow_ups.find((f) => f.source_rating_key === a.key);
    const questionKey = meta?.questionKey ?? null;
    const sourceRatingKey = meta?.source_rating_key ?? (meta?.key === a.key ? a.key : null);
    const chip = parseChipSeverity(a.answer, locale);

    entries.push({
      follow_up_key: a.key,
      question_key: questionKey,
      chip,
      source_rating_key: sourceRatingKey,
    });

    // Only the rating that triggered this follow-up is affected — not all themes in the same domain.
    if (!sourceRatingKey) continue;

    if (chip === 'not_at_all') {
      suppressed_rating_ids.add(sourceRatingKey);
    } else if (chip === 'a_little') {
      downgraded_rating_ids.add(sourceRatingKey);
    } else if (chip === 'moderate' || chip === 'a_lot') {
      confirmed_rating_ids.add(sourceRatingKey);
    }
  }

  return {
    suppressed_rating_ids,
    downgraded_rating_ids,
    confirmed_rating_ids,
    entries,
  };
}
