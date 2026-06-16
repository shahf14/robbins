import type {AppLocale} from '@/i18n/config';
import type {LifeDomain} from '@/lib/life-coach/types';
import {
  getPainChipLabel,
  getVisionChipLabel,
} from '@/lib/onboarding-step3-content';

export type ClarificationAnswers = {
  whyThisDomain: string;
  whatBothersToday: string;
  whatIfNothingChanges: string;
  whatIfSucceeds: string;
};

export type QuickClarificationInput = {
  painTagIds: string[];
  visionTagIds: string[];
  painNote: string;
  visionNote: string;
};

export const EMPTY_QUICK_CLARIFICATION: QuickClarificationInput = {
  painTagIds: [],
  visionTagIds: [],
  painNote: '',
  visionNote: '',
};

function getLowestScoredDomain(scores: Record<LifeDomain, number>): LifeDomain | null {
  const sorted = (Object.entries(scores) as [LifeDomain, number][]).sort(([, a], [, b]) => a - b);
  return sorted[0]?.[0] ?? null;
}

export function isLowestDomain(domain: LifeDomain, scores: Record<LifeDomain, number>): boolean {
  return getLowestScoredDomain(scores) === domain;
}

export function isQuickClarificationReady(input: QuickClarificationInput): boolean {
  const hasPain = input.painTagIds.length > 0 || input.painNote.trim().length >= 3;
  const hasVision = input.visionTagIds.length > 0 || input.visionNote.trim().length >= 3;
  return hasPain && hasVision;
}

function inferCostOfInaction(locale: AppLocale, domainScore: number): string {
  if (domainScore <= 4) {
    return locale === 'he'
      ? 'אם שום דבר לא ישתנה כאן, המצב כנראה יישאר מתסכל וייפגע בשאר החיים.'
      : 'If nothing changes here, this will likely stay frustrating and spill into other areas.';
  }
  if (domainScore <= 6) {
    return locale === 'he'
      ? 'אם לא אשפר כאן, קל להישאר באותו מקום עוד חודשים.'
      : 'If I do not improve here, it is easy to stay in the same place for months.';
  }
  return '';
}

function chipLabels(
  domain: LifeDomain,
  locale: AppLocale,
  ids: string[],
  getter: typeof getPainChipLabel
): string[] {
  return ids
    .map((id) => getter(domain, locale, id))
    .filter((label): label is string => !!label);
}

export function buildQuickAnswers(
  locale: AppLocale,
  domain: LifeDomain,
  domainScore: number,
  domainScores: Record<LifeDomain, number>,
  input: QuickClarificationInput
): ClarificationAnswers {
  const lowest = isLowestDomain(domain, domainScores);
  const painLabels = chipLabels(domain, locale, input.painTagIds, getPainChipLabel);
  const visionLabels = chipLabels(domain, locale, input.visionTagIds, getVisionChipLabel);

  const painParts: string[] = [...painLabels];
  if (input.painNote.trim()) painParts.push(input.painNote.trim());

  const visionParts: string[] = [...visionLabels];
  if (input.visionNote.trim()) visionParts.push(input.visionNote.trim());

  const painCore = painParts.join(', ');
  const leverageLine = lowest
    ? locale === 'he'
      ? 'זה התחום עם המנוף הכי גדול כרגע.'
      : 'This is the area with the biggest leverage right now.'
    : locale === 'he'
      ? 'זה התחום שבחרתי לזוז בו עכשיו.'
      : 'This is the area I chose to move on now.';

  const whyThisDomain =
    locale === 'he'
      ? `בחרתי להתמקד כאן (דירוג ${domainScore}/10). ${leverageLine}${painCore ? ` מה שמפריע: ${painCore}.` : ''}`.trim()
      : `I chose to focus here (rated ${domainScore}/10). ${leverageLine}${painCore ? ` What bothers me: ${painCore}.` : ''}`.trim();

  return {
    whyThisDomain,
    whatBothersToday: painParts.join('. '),
    whatIfSucceeds: visionParts.join('. '),
    whatIfNothingChanges: inferCostOfInaction(locale, domainScore),
  };
}

export function buildHelpMeAnswers(
  locale: AppLocale,
  domain: LifeDomain,
  domainScore: number,
  domainScores: Record<LifeDomain, number>,
  input?: QuickClarificationInput
): ClarificationAnswers {
  const hasUserContent = Boolean(
    input &&
      (input.painTagIds.length > 0 ||
        input.painNote.trim().length > 0 ||
        input.visionTagIds.length > 0 ||
        input.visionNote.trim().length > 0)
  );

  if (hasUserContent && input) {
    const answers = buildQuickAnswers(locale, domain, domainScore, domainScores, input);
    const articulationNote =
      locale === 'he'
        ? ' המשתמש ביקש עזרה בניסוח — השתמש במילים ובפרטים שהוא כתב, לא תוכן גנרי.'
        : ' User asked for help articulating — use their exact words and details, not generic filler.';
    return {
      ...answers,
      whyThisDomain: answers.whyThisDomain + articulationNote,
    };
  }

  const lowest = isLowestDomain(domain, domainScores);

  return {
    whyThisDomain:
      locale === 'he'
        ? `דירגתי את התחום ב-${domainScore}/10. ${lowest ? 'זה התחום הכי מאתגר שלי כרגע.' : 'בחרתי להתמקד כאן.'} קשה לי לבטא במילים — אשמח שהמערכת תעזור לי לנסח.`
        : `I rated this area ${domainScore}/10. ${lowest ? 'This is my most challenging area right now.' : 'I chose to focus here.'} I find it hard to express in words — please help me articulate.`,
    whatBothersToday:
      locale === 'he'
        ? `הציון ${domainScore}/10 משקף שיש כאן משהו שמפריע, אבל קשה לי לנסח את זה.`
        : `My score of ${domainScore}/10 reflects something is bothering me, but I am not sure how to phrase it.`,
    whatIfSucceeds:
      locale === 'he'
        ? 'אני רוצה להרגיש טוב יותר בתחום הזה תוך 90 יום.'
        : 'I want to feel better in this area within 90 days.',
    whatIfNothingChanges: inferCostOfInaction(locale, domainScore),
  };
}
