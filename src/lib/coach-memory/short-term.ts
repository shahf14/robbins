import type {DailyBabyStep, DailyReflection, LifeDomainState} from '@/lib/life-coach/types';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import {
  countPendingToday,
  dateDaysAgo,
  getLatestReflection,
  listDomainStates,
  listReflectionsSince,
  listStepsSince,
  todayYmd,
} from './data';
import type {ShortTermContext} from './types';

const WINDOW_DAYS = 7;

function topBlockers(
  steps: DailyBabyStep[],
  reflections: DailyReflection[],
  limit = 5
): Array<{reason: ReflectionBlockerReason; count: number}> {
  const counts = new Map<string, number>();
  for (const s of steps) {
    if (s.blocker_reason) counts.set(s.blocker_reason, (counts.get(s.blocker_reason) ?? 0) + 1);
  }
  for (const r of reflections) {
    if (r.blocker_reason) counts.set(r.blocker_reason, (counts.get(r.blocker_reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => ({reason: reason as ReflectionBlockerReason, count}));
}

function worstBlocker(
  blockers: Array<{reason: ReflectionBlockerReason; count: number}>
): ReflectionBlockerReason | null {
  return blockers[0]?.reason ?? null;
}

type ShortTermInput = {
  steps: DailyBabyStep[];
  reflections: DailyReflection[];
  domainStates: LifeDomainState[];
  pendingToday: number;
  latestReflection: DailyReflection | null;
  periodStart: string;
  periodEnd: string;
};

function computeShortTermContext(input: ShortTermInput): ShortTermContext {
  const {steps, reflections, domainStates, pendingToday, latestReflection} = input;
  const completed = steps.filter((s) => s.status === 'completed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  const partial = steps.filter((s) => s.status === 'partial').length;
  const completed_easy = steps.filter(
    (s) => s.status === 'completed' && s.difficulty === 'easy'
  ).length;
  const skipped_hard = steps.filter(
    (s) => s.status === 'skipped' && s.difficulty === 'hard'
  ).length;
  const showUps = completed + partial;
  const completion_rate =
    steps.length > 0 ? Math.round((showUps / steps.length) * 100) / 100 : 0;
  const recent_blockers = topBlockers(steps, reflections);

  return {
    window_days: WINDOW_DAYS,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    completion_rate,
    completed,
    skipped,
    partial,
    pending_today: pendingToday,
    recent_blockers,
    latest_energy: latestReflection?.energy_score ?? null,
    latest_mood: latestReflection?.mood_score ?? null,
    domain_scores: domainStates.map((d) => ({domain: d.domain, score: d.current_score})),
    completed_easy,
    skipped_hard,
    worst_blocker: worstBlocker(recent_blockers),
  };
}

export function buildShortTermContext(
  userId: string,
  prefetched?: {
    steps?: DailyBabyStep[];
    reflections?: DailyReflection[];
    domainStates?: LifeDomainState[];
  }
): ShortTermContext {
  const periodEnd = todayYmd();
  const periodStart = dateDaysAgo(WINDOW_DAYS - 1);
  const steps = prefetched?.steps ?? listStepsSince(userId, periodStart);
  const reflections = prefetched?.reflections ?? listReflectionsSince(userId, periodStart);
  const domainStates = prefetched?.domainStates ?? listDomainStates(userId);
  const latestReflection = getLatestReflection(userId);
  const pendingToday = countPendingToday(userId, periodEnd);

  return computeShortTermContext({
    steps,
    reflections,
    domainStates,
    pendingToday,
    latestReflection,
    periodStart,
    periodEnd,
  });
}
