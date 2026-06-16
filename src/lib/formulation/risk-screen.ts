import type {RiskAction, RiskLevel} from '@/lib/life-coach/types';

export type RiskScreenInput = {
  q1: 0 | 1 | null;
  q2: 0 | 1 | null;
  followUpConfirmed?: boolean | null;
  presentingConcernRaw?: string;
};

export type RiskScreenResult = {
  level: RiskLevel;
  action: RiskAction;
  needsFollowUp: boolean;
};

const ELEVATED_KEYWORDS_HE = [
  'לא רואה טעם',
  'מה הטעם',
  'רוצה להיעלם',
  'לא שווה',
  'עדיף שלא',
  'לא רוצה להיות',
];

const ELEVATED_KEYWORDS_EN = [
  'no point',
  "what's the point",
  'want to disappear',
  'not worth',
  "rather not be",
  'wish i was dead',
];

export function evaluateRiskScreen(input: RiskScreenInput): RiskScreenResult {
  const q1Yes = input.q1 === 1;
  const q2Yes = input.q2 === 1;

  if (q1Yes || q2Yes) {
    if (input.followUpConfirmed === false) {
      return {level: 'none', action: 'continue', needsFollowUp: false};
    }
    if (input.followUpConfirmed === true) {
      return {level: 'crisis', action: 'stop', needsFollowUp: false};
    }
    return {level: 'crisis', action: 'resources', needsFollowUp: true};
  }

  const text = (input.presentingConcernRaw ?? '').toLowerCase();
  const elevated =
    ELEVATED_KEYWORDS_HE.some((k) => text.includes(k)) ||
    ELEVATED_KEYWORDS_EN.some((k) => text.includes(k));

  if (elevated) {
    return {level: 'elevated', action: 'continue', needsFollowUp: false};
  }

  return {level: 'none', action: 'continue', needsFollowUp: false};
}
