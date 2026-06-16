import type {LifeDomain, ReflectionBlockerReason} from '@/lib/life-coach/types';
import type {ActionPatternKind, ResolveBlockerInput} from './types';

const REFLECTION_TO_KIND: Record<ReflectionBlockerReason, ActionPatternKind> = {
  no_time: 'no_time',
  low_energy: 'fatigue',
  unclear_task: 'lack_of_clarity',
  emotional_resistance: 'fear_of_failure',
  forgot: 'procrastination',
  family_chaos: 'no_time',
  other: 'lack_of_clarity',
};

const DOMAIN_BLOCKER_TO_KIND: Record<string, ActionPatternKind> = {
  no_time: 'no_time',
  low_energy: 'fatigue',
  lack_of_clarity: 'lack_of_clarity',
  self_doubt: 'fear_of_failure',
  consistency: 'procrastination',
  kids: 'no_time',
  money_pressure: 'fear_of_failure',
  environment: 'fatigue',
};

function kindFromBlockerToken(token: string | null | undefined): ActionPatternKind | null {
  if (!token) return null;
  if (token in REFLECTION_TO_KIND) {
    return REFLECTION_TO_KIND[token as ReflectionBlockerReason];
  }
  return DOMAIN_BLOCKER_TO_KIND[token] ?? null;
}

/** Pick the dominant friction kind for a domain from live user signals. */
function resolveActionPatternKind(input: ResolveBlockerInput): ActionPatternKind {
  const recurring = (input.recurringBlockers ?? [])
    .map((row) => ({kind: kindFromBlockerToken(row.blocker), count: row.count}))
    .filter((row): row is {kind: ActionPatternKind; count: number} => row.kind != null)
    .sort((a, b) => b.count - a.count);
  if (recurring[0]) return recurring[0].kind;

  const latestReflection = [...(input.recentReflections ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((row) => row.blocker_reason);
  const fromReflection = kindFromBlockerToken(latestReflection?.blocker_reason);
  if (fromReflection) return fromReflection;

  const fromWorst = kindFromBlockerToken(input.worstBlocker);
  if (fromWorst) return fromWorst;

  for (const blocker of input.mainBlockers ?? []) {
    const normalized = blocker.toLowerCase().replace(/\s+/g, '_');
    const kind = kindFromBlockerToken(normalized) ?? DOMAIN_BLOCKER_TO_KIND[normalized];
    if (kind) return kind;
  }

  return 'lack_of_clarity';
}

export function resolveBlockerLabel(
  kind: ActionPatternKind,
  locale: import('@/i18n/config').AppLocale
): string {
  const he = locale === 'he';
  const labels: Record<ActionPatternKind, {he: string; en: string}> = {
    no_time: {he: 'חוסר זמן', en: 'no time'},
    fear_of_failure: {he: 'פחד מכישלון', en: 'fear of failure'},
    lack_of_clarity: {he: 'חוסר בהירות', en: 'lack of clarity'},
    fatigue: {he: 'עייפות', en: 'fatigue'},
    procrastination: {he: 'דחיינות', en: 'procrastination'},
  };
  return he ? labels[kind].he : labels[kind].en;
}

export function resolveBlockerForDomain(
  domain: LifeDomain,
  input: Omit<ResolveBlockerInput, 'domain'>
): ActionPatternKind {
  return resolveActionPatternKind({...input, domain});
}
