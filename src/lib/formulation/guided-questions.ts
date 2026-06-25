import guidedQuestionsBank from '@/data/formulation-guided-questions.json';
import type {AppLocale} from '@/i18n/config';
import {resolveGenderedHebrewText, resolveParticipantGender} from '@/lib/gendered-copy';
import {loadUserPreferences} from '@/lib/user-preferences';
import type {FormulationSession, LifeContextStatus} from '@/lib/life-coach/types';

/** Profile inputs for filtering step-3 questions (extend as step 1 grows). */
export type GuidedQuestionProfile = {
  life_context_statuses: LifeContextStatus[];
  gender?: 'female' | 'male' | null;
  age?: number | null;
};

export type GuidedQuestionPolarity = 'positive' | 'negative';

type GuidedQuestionGender = 'female' | 'male';

/** One row in formulation-guided-questions.json — flat fields for editors. */
export type GuidedQuestionEntry = {
  id: string;
  name: string;
  body_he: string;
  body_en: string;
  polarity: GuidedQuestionPolarity;
  domain: string;
  pool: 'universal' | 'contextual';
  priority: number;
  life_context_include: LifeContextStatus[];
  life_context_exclude: LifeContextStatus[];
  gender_include: GuidedQuestionGender[];
  age_min: number | null;
  age_max: number | null;
  active: boolean;
  editor_notes?: string;
};

export type GuidedQuestionsBank = {
  version: number;
  meta: Record<string, unknown>;
  questions: GuidedQuestionEntry[];
};

export const GUIDED_QUESTIONS_BANK = guidedQuestionsBank as GuidedQuestionsBank;

const questionById = new Map(
  GUIDED_QUESTIONS_BANK.questions.map((q) => [q.id, q] as const)
);

const DOMAIN_SUMMARY_HE: Record<string, string> = {
  sleep: 'שינה',
  energy: 'אנרגיה',
  mood: 'מצב רוח',
  anxiety: 'דאגות',
  self: 'ביקורת עצמית',
  body: 'גוף',
  behavior: 'הימנעות',
  connection: 'בדידות',
  cognition: 'ריכוז',
  work_study: 'עבודה/לימודים',
  work: 'עבודה',
  drive: 'מוטיבציה',
  agency: 'שליטה',
  relationships: 'יחסים',
  family: 'משפחה',
  study: 'לימודים',
  social: 'חברתי',
  parenting: 'הורות',
  caregiving: 'טיפול',
  transition: 'מעבר',
  identity: 'זהות',
  general: 'כללי',
};

const DOMAIN_SUMMARY_EN: Record<string, string> = {
  sleep: 'sleep',
  energy: 'energy',
  mood: 'mood',
  anxiety: 'worry',
  self: 'self-criticism',
  body: 'body',
  behavior: 'avoidance',
  connection: 'loneliness',
  cognition: 'focus',
  work_study: 'work/study',
  work: 'work',
  drive: 'motivation',
  agency: 'control',
  relationships: 'relationships',
  family: 'family',
  study: 'studies',
  social: 'social',
  parenting: 'parenting',
  caregiving: 'caregiving',
  transition: 'transition',
  identity: 'identity',
  general: 'general',
};

export function getGuidedQuestionById(id: string): GuidedQuestionEntry | undefined {
  return questionById.get(id);
}

export function getGuidedQuestionBody(
  question: GuidedQuestionEntry,
  locale: AppLocale,
  gender?: GuidedQuestionProfile['gender']
): string {
  if (locale !== 'he') return question.body_en;
  const resolvedGender = resolveParticipantGender(
    gender ?? loadUserPreferences().gender ?? null
  );
  return resolveGenderedHebrewText(question.body_he, resolvedGender);
}

export function getPolarityForQuestionId(id: string): GuidedQuestionPolarity {
  return questionById.get(id)?.polarity ?? 'negative';
}

export function profileFromFormulationSession(
  session: Pick<
    FormulationSession,
    'life_context_statuses' | 'participant_gender' | 'participant_age'
  >
): GuidedQuestionProfile {
  const gender = session.participant_gender;
  return {
    life_context_statuses: session.life_context_statuses,
    gender: gender === 'female' || gender === 'male' ? gender : null,
    age: session.participant_age,
  };
}

export function ratingSummaryLabel(id: string, locale: AppLocale): string {
  const q = questionById.get(id);
  if (!q) return id;
  if (locale === 'he') return q.name || (DOMAIN_SUMMARY_HE[q.domain] ?? id);
  return DOMAIN_SUMMARY_EN[q.domain] ?? q.name ?? id;
}

export function validatePassiveRatingsForProfile(
  ratings: Array<{key: string; score: number}>,
  profile: GuidedQuestionProfile
): {ok: boolean; expectedIds: string[]} {
  const expected = new Set(getRelevantGuidedQuestionIds(profile));
  const expectedIds = [...expected];
  if (ratings.length !== expected.size) {
    return {ok: false, expectedIds};
  }
  for (const r of ratings) {
    if (!expected.has(r.key)) return {ok: false, expectedIds};
  }
  for (const id of expected) {
    if (!ratings.some((r) => r.key === id)) return {ok: false, expectedIds};
  }
  return {ok: true, expectedIds};
}

function matchesLifeContextInclude(
  include: LifeContextStatus[],
  statuses: LifeContextStatus[]
): boolean {
  if (include.length === 0) return true;
  return include.some((s) => statuses.includes(s));
}

function matchesLifeContextExclude(
  exclude: LifeContextStatus[],
  statuses: LifeContextStatus[]
): boolean {
  if (exclude.length === 0) return true;
  return !exclude.some((s) => statuses.includes(s));
}

function matchesGenderInclude(
  include: GuidedQuestionGender[],
  gender: GuidedQuestionProfile['gender']
): boolean {
  if (include.length === 0) return true;
  if (gender == null) return true;
  return include.includes(gender);
}

function matchesAgeRange(
  ageMin: number | null,
  ageMax: number | null,
  age: GuidedQuestionProfile['age']
): boolean {
  if (age == null) return true;
  if (ageMin != null && age < ageMin) return false;
  if (ageMax != null && age > ageMax) return false;
  return true;
}

/** Whether a bank entry should be shown for this profile. */
function isGuidedQuestionRelevant(
  question: GuidedQuestionEntry,
  profile: GuidedQuestionProfile
): boolean {
  if (!question.active) return false;

  const statuses = profile.life_context_statuses;

  if (statuses.includes('prefer_not')) {
    return question.pool === 'universal';
  }

  return (
    matchesLifeContextInclude(question.life_context_include, statuses) &&
    matchesLifeContextExclude(question.life_context_exclude, statuses) &&
    matchesGenderInclude(question.gender_include, profile.gender) &&
    matchesAgeRange(question.age_min, question.age_max, profile.age)
  );
}

/** Active questions for step 3, sorted by priority (highest first). */
export function getRelevantGuidedQuestions(profile: GuidedQuestionProfile): GuidedQuestionEntry[] {
  return GUIDED_QUESTIONS_BANK.questions
    .filter((q) => isGuidedQuestionRelevant(q, profile))
    .sort((a, b) => b.priority - a.priority);
}

function getRelevantGuidedQuestionIds(profile: GuidedQuestionProfile): string[] {
  return getRelevantGuidedQuestions(profile).map((q) => q.id);
}
