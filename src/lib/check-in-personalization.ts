import type {AppLocale} from '@/i18n/config';
import affirmationsData from '@/data/affirmations.json';
import {dateToYMD} from '@/lib/date-utils';
import {activeLifeContexts} from '@/lib/life-context-content';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {
  CheckInEntry,
  CheckInInsightKey,
  CheckInRecommendationType,
  CheckInTag,
  CheckInTagCategory,
  LegacyCheckInEntry,
} from './check-in-types';

type RawAffirmation = (typeof affirmationsData.affirmations)[number] & {
  life_context_include?: string[];
};

type CheckInTagDefinition = {
  key: CheckInTag;
  category: CheckInTagCategory;
};

type LocalizedAffirmation = {
  id: string;
  title: string;
  text: string;
  tags: string[];
};

export type CheckInRecommendation = {
  insightKey: CheckInInsightKey;
  recommendationType: CheckInRecommendationType;
  affirmation: LocalizedAffirmation;
  stateScore: number;
  momentum: number;
  targetTags: string[];
  coachStateLabel: string;
};

export type CheckInInput = {
  focus: number;
  energy: number;
  selectedTags: CheckInTag[];
  priorityAction: string;
};

const MAX_CHECK_IN_TAGS = 2;

const CHECK_IN_TAG_DEFINITIONS: CheckInTagDefinition[] = [
  {key: 'driven', category: 'momentum'},
  {key: 'laserFocused', category: 'momentum'},
  {key: 'inspired', category: 'momentum'},
  {key: 'disciplined', category: 'momentum'},
  {key: 'stressed', category: 'stress'},
  {key: 'stuck', category: 'stress'},
  {key: 'distracted', category: 'stress'},
  {key: 'anxious', category: 'stress'},
  {key: 'exhausted', category: 'lowBattery'},
  {key: 'burntOut', category: 'lowBattery'},
  {key: 'apathetic', category: 'lowBattery'},
  {key: 'calm', category: 'grounded'},
  {key: 'aligned', category: 'grounded'},
  {key: 'grateful', category: 'grounded'},
];

const categoryWeight: Record<CheckInTagCategory, number> = {
  momentum: 12,
  stress: -12,
  lowBattery: -18,
  grounded: 7,
};

const coachStateByTag: Record<CheckInTag, string> = {
  driven: 'driven',
  laserFocused: 'driven',
  inspired: 'excited',
  disciplined: 'driven',
  stressed: 'overwhelmed',
  stuck: 'avoidant',
  distracted: 'confused',
  anxious: 'anxious',
  exhausted: 'flat',
  burntOut: 'disappointed',
  apathetic: 'flat',
  calm: 'grateful',
  aligned: 'grateful',
  grateful: 'grateful',
};

const legacyTagByEmotion: Record<LegacyCheckInEntry['emotion'], CheckInTag[]> = {
  driven: ['driven'],
  flat: ['apathetic'],
  anxious: ['anxious'],
  avoidant: ['stuck'],
  disappointed: ['burntOut'],
  excited: ['inspired'],
  overwhelmed: ['stressed'],
  confused: ['distracted'],
  angry: ['driven'],
  grateful: ['grateful'],
};

const stressTags = new Set<CheckInTag>(['stressed', 'stuck', 'distracted', 'anxious']);
const lowBatteryTags = new Set<CheckInTag>(['exhausted', 'burntOut', 'apathetic']);
const groundedTags = new Set<CheckInTag>(['calm', 'aligned', 'grateful']);
const momentumTags = new Set<CheckInTag>(['driven', 'laserFocused', 'inspired', 'disciplined']);

function getCheckInTagDefinition(tag: CheckInTag) {
  return CHECK_IN_TAG_DEFINITIONS.find((entry) => entry.key === tag);
}

export function recommendCheckIn(
  input: CheckInInput,
  locale: AppLocale,
  lifeContexts?: LifeContextStatus[]
): CheckInRecommendation {
  const focus = clampScore(input.focus);
  const energy = clampScore(input.energy);
  const selectedTags = input.selectedTags.slice(0, MAX_CHECK_IN_TAGS);
  const stateScore = buildStateScore(focus, energy);
  const momentum = buildMomentumScore({focus, energy, selectedTags});

  let insightKey: CheckInInsightKey;
  let recommendationType: CheckInRecommendationType;
  let targetTags: string[];
  let coachStateLabel: string;

  if (energy <= 4 && focus <= 5) {
    insightKey = 'lowEnergyLowFocus';
    recommendationType = 'guidedAudio';
    targetTags = ['energy', 'discipline'];
    coachStateLabel = 'reignite';
  } else if (focus <= 3 && hasAnyTag(selectedTags, stressTags)) {
    insightKey = 'stressReset';
    recommendationType = 'breatheReset';
    targetTags = ['calm', 'confidence'];
    coachStateLabel = 'reset';
  } else if (energy >= 8 && focus >= 8) {
    insightKey = 'peakState';
    recommendationType = 'depthWork';
    targetTags = ['identity', 'discipline'];
    coachStateLabel = 'peak';
  } else if (hasAnyTag(selectedTags, groundedTags) && focus >= 6) {
    insightKey = 'groundedClarity';
    recommendationType = 'depthWork';
    targetTags = ['calm', 'discipline'];
    coachStateLabel = 'grounded';
  } else if (energy <= 4 || hasAnyTag(selectedTags, lowBatteryTags)) {
    insightKey = 'rebuildMomentum';
    recommendationType = 'guidedAudio';
    targetTags = ['energy', 'confidence'];
    coachStateLabel = 'rebuild';
  } else {
    insightKey = 'steadyAction';
    recommendationType = focus >= 6 || hasAnyTag(selectedTags, momentumTags) ? 'depthWork' : 'guidedAudio';
    targetTags = focus >= 6 ? ['identity', 'discipline'] : ['calm', 'discipline'];
    coachStateLabel = selectedTags[0] ? coachStateByTag[selectedTags[0]] : 'driven';
  }

  const affirmation = pickAffirmationForTags(locale, targetTags, lifeContexts);

  return {
    insightKey,
    recommendationType,
    affirmation,
    stateScore,
    momentum,
    targetTags,
    coachStateLabel,
  };
}

function matchesLifeContext(
  entry: RawAffirmation,
  contexts: LifeContextStatus[] | undefined
): boolean {
  const include = entry.life_context_include;
  if (!include?.length) return true;
  if (!contexts?.length) return false;
  return include.some((c) => contexts.includes(c as LifeContextStatus));
}

function pickAffirmationForTags(
  locale: AppLocale,
  targetTags: string[],
  lifeContexts?: LifeContextStatus[]
): LocalizedAffirmation {
  const all = affirmationsData.affirmations as RawAffirmation[];
  const contextPool = all.filter((e) => matchesLifeContext(e, lifeContexts));
  const base = contextPool.length > 0 ? contextPool : all;

  const exactMatches = base.filter((entry) =>
    targetTags.every((tag) => entry.tags.includes(tag))
  );
  const partialMatches = base.filter((entry) =>
    targetTags.some((tag) => entry.tags.includes(tag))
  );
  const pool =
    exactMatches.length > 0 ? exactMatches
    : partialMatches.length > 0 ? partialMatches
    : base;
  const active = activeLifeContexts(lifeContexts);
  const contextBoosted =
    active.length > 0 &&
    pool.some((e) =>
      e.life_context_include?.some((c) => active.includes(c as LifeContextStatus))
    )
      ? pool.filter((e) =>
          e.life_context_include?.some((c) => active.includes(c as LifeContextStatus))
        )
      : pool;
  const index = buildSeedIndex(targetTags.join('-'), contextBoosted.length);

  return localizeAffirmation(contextBoosted[index], locale);
}

function localizeAffirmation(entry: RawAffirmation, locale: AppLocale): LocalizedAffirmation {
  return {
    id: entry.id,
    title: locale === 'he' ? entry.title_he : entry.title_en,
    text: locale === 'he' ? entry.text_he : entry.text_en,
    tags: entry.tags,
  };
}

function buildStateScore(focus: number, energy: number) {
  return Math.round(((focus + energy) / 20) * 100);
}

function buildMomentumScore({
  focus,
  energy,
  selectedTags,
}: {
  focus: number;
  energy: number;
  selectedTags: CheckInTag[];
}) {
  const base = buildStateScore(focus, energy);
  const tagWeight =
    selectedTags.length === 0
      ? 0
      : average(
          selectedTags.map((tag) => {
            const category = getCheckInTagDefinition(tag)?.category ?? 'momentum';
            return categoryWeight[category];
          })
        );

  return clampPercentage(Math.round(base + tagWeight));
}

function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return ['driven'] as CheckInTag[];
  }

  const filtered = value
    .filter(isString)
    .filter((tag): tag is CheckInTag => CHECK_IN_TAG_DEFINITIONS.some((entry) => entry.key === tag))
    .slice(0, MAX_CHECK_IN_TAGS);

  return filtered.length > 0 ? filtered : (['driven'] as CheckInTag[]);
}

function getPrimaryTag(tags: unknown) {
  const sanitized = sanitizeTags(tags);
  return sanitized[0];
}

function hasAnyTag(selectedTags: CheckInTag[], tagSet: Set<CheckInTag>) {
  return selectedTags.some((tag) => tagSet.has(tag));
}

function buildSeedIndex(seed: string, length: number) {
  if (length <= 1) {
    return 0;
  }

  const today = dateToYMD(new Date());
  const combined = `${today}:${seed}`;
  let total = 0;

  for (const char of combined) {
    total += char.charCodeAt(0);
  }

  return total % length;
}

function clampScore(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(5, value));
}

function completionRate(entries: CheckInEntry[]) {
  if (entries.length === 0) {
    return 0;
  }

  return entries.filter((entry) => entry.challengeDone).length / entries.length;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isWithinLastDays(value: string, days: number) {
  const createdAt = new Date(value).getTime();
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;

  return now - createdAt <= windowMs;
}

function isWithinDayRange(value: string, minDays: number, maxDays: number) {
  const createdAt = new Date(value).getTime();
  const now = Date.now();
  const ageMs = now - createdAt;
  const minMs = minDays * 24 * 60 * 60 * 1000;
  const maxMs = maxDays * 24 * 60 * 60 * 1000;

  return ageMs >= minMs && ageMs <= maxMs;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
