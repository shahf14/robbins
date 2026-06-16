import type {AppLocale} from '@/i18n/config';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import type {
  DailyBabyStep,
  DailyReflection,
  ReflectionBlockerReason,
  WeeklyReviewRecurringPattern,
} from '@/lib/life-coach/types';

const MIN_SIGNAL_COUNT = 2;

const BLOCKER_PRIORITY: ReflectionBlockerReason[] = [
  'low_energy',
  'no_time',
  'unclear_task',
  'emotional_resistance',
  'family_chaos',
  'forgot',
  'other',
];

function countBlockers(
  steps: DailyBabyStep[],
  reflections: DailyReflection[],
  periodStart: string,
  periodEnd: string
): Map<ReflectionBlockerReason, number> {
  const counts = new Map<ReflectionBlockerReason, number>();

  const bump = (reason: ReflectionBlockerReason | null | undefined) => {
    if (!reason) return;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  };

  for (const step of steps) {
    if (step.scheduled_date < periodStart || step.scheduled_date > periodEnd) continue;
    if (step.status !== 'skipped') continue;
    bump(step.blocker_reason);
  }

  for (const reflection of reflections) {
    if (reflection.date < periodStart || reflection.date > periodEnd) continue;
    bump(reflection.blocker_reason);
  }

  return counts;
}

function resolveDominantSkipBlocker(input: {
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  period_start: string;
  period_end: string;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
}): ReflectionBlockerReason | null {
  const counts = countBlockers(
    input.recentSteps,
    input.recentReflections,
    input.period_start,
    input.period_end
  );

  for (const pattern of input.recurring_blocker_patterns ?? []) {
    counts.set(pattern.blocker, (counts.get(pattern.blocker) ?? 0) + pattern.count);
  }

  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= MIN_SIGNAL_COUNT)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (
        BLOCKER_PRIORITY.indexOf(a[0]) - BLOCKER_PRIORITY.indexOf(b[0])
      );
    });

  return ranked[0]?.[0] ?? null;
}

const PATTERN_STATEMENT_HE: Record<ReflectionBlockerReason, string> = {
  low_energy:
    'הדפוס השבועי המרכזי הוא שדילוגים קורים בעיקר כשהאנרגיה נמוכה — לא בגלל חוסר מוטיבציה.',
  no_time:
    'הדפוס השבועי המרכזי הוא שדילוגים קשורים ללוח זמנים צפוף, לא לחוסר רצון או מוטיבציה.',
  unclear_task:
    'הדפוס השבועי המרכזי הוא שדילוגים קורים כשהמשימה לא ברורה מספיק — לא בגלל חוסר מחויבות.',
  emotional_resistance:
    'הדפוס השבועי המרכזי הוא התנגדות רגשית או פחד לפני התחלה — לא "חוסר מוטיבציה".',
  family_chaos:
    'הדפוס השבועי המרכזי הוא עומס משפחתי שמפסיק את הקצב — לא חוסר רצון אישי.',
  forgot:
    'הדפוס השבועי המרכזי הוא שכחה וחוסר עוגן בזמן — לא חוסר מוטיבציה.',
  other:
    'הדפוס השבועי המרכזי הוא חיכוך חוזר סביב אותם רגעים בשבוע — נבחן את הגורם המעשי, לא "חוסר מוטיבציה".',
};

const PATTERN_STATEMENT_EN: Record<ReflectionBlockerReason, string> = {
  low_energy:
    'The central weekly pattern is skips cluster when energy is low — not lack of motivation.',
  no_time:
    'The central weekly pattern is skips track a packed schedule — not lack of desire or motivation.',
  unclear_task:
    'The central weekly pattern is skips happen when tasks feel unclear — not lack of commitment.',
  emotional_resistance:
    'The central weekly pattern is emotional resistance before starting — not "lack of motivation".',
  family_chaos:
    'The central weekly pattern is family overload interrupting the rhythm — not personal unwillingness.',
  forgot:
    'The central weekly pattern is forgetting without a time anchor — not lack of motivation.',
  other:
    'The central weekly pattern is repeated friction at the same weekly moments — diagnose the practical cause, not "lack of motivation".',
};

function buildRecurringPatternStatement(
  locale: AppLocale,
  blocker: ReflectionBlockerReason | null
): string {
  const he = locale === 'he';
  if (!blocker) {
    return he
      ? 'הדפוס השבועי המרכזי הוא פער בין תכנון לביצוע — נתמקד בצעדים קטנים וברורים יותר, לא ב"חוסר מוטיבציה".'
      : 'The central weekly pattern is a plan-vs-execution gap — we will shrink and clarify steps, not blame "lack of motivation".';
  }
  return he ? PATTERN_STATEMENT_HE[blocker] : PATTERN_STATEMENT_EN[blocker];
}

export function buildRecurringPatternFallback(input: {
  locale: AppLocale;
  period_start: string;
  period_end: string;
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  recurring_blocker_patterns?: RecurringBlockerPattern[];
}): WeeklyReviewRecurringPattern {
  const dominant_blocker = resolveDominantSkipBlocker(input);
  return {
    statement: buildRecurringPatternStatement(input.locale, dominant_blocker),
    dominant_blocker,
  };
}

export const RECURRING_PATTERN_PROMPT_BLOCK = [
  '## Recurring pattern diagnosis (required):',
  'Add recurring_pattern — one diagnostic sentence for the week, not generic motivation talk.',
  'Use week_execution, recent_reflections_compact, recurring_blocker_patterns, pattern_mining, and skipped steps as ground truth.',
  'statement MUST be exactly one sentence starting with:',
  '- Hebrew: "הדפוס השבועי המרכזי הוא…"',
  '- English: "The central weekly pattern is…"',
  'Name the real friction (low energy, no time, unclear task, family chaos, etc.).',
  'NEVER blame "lack of motivation" when data shows low_energy, no_time, or unclear_task.',
  'If low_energy dominates skips, say energy depletion — not motivation.',
  'dominant_blocker: the blocker token that best explains the pattern.',
].join('\n');
