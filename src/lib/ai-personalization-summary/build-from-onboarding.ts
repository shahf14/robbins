import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {
  AiPersonalizationSummary,
  EmotionalRisk,
  OnboardingPersonalizationInput,
  PreferredActionSize,
} from './types';

const FEAR_OF_FAILURE = [
  /פחד מכישלון/,
  /פחד.*כישל/,
  /מפחד.*כישל/,
  /fear of fail/i,
  /afraid.*fail/i,
  /afraid to (try|start|change)/i,
  /מפחד לעשות שינוי/,
];

const FEAR_GENERAL = [/(פחד|מפחד|anxious|afraid|fear)/i];

const SHAME = [/(אשמה|מרגיש.*אשם|guilty|shame|ashamed)/i];

const BURNOUT = [
  /(שחיקה|עייפ|נשבר|exhaust|burnout|drained|depleted)/i,
  /(מפוזר|scattered|overwhelm)/i,
];

const OVERWLOAD = [/(מבולגן|מעמיס|chaos|overwhelm|too much)/i, /(ילדים|משפח|family drains)/i];

const ISOLATION = [/(מרוחק|distant|alone|lonely|ניתוק)/i];

const NO_TIME = [
  /אין לי זמן/,
  /אין זמן/,
  /ללא זמן/,
  /\bno time\b/i,
  /\btoo busy\b/i,
];

const LOW_ENERGY = [/(עייפ|אנרגיה נמוכ|exhausted|low energy|tired)/i];

const LACK_OF_CLARITY = [/(לא ברור|מבולבל|unclear|confus|אין תוכנית)/i];

const LIFE_CONTEXT_BLOCKERS: Partial<Record<LifeContextStatus, string>> = {
  new_parent: 'family_overload',
  caregiver: 'family_overload',
  manager: 'no_time',
  student: 'no_time',
  between_jobs: 'fear_of_failure',
};

function collectText(input: OnboardingPersonalizationInput): string {
  const parts = [
    input.life_context_note,
    input.answers?.whyThisDomain,
    input.answers?.whatBothersToday,
    input.answers?.whatIfNothingChanges,
    input.answers?.whatIfSucceeds,
    input.insight,
    input.goal_title,
    input.goal_description,
  ];
  return parts.filter(Boolean).join('\n');
}

function matchesAny(blob: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(blob));
}

function uniqueNonEmpty(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function detectLikelyBlockers(
  blob: string,
  lifeContexts: LifeContextStatus[]
): string[] {
  const blockers: string[] = [];

  if (matchesAny(blob, FEAR_OF_FAILURE) || matchesAny(blob, FEAR_GENERAL)) {
    blockers.push('fear_of_failure');
  }
  if (matchesAny(blob, NO_TIME)) blockers.push('no_time');
  if (matchesAny(blob, LOW_ENERGY)) blockers.push('low_energy');
  if (matchesAny(blob, LACK_OF_CLARITY)) blockers.push('lack_of_clarity');
  if (matchesAny(blob, OVERWLOAD)) blockers.push('family_overload');
  if (matchesAny(blob, SHAME)) blockers.push('shame');

  for (const ctx of lifeContexts) {
    const mapped = LIFE_CONTEXT_BLOCKERS[ctx];
    if (mapped) blockers.push(mapped);
  }

  return uniqueNonEmpty(blockers);
}

function detectEmotionalRisk(blob: string, likelyBlockers: string[]): EmotionalRisk[] {
  const risks: EmotionalRisk[] = [];

  if (
    likelyBlockers.includes('fear_of_failure') ||
    matchesAny(blob, FEAR_OF_FAILURE) ||
    matchesAny(blob, FEAR_GENERAL)
  ) {
    risks.push('fear_of_failure');
  }
  if (likelyBlockers.includes('shame') || matchesAny(blob, SHAME)) {
    risks.push('shame');
  }
  if (matchesAny(blob, BURNOUT)) risks.push('burnout');
  if (likelyBlockers.includes('family_overload') || matchesAny(blob, OVERWLOAD)) {
    risks.push('overwhelm');
  }
  if (matchesAny(blob, ISOLATION)) risks.push('isolation');

  return uniqueNonEmpty(risks) as EmotionalRisk[];
}

function extractMotivators(input: OnboardingPersonalizationInput): string[] {
  const motivators: string[] = [];
  const succeed = input.answers?.whatIfSucceeds?.trim();
  const why = input.answers?.whyThisDomain?.trim();
  const insight = input.insight?.trim();

  if (succeed) motivators.push(succeed.slice(0, 200));
  if (why && why !== succeed) motivators.push(why.slice(0, 200));
  if (insight) motivators.push(insight.slice(0, 200));

  return uniqueNonEmpty(motivators).slice(0, 4);
}

function resolveActionSize(
  input: OnboardingPersonalizationInput,
  likelyBlockers: string[]
): PreferredActionSize {
  const time = input.available_time ?? 10;
  const intensity = input.intensity_preference ?? 'balanced';
  const fearSignal = likelyBlockers.includes('fear_of_failure');

  if (fearSignal || time <= 10 || intensity === 'gentle') return 'micro';
  if (time >= 30 && intensity === 'intense') return 'standard';
  return 'small';
}

function resolveIdentityGoal(input: OnboardingPersonalizationInput): string {
  const succeed = input.answers?.whatIfSucceeds?.trim();
  if (succeed) return succeed.slice(0, 240);
  const goal = input.goal_title?.trim();
  if (goal) return goal.slice(0, 240);
  return input.locale === 'he'
    ? 'אדם שמתקדם בקצב קטן ועקבי'
    : 'Someone who moves forward in small, steady steps';
}

function resolveTone(
  locale: OnboardingPersonalizationInput['locale'],
  emotionalRisk: EmotionalRisk[],
  coachingStyle: OnboardingPersonalizationInput['coaching_style']
): AiPersonalizationSummary['tone'] {
  const highShame =
    emotionalRisk.includes('fear_of_failure') || emotionalRisk.includes('shame');
  const shame_sensitivity: AiPersonalizationSummary['tone']['shame_sensitivity'] = highShame
    ? 'high'
    : emotionalRisk.includes('burnout') || emotionalRisk.includes('overwhelm')
      ? 'medium'
      : 'low';

  if (locale === 'he') {
    const preferredParts = ['חם', 'מעודד'];
    const avoidParts = ['לחץ', 'ביקורת'];

    if (highShame) {
      preferredParts.push('ניסוי קטן', 'בטוח לנסות', 'בלי התחייבות');
      avoidParts.push('אשמה', 'כישלון', '"חייב"', 'ביקורת עצמית');
    } else if (coachingStyle === 'direct') {
      preferredParts.push('ישיר', 'ממוקד פעולה');
    } else if (coachingStyle === 'motivational') {
      preferredParts.push('מעורר השראה', 'אנרגטי');
    }

    return {
      preferred_tone: preferredParts.join(', '),
      avoid_tone: avoidParts.join(', '),
      shame_sensitivity,
    };
  }

  const preferredParts = ['warm', 'encouraging'];
  const avoidParts = ['pressure', 'harsh criticism'];

  if (highShame) {
    preferredParts.push('small experiment', 'safe to try', 'no commitment required');
    avoidParts.push('shame', 'guilt', 'failure', 'must', 'self-criticism');
  } else if (coachingStyle === 'direct') {
    preferredParts.push('concise', 'action-focused');
  } else if (coachingStyle === 'motivational') {
    preferredParts.push('inspiring', 'energetic');
  }

  return {
    preferred_tone: preferredParts.join(', '),
    avoid_tone: avoidParts.join(', '),
    shame_sensitivity,
  };
}

export function buildAiPersonalizationSummaryFromOnboarding(
  input: OnboardingPersonalizationInput
): AiPersonalizationSummary {
  const blob = collectText(input);
  const lifeContexts = input.life_context_statuses ?? [];
  const likely_blockers = detectLikelyBlockers(blob, lifeContexts);
  const emotional_risk = detectEmotionalRisk(blob, likely_blockers);

  return {
    motivators: extractMotivators(input),
    likely_blockers,
    preferred_action_size: resolveActionSize(input, likely_blockers),
    emotional_risk,
    tone: resolveTone(input.locale, emotional_risk, input.coaching_style),
    identity_goal: resolveIdentityGoal(input),
    generated_at: new Date().toISOString(),
    source: 'onboarding',
    locale: input.locale,
    primary_domain: input.primary_domain ?? null,
  };
}
