import type {AppLocale} from '@/i18n/config';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
  getPolarityForQuestionId,
  ratingSummaryLabel,
} from '@/lib/formulation/guided-questions';
import type {FormulationDimensions, LifeContextStatus} from '@/lib/life-coach/types';

export type PassiveRatingItem = {
  key: string;
  score: number;
};

export type RatingFollowUp = {
  key: string;
  questionKey: string;
  /** higher = more urgent */
  weight: number;
  /** Step-3 rating id that triggered this follow-up (null for context-only prompts). */
  source_rating_key: string | null;
};

const FOLLOW_UP_BY_KEY: Record<string, Omit<RatingFollowUp, 'weight' | 'source_rating_key'>> = {
  sleep_quality: {key: 'sleep_follow', questionKey: 'followUps.sleep'},
  new_parent_sleep_fragmentation: {key: 'sleep_follow', questionKey: 'followUps.sleep'},
  day_energy: {key: 'energy_follow', questionKey: 'followUps.energy'},
  focus: {key: 'focus_follow', questionKey: 'followUps.focus'},
  low_mood: {key: 'mood_follow', questionKey: 'followUps.mood'},
  worry_load: {key: 'worry_follow', questionKey: 'followUps.worry'},
  work_pressure: {key: 'work_follow', questionKey: 'followUps.work'},
  student_academic_pressure: {key: 'work_follow', questionKey: 'followUps.work'},
  student_exam_anxiety: {key: 'worry_follow', questionKey: 'followUps.worry'},
  manager_team_overload: {key: 'work_follow', questionKey: 'followUps.work'},
  manager_boundary_bleed: {key: 'work_follow', questionKey: 'followUps.contextWork'},
  relationship_strain: {key: 'relationship_follow', questionKey: 'followUps.relationship'},
  new_parent_partner_disconnect: {key: 'relationship_follow', questionKey: 'followUps.relationship'},
  family_load: {key: 'family_follow', questionKey: 'followUps.family'},
  self_criticism: {key: 'self_talk_follow', questionKey: 'followUps.selfTalk'},
  avoidance: {key: 'avoidance_follow', questionKey: 'followUps.avoidance'},
  body_tension: {key: 'body_follow', questionKey: 'followUps.body'},
  appetite_shift: {key: 'appetite_follow', questionKey: 'followUps.appetite'},
  loneliness: {key: 'loneness_follow', questionKey: 'followUps.loneliness'},
  motivation: {key: 'motivation_follow', questionKey: 'followUps.motivation'},
  sense_of_control: {key: 'control_follow', questionKey: 'followUps.control'},
  caregiver_emotional_drain: {key: 'care_follow', questionKey: 'followUps.contextCare'},
  transition_instability: {key: 'transition_follow', questionKey: 'followUps.contextTransition'},
  between_jobs_financial_stress: {key: 'transition_follow', questionKey: 'followUps.contextTransition'},
};

const DOMAIN_FOLLOW_UP: Record<string, Omit<RatingFollowUp, 'weight' | 'source_rating_key'>> = {
  sleep: {key: 'sleep_follow', questionKey: 'followUps.sleep'},
  energy: {key: 'energy_follow', questionKey: 'followUps.energy'},
  mood: {key: 'mood_follow', questionKey: 'followUps.mood'},
  anxiety: {key: 'worry_follow', questionKey: 'followUps.worry'},
  cognition: {key: 'focus_follow', questionKey: 'followUps.focus'},
  work_study: {key: 'work_follow', questionKey: 'followUps.work'},
  work: {key: 'work_follow', questionKey: 'followUps.work'},
  study: {key: 'work_follow', questionKey: 'followUps.work'},
  relationships: {key: 'relationship_follow', questionKey: 'followUps.relationship'},
  family: {key: 'family_follow', questionKey: 'followUps.family'},
  parenting: {key: 'family_follow', questionKey: 'followUps.family'},
  caregiving: {key: 'care_follow', questionKey: 'followUps.contextCare'},
  transition: {key: 'transition_follow', questionKey: 'followUps.contextTransition'},
  identity: {key: 'transition_follow', questionKey: 'followUps.contextTransition'},
  self: {key: 'self_talk_follow', questionKey: 'followUps.selfTalk'},
  body: {key: 'body_follow', questionKey: 'followUps.body'},
  behavior: {key: 'avoidance_follow', questionKey: 'followUps.avoidance'},
  connection: {key: 'loneness_follow', questionKey: 'followUps.loneliness'},
  drive: {key: 'motivation_follow', questionKey: 'followUps.motivation'},
  agency: {key: 'control_follow', questionKey: 'followUps.control'},
  social: {key: 'mood_follow', questionKey: 'followUps.mood'},
  general: {key: 'general_follow', questionKey: 'followUps.worry'},
};

const MAX_FOLLOW_UPS = 3;

function followUpMetaForKey(
  key: string
): Omit<RatingFollowUp, 'weight' | 'source_rating_key'> | undefined {
  if (FOLLOW_UP_BY_KEY[key]) return FOLLOW_UP_BY_KEY[key];
  const domain = getGuidedQuestionById(key)?.domain;
  if (domain && DOMAIN_FOLLOW_UP[domain]) return DOMAIN_FOLLOW_UP[domain];
  return undefined;
}

export function distressWeight(key: string, score: number): number {
  const s = Math.min(5, Math.max(1, score));
  if (getPolarityForQuestionId(key) === 'positive') {
    return 6 - s;
  }
  return s;
}

export function getRatingFollowUps(
  ratings: PassiveRatingItem[],
  lifeContexts: LifeContextStatus[] = []
): RatingFollowUp[] {
  const scored = ratings
    .map((r) => ({
      key: r.key,
      weight: distressWeight(r.key, r.score),
      meta: followUpMetaForKey(r.key),
    }))
    .filter((r) => r.meta && r.weight >= 3)
    .sort((a, b) => b.weight - a.weight);

  // One chip card per questionKey; answer key = source rating id (unique, ties to step 3).
  const byQuestionKey = new Map<string, RatingFollowUp>();
  for (const r of scored) {
    if (!r.meta) continue;
    const existing = byQuestionKey.get(r.meta.questionKey);
    if (!existing || r.weight > existing.weight) {
      byQuestionKey.set(r.meta.questionKey, {
        key: r.key,
        questionKey: r.meta.questionKey,
        weight: r.weight,
        source_rating_key: r.key,
      });
    }
  }
  const fromRatings = [...byQuestionKey.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_FOLLOW_UPS);

  if (fromRatings.length >= MAX_FOLLOW_UPS) {
    return fromRatings;
  }

  const contextBoost: Partial<Record<LifeContextStatus, RatingFollowUp>> = {
    new_parent: {
      key: 'ctx_parent',
      questionKey: 'followUps.contextParent',
      weight: 2,
      source_rating_key: null,
    },
    student: {
      key: 'ctx_student',
      questionKey: 'followUps.contextStudent',
      weight: 2,
      source_rating_key: null,
    },
    manager: {
      key: 'ctx_work',
      questionKey: 'followUps.contextWork',
      weight: 2,
      source_rating_key: null,
    },
    caregiver: {
      key: 'ctx_care',
      questionKey: 'followUps.contextCare',
      weight: 2,
      source_rating_key: null,
    },
    between_jobs: {
      key: 'ctx_transition',
      questionKey: 'followUps.contextTransition',
      weight: 2,
      source_rating_key: null,
    },
  };

  for (const ctx of lifeContexts) {
    const extra = contextBoost[ctx];
    if (extra && !fromRatings.some((f) => f.key === extra.key)) {
      fromRatings.push(extra);
      if (fromRatings.length >= MAX_FOLLOW_UPS) break;
    }
  }

  return fromRatings.slice(0, MAX_FOLLOW_UPS);
}

export function overallIntensityFromRatings(ratings: PassiveRatingItem[]): number {
  if (ratings.length === 0) return 5;
  const avg =
    ratings.reduce((sum, r) => sum + distressWeight(r.key, r.score), 0) / ratings.length;
  return Math.min(10, Math.max(0, Math.round((avg / 5) * 10)));
}

export function deriveConcernSummary(ratings: PassiveRatingItem[], locale: AppLocale): string {
  const top = ratings
    .map((r) => ({key: r.key, w: distressWeight(r.key, r.score)}))
    .sort((a, b) => b.w - a.w)
    .slice(0, 5);

  return top
    .map((r) => {
      const q = getGuidedQuestionById(r.key);
      return q ? getGuidedQuestionBody(q, locale) : ratingSummaryLabel(r.key, locale);
    })
    .join(locale === 'he' ? ' · ' : ' · ');
}

export function buildPassiveReflection(ratings: PassiveRatingItem[], locale: AppLocale): string {
  const summary = deriveConcernSummary(ratings, locale);
  if (locale === 'he') {
    return `מה שסימנת מצביע בעיקר על: ${summary}. זו נקודת פתיחה — לא אבחון.`;
  }
  return `What you marked points mainly to: ${summary}. This is a starting point — not a diagnosis.`;
}

function scoreOrDefault(ratings: PassiveRatingItem[], key: string, fallback = 3): number {
  return ratings.find((r) => r.key === key)?.score ?? fallback;
}

export function dimensionsFromRatings(ratings: PassiveRatingItem[]): FormulationDimensions {
  const intensity = overallIntensityFromRatings(ratings);
  const contexts: string[] = [];
  const systems: string[] = [];

  const workKeys = [
    'work_pressure',
    'student_academic_pressure',
    'manager_team_overload',
    'combo_student_and_manager_burnout',
  ];
  if (workKeys.some((k) => distressWeight(k, scoreOrDefault(ratings, k)) >= 3)) {
    systems.push('work');
  }

  const relationshipKeys = ['relationship_strain', 'new_parent_partner_disconnect'];
  if (relationshipKeys.some((k) => distressWeight(k, scoreOrDefault(ratings, k)) >= 3)) {
    systems.push('relationship');
  }

  const familyKeys = ['family_load', 'new_parent_guilt_rest', 'caregiver_emotional_drain'];
  if (familyKeys.some((k) => distressWeight(k, scoreOrDefault(ratings, k)) >= 3)) {
    systems.push('family');
  }

  const sleepKeys = ['sleep_quality', 'new_parent_sleep_fragmentation'];
  if (sleepKeys.some((k) => distressWeight(k, scoreOrDefault(ratings, k)) >= 3)) {
    contexts.push('evening');
  }

  if (distressWeight('day_energy', scoreOrDefault(ratings, 'day_energy')) >= 3) {
    contexts.push('after_work');
  }

  return {
    frequency_per_week: null,
    intensity_0_10: intensity,
    contexts,
    mind_body: {
      sleep_changed: sleepKeys.some(
        (k) => distressWeight(k, scoreOrDefault(ratings, k)) >= 3
      ),
      appetite_changed:
        distressWeight('appetite_shift', scoreOrDefault(ratings, 'appetite_shift')) >= 3,
      body_tension:
        distressWeight('body_tension', scoreOrDefault(ratings, 'body_tension')) >= 3,
      energy_changed:
        distressWeight('day_energy', scoreOrDefault(ratings, 'day_energy')) >= 3,
      skipped: false,
    },
    systems,
    dimension_skips: [],
  };
}
