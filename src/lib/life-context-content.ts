import type {AppLocale} from '@/i18n/config';
import {formatLifeContextLabels} from '@/lib/life-context-labels';
import type {PersonalDayPhase} from '@/lib/schedule-content';
import {personalDashboardSubtitleKey} from '@/lib/schedule-content';
import type {CheckInEntry, CheckInTag} from '@/lib/check-in-types';
import type {EveningMode} from '@/lib/evening-reset-types';
import type {BreathingType, RitualMode} from '@/lib/morning-ritual-types';
import type {
  AvailableTimePerDay,
  DomainBlocker,
  LifeContextStatus,
  LifeDomain,
  NonHealthDomain,
} from '@/lib/life-coach/types';
import {DOMAIN_CATEGORIES} from '@/lib/life-coach/types';

const ACTIVE_CONTEXTS: LifeContextStatus[] = [
  'student',
  'new_parent',
  'manager',
  'caregiver',
  'between_jobs',
  'other',
];

export function activeLifeContexts(
  statuses: LifeContextStatus[] | null | undefined
): LifeContextStatus[] {
  return (statuses ?? []).filter((s) => s !== 'prefer_not' && ACTIVE_CONTEXTS.includes(s));
}

const CONTEXT_COMBO_KEYS: Record<string, string> = {
  'new_parent|student': 'studentNewParent',
  'caregiver|new_parent': 'newParentCaregiver',
  'caregiver|manager': 'managerCaregiver',
  'manager|student': 'studentManager',
};

type LifeContextProfile =
  | {type: 'none'}
  | {type: 'single'; key: LifeContextStatus}
  | {type: 'combo'; key: string}
  | {type: 'multi'; keys: LifeContextStatus[]};

function resolveLifeContextProfile(
  statuses: LifeContextStatus[] | null | undefined
): LifeContextProfile {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) {
    return {type: 'none'};
  }
  if (active.length === 1) {
    return {type: 'single', key: active[0]};
  }
  const comboKey = CONTEXT_COMBO_KEYS[[...active].sort().join('|')];
  if (comboKey) {
    return {type: 'combo', key: comboKey};
  }
  return {type: 'multi', keys: active};
}

function contextScopedKey(
  profile: LifeContextProfile,
  base: string,
  fallback = 'other'
): string {
  if (profile.type === 'none') {
    return `${base}.${fallback}`;
  }
  if (profile.type === 'single') {
    return `${base}.${profile.key}`;
  }
  if (profile.type === 'combo') {
    return `${base}.combo.${profile.key}`;
  }
  return `${base}.multi`;
}

export function lifeContextChipLabel(
  statuses: LifeContextStatus[] | null | undefined,
  locale: AppLocale,
  note?: string | null
): string | null {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) return null;
  const labels = formatLifeContextLabels(active, locale);
  const trimmedNote = note?.trim();
  if (active.includes('other') && trimmedNote) {
    const otherLabel = formatLifeContextLabels(['other'], locale)[0];
    const rest = labels.filter((l) => l !== otherLabel);
    const otherPart = `${otherLabel} — ${trimmedNote}`;
    return [...rest, otherPart].join(locale === 'he' ? ' · ' : ' · ');
  }
  return labels.join(locale === 'he' ? ' · ' : ' · ');
}

const DEFAULT_CHECKIN_STARTERS = [
  'checkin.priorityActionStarter1',
  'checkin.priorityActionStarter2',
  'checkin.priorityActionStarter3',
] as const;

/** i18n key under lifeContext.reflection.hint.* */
export function reflectionBlockerHintKey(
  statuses: LifeContextStatus[] | null | undefined
): string | null {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return null;
  return contextScopedKey(profile, 'lifeContext.reflection.hint');
}

type Step2HintInput = {
  statuses: LifeContextStatus[];
  lowestDomain: LifeDomain | null;
  domainScores: Record<LifeDomain, number>;
};

/** Returns i18n key + values for onboarding step 2 hint, or null for default. */
export function onboardingStep2Hint(
  input: Step2HintInput
): {key: string; values: Record<string, string>} | null {
  const {statuses, lowestDomain, domainScores} = input;
  if (!lowestDomain) return null;

  const domainLabelKey = `lifeCoach.domains.${lowestDomain}.label`;
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'combo') {
    return {
      key: `lifeContext.onboarding.step2.combo.${profile.key}`,
      values: {domain: domainLabelKey},
    };
  }
  if (profile.type === 'multi') {
    return {
      key: 'lifeContext.onboarding.step2.multi',
      values: {domain: domainLabelKey},
    };
  }
  const ctx = profile.type === 'single' ? profile.key : null;

  if (!ctx) {
    return {key: 'onboarding.step2SelectHint', values: {domain: domainLabelKey}};
  }

  const healthLow = domainScores.health <= 4;
  const mindLow = domainScores.mind <= 4;
  const careerLow = domainScores.career <= 4;

  if (ctx === 'new_parent' && healthLow) {
    return {key: 'lifeContext.onboarding.step2.newParentHealth', values: {domain: domainLabelKey}};
  }
  if (ctx === 'student' && mindLow) {
    return {key: 'lifeContext.onboarding.step2.studentMind', values: {domain: domainLabelKey}};
  }
  if (ctx === 'between_jobs' && careerLow) {
    return {key: 'lifeContext.onboarding.step2.betweenJobsCareer', values: {domain: domainLabelKey}};
  }
  if (ctx === 'manager' && domainScores.time <= 4) {
    return {key: 'lifeContext.onboarding.step2.managerTime', values: {domain: domainLabelKey}};
  }
  if (ctx === 'caregiver' && domainScores.relationships <= 4) {
    return {key: 'lifeContext.onboarding.step2.caregiverRelations', values: {domain: domainLabelKey}};
  }

  return {key: `lifeContext.onboarding.step2.${ctx}`, values: {domain: domainLabelKey}};
}

const CATEGORY_BOOST: Partial<
  Record<LifeContextStatus, Partial<Record<NonHealthDomain, string[]>>>
> = {
  student: {
    career: ['skill_development', 'learning', 'networking'],
    mind: ['focus', 'stress_management', 'learning'],
    time: ['priorities', 'procrastination', 'weekly_planning'],
  },
  new_parent: {
    relationships: ['partnership', 'family_time', 'communication'],
    time: ['work_life_balance', 'priorities', 'morning_routine'],
    house_family: ['family_routines', 'home_order', 'chores'],
    mind: ['stress_management', 'emotional_regulation'],
  },
  manager: {
    time: ['delegation', 'work_life_balance', 'priorities'],
    career: ['leadership', 'visibility', 'work_quality'],
    mind: ['stress_management', 'emotional_regulation'],
  },
  caregiver: {
    relationships: ['boundaries', 'communication', 'family_time'],
    mind: ['stress_management', 'emotional_regulation'],
    spirit: ['inner_peace', 'gratitude'],
  },
  between_jobs: {
    career: ['skill_development', 'side_project', 'networking'],
    wealth: ['emergency_fund', 'spending_habits', 'financial_education'],
    mind: ['self_talk', 'stress_management'],
  },
  other: {},
};

export function orderDomainCategories(
  domain: NonHealthDomain,
  statuses: LifeContextStatus[] | null | undefined
): {ordered: string[]; recommended: Set<string>} {
  const base = DOMAIN_CATEGORIES[domain];
  const recommended = new Set<string>();

  for (const ctx of statuses ?? []) {
    const boost = CATEGORY_BOOST[ctx]?.[domain];
    if (boost) boost.forEach((c) => recommended.add(c));
  }

  const boosted = [...recommended].filter((c) => base.includes(c));
  const rest = base.filter((c) => !recommended.has(c));
  return {ordered: [...boosted, ...rest], recommended};
}

const BLOCKER_BOOST: Partial<Record<LifeContextStatus, DomainBlocker[]>> = {
  student: ['no_time', 'lack_of_clarity', 'self_doubt'],
  new_parent: ['no_time', 'low_energy', 'kids'],
  manager: ['no_time', 'low_energy', 'consistency'],
  caregiver: ['no_time', 'low_energy', 'environment'],
  between_jobs: ['money_pressure', 'lack_of_clarity', 'self_doubt'],
};

const STARTER_KEYS: Partial<
  Record<LifeContextStatus, {current: string; desired: string}>
> = {
  student: {current: 'lifeContext.assessment.starter.current.student', desired: 'lifeContext.assessment.starter.desired.student'},
  new_parent: {current: 'lifeContext.assessment.starter.current.newParent', desired: 'lifeContext.assessment.starter.desired.newParent'},
  manager: {current: 'lifeContext.assessment.starter.current.manager', desired: 'lifeContext.assessment.starter.desired.manager'},
  caregiver: {current: 'lifeContext.assessment.starter.current.caregiver', desired: 'lifeContext.assessment.starter.desired.caregiver'},
  between_jobs: {current: 'lifeContext.assessment.starter.current.betweenJobs', desired: 'lifeContext.assessment.starter.desired.betweenJobs'},
};

export function assessmentContentHints(statuses: LifeContextStatus[] | null | undefined): {
  suggestedBlockers: DomainBlocker[];
  starterKeys: {current: string; desired: string} | null;
  defaultMinutes: AvailableTimePerDay | null;
} {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) {
    return {suggestedBlockers: [], starterKeys: null, defaultMinutes: null};
  }

  const blockerSet = new Set<DomainBlocker>();
  for (const ctx of active) {
    for (const blocker of BLOCKER_BOOST[ctx] ?? []) {
      blockerSet.add(blocker);
    }
  }

  const profile = resolveLifeContextProfile(statuses);
  let starterKeys: {current: string; desired: string} | null = null;
  if (profile.type === 'combo') {
    starterKeys = {
      current: `lifeContext.assessment.starter.combo.${profile.key}.current`,
      desired: `lifeContext.assessment.starter.combo.${profile.key}.desired`,
    };
  } else {
    const primary = active[0];
    starterKeys = STARTER_KEYS[primary] ?? null;
  }

  const wantsFive = active.some((ctx) => ctx === 'new_parent' || ctx === 'caregiver');
  const wantsTen = active.some((ctx) => ctx === 'student');

  return {
    suggestedBlockers: [...blockerSet],
    starterKeys,
    defaultMinutes: wantsFive ? 5 : wantsTen ? 10 : null,
  };
}

const CHECK_IN_TAG_PRIORITY: Partial<Record<LifeContextStatus, CheckInTag[]>> = {
  student: ['stressed', 'anxious', 'exhausted', 'distracted', 'stuck'],
  new_parent: ['exhausted', 'burntOut', 'stressed', 'apathetic', 'calm'],
  manager: ['stressed', 'burntOut', 'distracted', 'driven', 'stuck'],
  caregiver: ['exhausted', 'burntOut', 'stressed', 'apathetic', 'grateful'],
  between_jobs: ['stuck', 'anxious', 'apathetic', 'stressed', 'distracted'],
  other: ['stressed', 'stuck', 'exhausted'],
};

function hasAnyContext(
  statuses: LifeContextStatus[] | null | undefined,
  keys: LifeContextStatus[]
): boolean {
  const active = activeLifeContexts(statuses);
  return keys.some((key) => active.includes(key));
}

export function defaultMorningRitualMode(
  statuses: LifeContextStatus[] | null | undefined
): RitualMode {
  if (hasAnyContext(statuses, ['new_parent', 'caregiver', 'manager'])) {
    return 'quick';
  }
  return 'standard';
}

export function defaultEveningMode(
  statuses: LifeContextStatus[] | null | undefined
): EveningMode {
  if (hasAnyContext(statuses, ['new_parent', 'caregiver', 'manager'])) {
    return 'quick';
  }
  return 'standard';
}

export function defaultBreathingType(
  statuses: LifeContextStatus[] | null | undefined
): BreathingType {
  if (hasAnyContext(statuses, ['new_parent', 'caregiver'])) {
    return 'calm';
  }
  if (hasAnyContext(statuses, ['student', 'manager'])) {
    return 'energy';
  }
  return 'default';
}

export function suggestedMorningRitualModeKey(
  statuses: LifeContextStatus[] | null | undefined
): string | null {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return null;
  return contextScopedKey(profile, 'lifeContext.ritual.morning.suggest');
}

export function suggestedEveningModeKey(
  statuses: LifeContextStatus[] | null | undefined
): string | null {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return null;
  return contextScopedKey(profile, 'lifeContext.ritual.evening.suggest');
}

function primaryContextForRitualContent(
  profile: LifeContextProfile
): LifeContextStatus | null {
  if (profile.type === 'single') return profile.key;
  if (profile.type === 'combo' || profile.type === 'multi') {
    return profile.type === 'combo'
      ? activeLifeContexts(
          profile.key === 'studentNewParent'
            ? ['student', 'new_parent']
            : profile.key === 'newParentCaregiver'
              ? ['new_parent', 'caregiver']
              : profile.key === 'managerCaregiver'
                ? ['manager', 'caregiver']
                : ['student', 'manager']
        )[0] ?? null
      : profile.keys[0] ?? null;
  }
  return null;
}

/** i18n key for morning mission placeholder */
export function morningMissionPlaceholderKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'morningRitual.mission.placeholder';
  return contextScopedKey(profile, 'lifeContext.ritual.morning.missionPlaceholder');
}

/** i18n keys for morning gratitude entry placeholders (1-based suffix) */
export function morningGratitudePlaceholderKeys(
  statuses: LifeContextStatus[] | null | undefined,
  count: number
): string[] | null {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return null;

  const ctx = primaryContextForRitualContent(profile);
  if (!ctx) return null;

  return Array.from({length: count}, (_, i) =>
    `lifeContext.ritual.morning.gratitudePlaceholders.${ctx}.${i + 1}`
  );
}

export function eveningWinReviewQuestionKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'eveningReset.winReview.question';
  return contextScopedKey(profile, 'lifeContext.evening.winReview.question');
}

export function eveningWinReviewPlaceholderKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'eveningReset.winReview.placeholder';
  return contextScopedKey(profile, 'lifeContext.evening.winReview.placeholder');
}

export function eveningWinReviewExampleKeys(
  statuses: LifeContextStatus[] | null | undefined
): string[] {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') {
    return [
      'eveningReset.winReview.example1',
      'eveningReset.winReview.example2',
      'eveningReset.winReview.example3',
    ];
  }
  const ctx = primaryContextForRitualContent(profile);
  if (!ctx) {
    return [
      'eveningReset.winReview.example1',
      'eveningReset.winReview.example2',
      'eveningReset.winReview.example3',
    ];
  }
  return [1, 2, 3].map(
    (i) => `lifeContext.evening.winReview.examples.${ctx}.${i}`
  );
}

export function eveningTomorrowsWinQuestionKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'eveningReset.tomorrowsWin.question';
  return contextScopedKey(profile, 'lifeContext.evening.tomorrowsWin.question');
}

export function eveningTomorrowsWinPlaceholderKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'eveningReset.tomorrowsWin.placeholder';
  return contextScopedKey(profile, 'lifeContext.evening.tomorrowsWin.placeholder');
}

const EVENING_PREP_PRIORITY: Partial<
  Record<LifeContextStatus, string[]>
> = {
  student: ['prepSuggestion4', 'prepSuggestion3', 'prepSuggestion1'],
  new_parent: ['prepSuggestion5', 'prepSuggestion3', 'prepSuggestion6'],
  manager: ['prepSuggestion2', 'prepSuggestion4', 'prepSuggestion1'],
  caregiver: ['prepSuggestion6', 'prepSuggestion3', 'prepSuggestion5'],
  between_jobs: ['prepSuggestion7', 'prepSuggestion4', 'prepSuggestion3'],
  other: ['prepSuggestion3', 'prepSuggestion4'],
};

const DEFAULT_PREP_KEYS = [
  'prepSuggestion1',
  'prepSuggestion2',
  'prepSuggestion3',
  'prepSuggestion4',
] as const;

/** Keys under eveningReset.environmentDesign.* */
export function eveningPrepSuggestionKeys(
  statuses: LifeContextStatus[] | null | undefined
): string[] {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) return [...DEFAULT_PREP_KEYS];

  const ordered = new Set<string>();
  for (const ctx of active) {
    for (const key of EVENING_PREP_PRIORITY[ctx] ?? []) {
      ordered.add(key);
    }
  }
  for (const key of DEFAULT_PREP_KEYS) {
    ordered.add(key);
  }
  return [...ordered].slice(0, 6);
}

const SURVIVAL_STRESS_TAGS = new Set<CheckInTag>([
  'exhausted',
  'burntOut',
  'stressed',
  'apathetic',
]);

export function shouldHighlightSurvivalMode(
  entries: Array<{energy: number; selectedTags?: string[]; primaryTag?: string | null}>
): boolean {
  const latest = entries[0];
  if (!latest) return false;
  const tags = latest.selectedTags ?? (latest.primaryTag ? [latest.primaryTag] : []);
  return (
    latest.energy <= 4 ||
    tags.some((tag) => SURVIVAL_STRESS_TAGS.has(tag as CheckInTag))
  );
}

export function survivalModeCopyKeys(statuses: LifeContextStatus[] | null | undefined): {
  trigger: string;
  title: string;
  subtitle: string;
} {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') {
    return {
      trigger: 'survivalMode.trigger',
      title: 'survivalMode.title',
      subtitle: 'survivalMode.subtitle',
    };
  }
  return {
    trigger: contextScopedKey(profile, 'lifeContext.survival.trigger'),
    title: contextScopedKey(profile, 'lifeContext.survival.title'),
    subtitle: contextScopedKey(profile, 'lifeContext.survival.subtitle'),
  };
}

/** Softer copy when formulation signals overload before burnout. */
export function survivalModeSoftCopyKeys(statuses: LifeContextStatus[] | null | undefined): {
  trigger: string;
  title: string;
  subtitle: string;
  positiveExplainer: string;
  optionEasyDesc: string;
  optionSkipDesc: string;
} {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') {
    return {
      trigger: 'survivalModeSoft.trigger',
      title: 'survivalModeSoft.title',
      subtitle: 'survivalModeSoft.subtitle',
      positiveExplainer: 'survivalModeSoft.positiveExplainer',
      optionEasyDesc: 'survivalModeSoft.optionEasyDesc',
      optionSkipDesc: 'survivalModeSoft.optionSkipDesc',
    };
  }
  return {
    trigger: 'survivalModeSoft.trigger',
    title: 'survivalModeSoft.title',
    subtitle: 'survivalModeSoft.subtitle',
    positiveExplainer: 'survivalModeSoft.positiveExplainer',
    optionEasyDesc: 'survivalModeSoft.optionEasyDesc',
    optionSkipDesc: 'survivalModeSoft.optionSkipDesc',
  };
}

export function weeklyReviewEmptyKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'lifeCoach.weeklyReviewEmpty';
  return contextScopedKey(profile, 'lifeContext.weeklyReview.empty');
}

export function weeklyReviewFramingKey(
  statuses: LifeContextStatus[] | null | undefined
): string {
  const profile = resolveLifeContextProfile(statuses);
  if (profile.type === 'none') return 'enhancedReview.title';
  return contextScopedKey(profile, 'lifeContext.weeklyReview.framing');
}

const GOAL_STARTER_BY_CONTEXT: Partial<
  Record<LifeContextStatus, Partial<Record<LifeDomain, string[]>>>
> = {
  student: {
    career: [
      'lifeContext.goalStarter.student.career.1',
      'lifeContext.goalStarter.student.career.2',
      'lifeContext.goalStarter.student.career.3',
    ],
    mind: [
      'lifeContext.goalStarter.student.mind.1',
      'lifeContext.goalStarter.student.mind.2',
      'lifeContext.goalStarter.student.mind.3',
    ],
    time: [
      'lifeContext.goalStarter.student.time.1',
      'lifeContext.goalStarter.student.time.2',
      'lifeContext.goalStarter.student.time.3',
    ],
  },
  new_parent: {
    health: [
      'lifeContext.goalStarter.new_parent.health.1',
      'lifeContext.goalStarter.new_parent.health.2',
      'lifeContext.goalStarter.new_parent.health.3',
    ],
    time: [
      'lifeContext.goalStarter.new_parent.time.1',
      'lifeContext.goalStarter.new_parent.time.2',
      'lifeContext.goalStarter.new_parent.time.3',
    ],
    relationships: [
      'lifeContext.goalStarter.new_parent.relationships.1',
      'lifeContext.goalStarter.new_parent.relationships.2',
      'lifeContext.goalStarter.new_parent.relationships.3',
    ],
  },
  manager: {
    time: [
      'lifeContext.goalStarter.manager.time.1',
      'lifeContext.goalStarter.manager.time.2',
      'lifeContext.goalStarter.manager.time.3',
    ],
    career: [
      'lifeContext.goalStarter.manager.career.1',
      'lifeContext.goalStarter.manager.career.2',
      'lifeContext.goalStarter.manager.career.3',
    ],
    mind: [
      'lifeContext.goalStarter.manager.mind.1',
      'lifeContext.goalStarter.manager.mind.2',
      'lifeContext.goalStarter.manager.mind.3',
    ],
  },
  caregiver: {
    mind: [
      'lifeContext.goalStarter.caregiver.mind.1',
      'lifeContext.goalStarter.caregiver.mind.2',
      'lifeContext.goalStarter.caregiver.mind.3',
    ],
    relationships: [
      'lifeContext.goalStarter.caregiver.relationships.1',
      'lifeContext.goalStarter.caregiver.relationships.2',
      'lifeContext.goalStarter.caregiver.relationships.3',
    ],
  },
  between_jobs: {
    career: [
      'lifeContext.goalStarter.between_jobs.career.1',
      'lifeContext.goalStarter.between_jobs.career.2',
      'lifeContext.goalStarter.between_jobs.career.3',
    ],
    wealth: [
      'lifeContext.goalStarter.between_jobs.wealth.1',
      'lifeContext.goalStarter.between_jobs.wealth.2',
      'lifeContext.goalStarter.between_jobs.wealth.3',
    ],
    mind: [
      'lifeContext.goalStarter.between_jobs.mind.1',
      'lifeContext.goalStarter.between_jobs.mind.2',
      'lifeContext.goalStarter.between_jobs.mind.3',
    ],
  },
};

export function goalInspirationStarterKeys(
  domain: LifeDomain,
  statuses: LifeContextStatus[] | null | undefined
): string[] {
  const profile = resolveLifeContextProfile(statuses);
  const ctx = primaryContextForRitualContent(profile);
  if (!ctx) return [];
  const keys =
    GOAL_STARTER_BY_CONTEXT[ctx]?.[domain] ??
    GOAL_STARTER_BY_CONTEXT[ctx]?.time ??
  [];
  return keys.slice(0, 3);
}
