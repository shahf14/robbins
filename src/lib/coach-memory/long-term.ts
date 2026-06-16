import {computeRecoveryRate} from '@/lib/behavior-profile/compute';
import type {DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import {dateDaysAgo, listStepsSince} from './data';
import type {LongTermProfile, StepPatternStat} from './types';

const WINDOW_DAYS = 30;
const MIN_PATTERN_SAMPLES = 2;

function hourToWindow(hour: number): PreferredActionWindow {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'flexible';
}

function patternStats(steps: DailyBabyStep[]): StepPatternStat[] {
  const buckets = new Map<string, {difficulty: DailyBabyStep['difficulty']; domain: LifeDomain; steps: DailyBabyStep[]}>();

  for (const s of steps) {
    if (s.status === 'pending') continue;
    const key = `${s.difficulty}:${s.domain}`;
    const bucket = buckets.get(key) ?? {difficulty: s.difficulty, domain: s.domain, steps: []};
    bucket.steps.push(s);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .filter((b) => b.steps.length >= MIN_PATTERN_SAMPLES)
    .map((b) => {
      const completed = b.steps.filter((s) => s.status === 'completed' || s.status === 'partial').length;
      const skipped = b.steps.filter((s) => s.status === 'skipped').length;
      return {
        difficulty: b.difficulty,
        domain: b.domain,
        total: b.steps.length,
        completed,
        skipped,
        completion_rate: Math.round((completed / b.steps.length) * 100) / 100,
      };
    });
}

function actionWindowStats(steps: DailyBabyStep[]): LongTermProfile['action_window_stats'] {
  const buckets = new Map<PreferredActionWindow, {completed: number; total: number}>();
  for (const s of steps) {
    if (s.status !== 'completed' && s.status !== 'partial') continue;
    const ts = s.completed_at ?? s.updated_at;
    if (!ts) continue;
    const window = hourToWindow(new Date(ts).getHours());
    const cur = buckets.get(window) ?? {completed: 0, total: 0};
    cur.completed++;
    cur.total++;
    buckets.set(window, cur);
  }
  for (const s of steps) {
    if (s.status !== 'skipped') continue;
    const ts = s.updated_at;
    if (!ts) continue;
    const window = hourToWindow(new Date(ts).getHours());
    const cur = buckets.get(window) ?? {completed: 0, total: 0};
    cur.total++;
    buckets.set(window, cur);
  }
  return [...buckets.entries()]
    .map(([window, {completed, total}]) => ({
      window,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

function domainRates(steps: DailyBabyStep[]): Array<{domain: LifeDomain; rate: number; total: number}> {
  const buckets = new Map<LifeDomain, {completed: number; total: number}>();
  for (const s of steps) {
    if (s.status === 'pending') continue;
    const cur = buckets.get(s.domain) ?? {completed: 0, total: 0};
    cur.total++;
    if (s.status === 'completed' || s.status === 'partial') cur.completed++;
    buckets.set(s.domain, cur);
  }
  return [...buckets.entries()]
    .filter(([, v]) => v.total >= MIN_PATTERN_SAMPLES)
    .map(([domain, v]) => ({
      domain,
      rate: Math.round((v.completed / v.total) * 100) / 100,
      total: v.total,
    }))
    .sort((a, b) => b.rate - a.rate);
}

function buildAvoidList(patterns: StepPatternStat[], domainRatesList: ReturnType<typeof domainRates>): string[] {
  const avoid: string[] = [];
  for (const p of patterns) {
    if (p.skipped >= 2 && p.completion_rate < 0.35) {
      avoid.push(
        `Avoid ${p.difficulty} ${p.domain} steps (skipped ${p.skipped}/${p.total}, ${Math.round(p.completion_rate * 100)}% completion)`
      );
    }
  }
  const struggling = domainRatesList.filter((d) => d.rate < 0.35 && d.total >= 3);
  for (const d of struggling.slice(0, 2)) {
    const label = `Avoid stacking multiple ${d.domain} tasks until completion improves (${Math.round(d.rate * 100)}% over ${d.total} steps)`;
    if (!avoid.includes(label)) avoid.push(label);
  }
  return avoid.slice(0, 5);
}

function computeLongTermProfile(steps: DailyBabyStep[]): LongTermProfile {
  const actionable = steps.filter((s) => s.status !== 'pending');
  const completed = actionable.filter((s) => s.status === 'completed' || s.status === 'partial').length;
  const overall_completion_rate =
    steps.length > 0 ? Math.round((completed / steps.length) * 100) / 100 : 0;

  const patterns = patternStats(steps);
  const winning_patterns = [...patterns]
    .filter((p) => p.completion_rate >= 0.5)
    .sort((a, b) => b.completion_rate - a.completion_rate || b.total - a.total)
    .slice(0, 3);
  const losing_patterns = [...patterns]
    .filter((p) => p.skipped >= 1)
    .sort((a, b) => a.completion_rate - b.completion_rate || b.skipped - a.skipped)
    .slice(0, 3);

  const windowStats = actionWindowStats(steps);
  const best_action_window = windowStats[0]?.window ?? 'flexible';

  const domainRatesList = domainRates(steps);
  const successful_domains = domainRatesList.filter((d) => d.rate >= 0.5).map((d) => d.domain);
  const struggling_domains = domainRatesList.filter((d) => d.rate < 0.4).map((d) => d.domain);

  const completedWithMinutes = steps.filter(
    (s) => (s.status === 'completed' || s.status === 'partial') && s.actual_minutes != null
  );
  const avg_successful_minutes =
    completedWithMinutes.length > 0
      ? Math.round(
          (completedWithMinutes.reduce((sum, s) => sum + (s.actual_minutes ?? 0), 0) /
            completedWithMinutes.length) *
            10
        ) / 10
      : null;

  return {
    window_days: WINDOW_DAYS,
    sample_size: steps.length,
    overall_completion_rate,
    best_action_window,
    action_window_stats: windowStats,
    winning_patterns,
    losing_patterns,
    successful_domains,
    struggling_domains,
    avg_successful_minutes,
    recovery_rate: computeRecoveryRate(steps),
    avoid: buildAvoidList(patterns, domainRatesList),
  };
}

export function buildLongTermProfile(
  userId: string,
  prefetched?: {steps?: DailyBabyStep[]}
): LongTermProfile {
  const since = dateDaysAgo(WINDOW_DAYS - 1);
  const steps = prefetched?.steps ?? listStepsSince(userId, since);
  return computeLongTermProfile(steps);
}
