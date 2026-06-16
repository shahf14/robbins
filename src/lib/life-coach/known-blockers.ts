import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import type {UserBehaviorProfile} from '@/lib/behavior-profile/types';
import type {
  DailyReflection,
  LifeContextStatus,
  LifeDomainState,
  ReflectionBlockerReason,
} from '@/lib/life-coach/types';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';

type DecompositionBlockerKind =
  | 'time'
  | 'energy'
  | 'fear'
  | 'family_overload'
  | 'lack_of_clarity';

type KnownBlockerSource =
  | 'assessment'
  | 'onboarding'
  | 'reflection'
  | 'behavior_profile'
  | 'recurring'
  | 'user_text';

type KnownBlockerEntry = {
  kind: DecompositionBlockerKind;
  token: string;
  source: KnownBlockerSource;
  weight: number;
};

export type KnownBlockersProfile = {
  blockers: KnownBlockerEntry[];
  dominant_kind: DecompositionBlockerKind | null;
  has_no_time_signal: boolean;
  max_initial_step_minutes: number | null;
  decomposition_hint: string | null;
};

export const BLOCKER_DECOMPOSITION_PROMPT_BLOCK = [
  '## Blocker-aware goal decomposition (REQUIRED):',
  'Use known_blockers from the payload — do NOT decompose goals generically.',
  'Every milestone AND every daily_baby_steps item must address at least one known blocker:',
  'time | energy | fear | family_overload | lack_of_clarity.',
  'Map blockers to plan shape:',
  '- time / family_overload → first steps 3-10 minutes, prep/decision patterns, easy difficulty.',
  '- energy → short restorative steps, passive/environmental starts.',
  '- fear → micro-experiments without commitment.',
  '- lack_of_clarity → mapping/choice steps before big actions.',
  'Milestone titles should name the friction they reduce (not generic "build habits").',
  'why_this_step must cite which blocker the step addresses.',
].join('\n');

const NO_TIME_TEXT = [
  /אין לי זמן/,
  /אין זמן/,
  /ללא זמן/,
  /אין לי מספיק זמן/,
  /\bno time\b/i,
  /\bnot enough time\b/i,
  /\bdon'?t have time\b/i,
  /\btoo busy\b/i,
];

const TOKEN_TO_KIND: Record<string, DecompositionBlockerKind> = {
  no_time: 'time',
  kids: 'family_overload',
  low_energy: 'energy',
  environment: 'energy',
  lack_of_clarity: 'lack_of_clarity',
  self_doubt: 'fear',
  money_pressure: 'fear',
  consistency: 'lack_of_clarity',
  no_time_reflection: 'time',
  low_energy_reflection: 'energy',
  unclear_task: 'lack_of_clarity',
  emotional_resistance: 'fear',
  forgot: 'lack_of_clarity',
  family_chaos: 'family_overload',
  other: 'lack_of_clarity',
};

const LIFE_CONTEXT_TO_KIND: Partial<Record<LifeContextStatus, DecompositionBlockerKind>> = {
  new_parent: 'family_overload',
  caregiver: 'family_overload',
  manager: 'time',
  student: 'time',
  between_jobs: 'fear',
};

function addEntry(
  bucket: KnownBlockerEntry[],
  kind: DecompositionBlockerKind,
  token: string,
  source: KnownBlockerSource,
  weight: number
) {
  bucket.push({kind, token, source, weight});
}

function kindFromToken(token: string): DecompositionBlockerKind | null {
  const normalized = token.toLowerCase().replace(/\s+/g, '_');
  return TOKEN_TO_KIND[normalized] ?? TOKEN_TO_KIND[token] ?? null;
}

function scanUserText(text: string, bucket: KnownBlockerEntry[]) {
  const blob = text.trim();
  if (!blob) return;
  if (NO_TIME_TEXT.some((pattern) => pattern.test(blob))) {
    addEntry(bucket, 'time', 'no_time', 'user_text', 4);
  }
  if (/(עייפ|אנרגיה נמוכ|exhausted|low energy|tired)/i.test(blob)) {
    addEntry(bucket, 'energy', 'low_energy', 'user_text', 3);
  }
  if (/(פחד|מפחד|anxious|afraid|fear)/i.test(blob)) {
    addEntry(bucket, 'fear', 'fear', 'user_text', 3);
  }
  if (/(לא ברור|מבולבל|unclear|confus)/i.test(blob)) {
    addEntry(bucket, 'lack_of_clarity', 'lack_of_clarity', 'user_text', 3);
  }
  if (/(ילדים|משפח|family|kids|parent)/i.test(blob)) {
    addEntry(bucket, 'family_overload', 'family', 'user_text', 3);
  }
}

function dominantKind(entries: KnownBlockerEntry[]): DecompositionBlockerKind | null {
  const scores = new Map<DecompositionBlockerKind, number>();
  for (const entry of entries) {
    scores.set(entry.kind, (scores.get(entry.kind) ?? 0) + entry.weight);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

export function buildKnownBlockersProfile(input: {
  assessment: Pick<
    LifeDomainState,
    'main_blockers' | 'available_time_per_day' | 'current_state' | 'desired_state'
  > | null;
  life_context_statuses?: LifeContextStatus[];
  reflections?: DailyReflection[];
  recurringBlockers?: RecurringBlockerPattern[];
  behaviorProfile?: UserBehaviorProfile | null;
  raw_goal?: string;
  motivation?: string;
  constraints?: string;
}): KnownBlockersProfile {
  const entries: KnownBlockerEntry[] = [];

  for (const blocker of input.assessment?.main_blockers ?? []) {
    const kind = kindFromToken(blocker);
    if (kind) addEntry(entries, kind, blocker, 'assessment', 3);
  }

  if ((input.assessment?.available_time_per_day ?? 20) <= 10) {
    addEntry(entries, 'time', 'limited_time_budget', 'assessment', 2);
  }

  scanUserText(
    [
      input.assessment?.current_state,
      input.assessment?.desired_state,
      input.raw_goal,
      input.motivation,
      input.constraints,
    ]
      .filter(Boolean)
      .join(' '),
    entries
  );

  for (const status of input.life_context_statuses ?? []) {
    const kind = LIFE_CONTEXT_TO_KIND[status];
    if (kind) addEntry(entries, kind, status, 'onboarding', 2);
  }

  for (const reflection of input.reflections ?? []) {
    if (!reflection.blocker_reason) continue;
    const kind = kindFromToken(`${reflection.blocker_reason}_reflection`) ??
      kindFromToken(reflection.blocker_reason);
    if (kind) addEntry(entries, kind, reflection.blocker_reason, 'reflection', +2);
  }

  for (const pattern of input.recurringBlockers ?? []) {
    const kind = kindFromToken(pattern.blocker);
    if (kind) addEntry(entries, kind, pattern.blocker, 'recurring', pattern.count >= 3 ? 4 : 2);
  }

  for (const blocker of input.behaviorProfile?.common_blockers ?? []) {
    const kind = kindFromToken(blocker);
    if (kind) addEntry(entries, kind, blocker, 'behavior_profile', 2);
  }

  if ((input.behaviorProfile?.low_energy_frequency ?? 0) >= 0.4) {
    addEntry(entries, 'energy', 'low_energy_frequency', 'behavior_profile', 3);
  }

  const dominant = dominantKind(entries);
  const hasNoTime =
    dominant === 'time' ||
    dominant === 'family_overload' ||
    entries.some((e) => e.kind === 'time' && e.weight >= 3);

  const maxMinutes = hasNoTime ? 10 : dominant === 'energy' ? 10 : null;

  const decomposition_hint = hasNoTime
    ? 'User time pressure is high — first daily_baby_steps must be 3-10 minutes, easy, prep/decision focused.'
    : dominant === 'energy'
      ? 'Low energy pattern — keep first steps short and restorative.'
      : dominant === 'fear'
        ? 'Fear/resistance pattern — use small experiments without commitment.'
        : dominant === 'lack_of_clarity'
          ? 'Clarity gap — start with mapping/choice before execution.'
          : dominant === 'family_overload'
            ? 'Family load — micro steps with environmental prep.'
            : null;

  return {
    blockers: entries,
    dominant_kind: dominant,
    has_no_time_signal: hasNoTime,
    max_initial_step_minutes: maxMinutes,
    decomposition_hint,
  };
}

export function knownBlockersForPrompt(
  profile: KnownBlockersProfile | null | undefined
): Record<string, unknown> | null {
  if (!profile || profile.blockers.length === 0) return null;

  const byKind = [...new Set(profile.blockers.map((b) => b.kind))];
  const tokens = [...new Set(profile.blockers.map((b) => b.token))].slice(0, 12);

  return {
    dominant_kind: profile.dominant_kind,
    kinds_present: byKind,
    tokens,
    has_no_time_signal: profile.has_no_time_signal,
    max_initial_step_minutes: profile.max_initial_step_minutes,
    decomposition_hint: profile.decomposition_hint,
    entries: profile.blockers.slice(0, 16).map((entry) => ({
      kind: entry.kind,
      token: entry.token,
      source: entry.source,
    })),
  };
}

/** Hard cap on initial goal baby steps when time blocker dominates. */
export function enforceKnownBlockersOnGoalSteps(
  steps: Array<Omit<StructuredDailyBabyStep, 'domain' | 'goal_id'>>,
  profile: KnownBlockersProfile | null | undefined
): Array<Omit<StructuredDailyBabyStep, 'domain' | 'goal_id'>> {
  if (!profile) return steps;

  return steps.map((step, index) => {
    let next = {...step};

    if (profile.has_no_time_signal && index < 3) {
      next = {
        ...next,
        estimated_minutes: Math.max(3, Math.min(10, next.estimated_minutes)),
        difficulty: 'easy',
      };
    } else if (profile.dominant_kind === 'energy' && index < 2) {
      next = {
        ...next,
        estimated_minutes: Math.min(10, next.estimated_minutes),
        difficulty: 'easy',
      };
    } else if (profile.dominant_kind === 'fear' && index < 2) {
      next = {...next, difficulty: 'easy'};
    }

    return next;
  });
}
