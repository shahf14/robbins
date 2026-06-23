import type {AppLocale} from '@/i18n/config';
import {activeLifeContexts} from '@/lib/life-context-content';
import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';
import type {AffirmationItem} from '@/lib/morning-ritual-types';
import type {MorningRitualTone, MorningRitualYesterdayContext} from './yesterday-context';

type AffirmationStrategy =
  | 'comeback'
  | 'ambition'
  | 'calm_reset'
  | 'low_energy'
  | 'steady';

export type MorningAffirmationContext = {
  tone: MorningRitualTone;
  mood_before: number | null;
  energy: number | null;
  mood_tag: string | null;
  active_goal_domain: LifeDomain | null;
  main_blocker: string | null;
  yesterday_skip_count: number;
  life_contexts: LifeContextStatus[];
};

const COMEBACK_TAGS = ['calm', 'confidence', 'identity'] as const;
const AMBITION_TAGS = ['discipline', 'energy'] as const;
const HIGH_INTENSITY_TAGS = ['discipline', 'energy'] as const;

const DOMAIN_TAG_BIAS: Partial<Record<LifeDomain, readonly string[]>> = {
  health: ['energy', 'calm'],
  time: ['discipline', 'calm'],
  wealth: ['discipline', 'confidence'],
  career: ['discipline', 'confidence'],
  relationships: ['calm', 'identity'],
  mind: ['calm', 'identity'],
  spirit: ['calm', 'identity'],
  house_family: ['calm', 'energy'],
};

const BLOCKER_TAG_BIAS: Record<string, {prefer: string[]; exclude?: string[]}> = {
  low_energy: {prefer: ['calm', 'energy'], exclude: ['discipline']},
  no_time: {prefer: ['discipline', 'confidence']},
  emotional_resistance: {prefer: ['confidence', 'calm'], exclude: ['discipline']},
  family_chaos: {prefer: ['calm', 'confidence']},
  unclear_task: {prefer: ['identity', 'confidence']},
  forgot: {prefer: ['discipline', 'identity']},
  other: {prefer: ['calm', 'confidence']},
};

export function buildMorningAffirmationContext(input: {
  yesterday: MorningRitualYesterdayContext;
  moodBefore: number | null;
  lifeContexts: LifeContextStatus[];
}): MorningAffirmationContext {
  return {
    tone: input.yesterday.tone,
    mood_before: input.moodBefore,
    energy: input.yesterday.today_energy,
    mood_tag: input.yesterday.today_mood_tag,
    active_goal_domain: input.yesterday.active_goal_domain,
    main_blocker: input.yesterday.main_blocker,
    yesterday_skip_count: input.yesterday.yesterday_skip_count,
    life_contexts: input.lifeContexts,
  };
}

function resolveAffirmationFilter(context: MorningAffirmationContext): {
  preferredTags: string[];
  excludedTags: string[];
  strategy: AffirmationStrategy;
} {
  const preferred = new Set<string>();
  const excluded = new Set<string>();
  let strategy: AffirmationStrategy = 'steady';

  const isComeback =
    context.yesterday_skip_count >= 1 || context.tone === 'restart_gently';
  const isAmbition = !isComeback && context.tone === 'high_performance';

  if (isComeback) {
    strategy = 'comeback';
    COMEBACK_TAGS.forEach((tag) => preferred.add(tag));
    HIGH_INTENSITY_TAGS.forEach((tag) => excluded.add(tag));
  } else if (isAmbition) {
    strategy = 'ambition';
    AMBITION_TAGS.forEach((tag) => preferred.add(tag));
  }

  const blockerBias = context.main_blocker
    ? BLOCKER_TAG_BIAS[context.main_blocker]
    : null;
  if (blockerBias) {
    if (context.main_blocker === 'low_energy') strategy = 'low_energy';
    if (context.main_blocker === 'emotional_resistance' || context.main_blocker === 'family_chaos') {
      strategy = 'calm_reset';
    }
    blockerBias.prefer.forEach((tag) => preferred.add(tag));
    blockerBias.exclude?.forEach((tag) => excluded.add(tag));
  }

  if (context.mood_before != null) {
    if (context.mood_before <= 3) {
      preferred.add('calm');
      preferred.add('confidence');
      excluded.add('discipline');
    } else if (context.mood_before >= 7) {
      preferred.add('discipline');
      preferred.add('energy');
    }
  }

  if (context.energy != null) {
    if (context.energy <= 4) {
      preferred.add('calm');
      preferred.add('confidence');
      excluded.add('discipline');
    } else if (context.energy >= 8) {
      preferred.add('discipline');
      preferred.add('energy');
    }
  }

  if (context.mood_tag) {
    const anxious = ['anxious', 'stressed', 'overwhelmed', 'stuck'];
    const low = ['exhausted', 'burntOut', 'apathetic', 'flat'];
    if (anxious.includes(context.mood_tag)) {
      preferred.add('calm');
      preferred.add('confidence');
      excluded.add('discipline');
      strategy = strategy === 'steady' ? 'calm_reset' : strategy;
    }
    if (low.includes(context.mood_tag)) {
      preferred.add('calm');
      preferred.add('energy');
      excluded.add('discipline');
      strategy = 'low_energy';
    }
    if (['driven', 'inspired', 'disciplined', 'laserFocused'].includes(context.mood_tag)) {
      preferred.add('discipline');
      preferred.add('energy');
    }
  }

  if (context.active_goal_domain) {
    const domainTags = DOMAIN_TAG_BIAS[context.active_goal_domain];
    domainTags?.forEach((tag) => preferred.add(tag));
  }

  if (preferred.size === 0) {
    preferred.add('calm');
    preferred.add('identity');
  }

  return {
    preferredTags: [...preferred],
    excludedTags: [...excluded],
    strategy,
  };
}

function weightedPick(pool: AffirmationItem[]): AffirmationItem | null {
  if (pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of pool) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return pool[0];
}

function scoreAffirmation(
  item: AffirmationItem,
  preferredTags: readonly string[],
  excludedTags: readonly string[],
  lifeContexts: LifeContextStatus[]
): number {
  const matches = item.tags.filter((tag) => preferredTags.includes(tag)).length;
  const excludedHit = item.tags.some((tag) => excludedTags.includes(tag)) ? 4 : 0;
  const highIntensity = item.tags.some((tag) =>
    (HIGH_INTENSITY_TAGS as readonly string[]).includes(tag)
  )
    ? 1
    : 0;
  const active = activeLifeContexts(lifeContexts);
  const lifeBoost =
    active.length > 0 &&
    item.lifeContextInclude?.some((ctx) => active.includes(ctx))
      ? 2
      : 0;

  return matches * 3 + item.weight + lifeBoost - excludedHit - highIntensity;
}

export function pickMorningAffirmation(
  affirmations: AffirmationItem[],
  language: AppLocale,
  context: MorningAffirmationContext
): AffirmationItem | null {
  const {preferredTags, excludedTags} = resolveAffirmationFilter(context);
  const active = affirmations.filter(
    (item) => item.active && item.language === language && !item.hiddenFromLibrary && !item.isDraft
  );
  if (active.length === 0) return null;

  const today = new Date().toDateString();
  const notUsedToday = active.filter(
    (item) => !item.lastUsedAt || new Date(item.lastUsedAt).toDateString() !== today
  );
  let pool = notUsedToday.length > 0 ? notUsedToday : active;

  const withoutExcluded = pool.filter(
    (item) => !item.tags.some((tag) => excludedTags.includes(tag))
  );
  if (withoutExcluded.length > 0) pool = withoutExcluded;

  const tagMatched = pool.filter((item) =>
    item.tags.some((tag) => preferredTags.includes(tag))
  );
  if (tagMatched.length > 0) pool = tagMatched;

  if (pool.length > 1) {
    const ranked = [...pool].sort(
      (a, b) =>
        scoreAffirmation(b, preferredTags, excludedTags, context.life_contexts) -
        scoreAffirmation(a, preferredTags, excludedTags, context.life_contexts)
    );
    const topScore = scoreAffirmation(
      ranked[0],
      preferredTags,
      excludedTags,
      context.life_contexts
    );
    const topTier = ranked.filter(
      (item) =>
        scoreAffirmation(item, preferredTags, excludedTags, context.life_contexts) >=
        topScore - 1
    );
    return weightedPick(topTier);
  }

  return weightedPick(pool);
}
