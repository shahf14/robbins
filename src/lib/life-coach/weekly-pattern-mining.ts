import type {AppLocale} from '@/i18n/config';
import {dbAll} from '@/lib/db/sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {
  DailyBabyStep,
  DailyReflection,
  LifeDomain,
  WeeklyPlanAdjustments,
  WeeklyPatternMining,
} from '@/lib/life-coach/types';

type EnergyRow = {date: string; energy_score: number | null};

function hourToWindow(hour: number): PreferredActionWindow {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'flexible';
}

function completionRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100) / 100;
}

function isDone(step: DailyBabyStep): boolean {
  return step.status === 'completed' || step.status === 'partial';
}

function energyBucket(score: number | null): 'low' | 'mid' | 'high' | 'unknown' {
  if (score == null) return 'unknown';
  if (score < 5) return 'low';
  if (score <= 7) return 'mid';
  return 'high';
}

function loadCheckinEnergy(userId: string, since: string, until: string): EnergyRow[] {
  return dbAll<EnergyRow>(
    `SELECT date, energy_score FROM checkins
     WHERE user_id = ? AND date >= ? AND date <= ? AND energy_score IS NOT NULL`,
    [userId, since, until]
  );
}

function buildEnergyByDate(
  reflections: DailyReflection[],
  checkins: EnergyRow[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of checkins) {
    if (row.energy_score != null) map.set(row.date, row.energy_score);
  }
  for (const reflection of reflections) {
    if (reflection.energy_score != null) {
      map.set(reflection.date, reflection.energy_score);
    }
  }
  return map;
}

function derivePlanAdjustments(
  mining: {
    by_energy: WeeklyPatternMining['by_energy'];
    by_minutes: WeeklyPatternMining['by_minutes'];
    by_domain: WeeklyPatternMining['by_domain'];
    by_time_window: WeeklyPatternMining['by_time_window'];
  },
  locale: AppLocale
): WeeklyPlanAdjustments {
  const lowEnergyLong = mining.by_minutes.find(
    (row) => row.bucket === 'long' && row.energy_bucket === 'low'
  );
  const shortLow = mining.by_minutes.find(
    (row) => row.bucket === 'short' && row.energy_bucket === 'low'
  );

  let max_minutes_per_task = 15;
  let easy_only_bias = false;

  if (lowEnergyLong && lowEnergyLong.total >= 2 && lowEnergyLong.rate <= 0.25) {
    max_minutes_per_task = 10;
    easy_only_bias = true;
  } else if (shortLow && shortLow.total >= 2 && shortLow.rate >= 0.6) {
    max_minutes_per_task = 10;
  }

  const domainRates = [...mining.by_domain].sort((a, b) => a.rate - b.rate);
  const deemphasize_domains = domainRates
    .filter((d) => d.total >= 2 && d.rate < 0.35)
    .map((d) => d.domain);
  const emphasize_domains = domainRates
    .filter((d) => d.total >= 2 && d.rate >= 0.65)
    .map((d) => d.domain)
    .slice(0, 2);

  const windowRates = [...mining.by_time_window].sort((a, b) => b.rate - a.rate);
  const preferred_action_window =
    windowRates[0]?.total >= 2 ? windowRates[0].window : null;

  const cap_tasks =
    mining.by_energy.find((e) => e.bucket === 'low' && e.total >= 3 && e.rate < 0.35)
      ? 1
      : null;

  return {
    max_minutes_per_task,
    easy_only_bias,
    cap_tasks,
    emphasize_domains,
    deemphasize_domains,
    preferred_action_window,
    rationale:
      locale === 'he'
        ? 'התאמה אוטומטית לפי דפוסי השלמה בשבוע האחרון.'
        : 'Auto-tuned from last week completion patterns.',
  };
}

function buildInsights(
  mining: {
    by_energy: WeeklyPatternMining['by_energy'];
    by_minutes: WeeklyPatternMining['by_minutes'];
    by_domain: WeeklyPatternMining['by_domain'];
    by_time_window: WeeklyPatternMining['by_time_window'];
  },
  locale: AppLocale
): string[] {
  const he = locale === 'he';
  const insights: string[] = [];

  const lowEnergyLong = mining.by_minutes.find(
    (row) => row.bucket === 'long' && row.energy_bucket === 'low'
  );
  if (lowEnergyLong && lowEnergyLong.total >= 2 && lowEnergyLong.rate <= 0.3) {
    insights.push(
      he
        ? 'מתחת לאנרגיה 5, צעדים מעל 10 דקות כמעט לא הושלמו.'
        : 'Below energy 5, steps over 10 minutes almost never completed.'
    );
  }

  const lowEnergy = mining.by_energy.find((e) => e.bucket === 'low');
  if (lowEnergy && lowEnergy.total >= 3 && lowEnergy.rate < 0.4) {
    insights.push(
      he
        ? `באנרגיה נמוכה (${lowEnergy.rate * 100}% השלמה) — לקצר צעדים ל-10 דק׳ וקלות.`
        : `On low energy (${Math.round(lowEnergy.rate * 100)}% completion) — shorten steps to 10 easy minutes.`
    );
  }

  const bestDomain = [...mining.by_domain].sort((a, b) => b.rate - a.rate)[0];
  const worstDomain = [...mining.by_domain].sort((a, b) => a.rate - b.rate)[0];
  if (bestDomain && worstDomain && bestDomain.total >= 2 && worstDomain.total >= 2) {
    if (bestDomain.domain !== worstDomain.domain && worstDomain.rate < 0.35) {
      insights.push(
        he
          ? `הכי הצליח ב"${bestDomain.domain}" (${Math.round(bestDomain.rate * 100)}%), הכי קשה ב"${worstDomain.domain}" (${Math.round(worstDomain.rate * 100)}%).`
          : `Best in ${bestDomain.domain} (${Math.round(bestDomain.rate * 100)}%), hardest in ${worstDomain.domain} (${Math.round(worstDomain.rate * 100)}%).`
      );
    }
  }

  const bestWindow = [...mining.by_time_window].sort((a, b) => b.rate - a.rate)[0];
  const worstWindow = [...mining.by_time_window].sort((a, b) => a.rate - b.rate)[0];
  if (
    bestWindow &&
    worstWindow &&
    bestWindow.total >= 2 &&
    worstWindow.total >= 2 &&
    bestWindow.window !== worstWindow.window &&
    bestWindow.rate - worstWindow.rate >= 0.25
  ) {
    insights.push(
      he
        ? `השלמות גבוהות יותר ב${bestWindow.window} (${Math.round(bestWindow.rate * 100)}%) מאשר ב${worstWindow.window}.`
        : `Completion is higher in the ${bestWindow.window} window (${Math.round(bestWindow.rate * 100)}%) than ${worstWindow.window}.`
    );
  }

  const shortSteps = mining.by_minutes.find((m) => m.bucket === 'short' && !m.energy_bucket);
  const longSteps = mining.by_minutes.find((m) => m.bucket === 'long' && !m.energy_bucket);
  if (
    shortSteps &&
    longSteps &&
    shortSteps.total >= 2 &&
    longSteps.total >= 2 &&
    shortSteps.rate - longSteps.rate >= 0.2
  ) {
    insights.push(
      he
        ? `צעדים עד 10 דקות הושלמו ב-${Math.round(shortSteps.rate * 100)}% לעומת ${Math.round(longSteps.rate * 100)}% מעל 10 דקות.`
        : `Steps up to 10 minutes completed at ${Math.round(shortSteps.rate * 100)}% vs ${Math.round(longSteps.rate * 100)}% over 10 minutes.`
    );
  }

  return insights.slice(0, 4);
}

export function computeWeeklyPatternMining(input: {
  userId: string;
  locale: AppLocale;
  period_start: string;
  period_end: string;
  steps: DailyBabyStep[];
  reflections: DailyReflection[];
}): WeeklyPatternMining {
  const windowSteps = input.steps.filter(
    (s) => s.scheduled_date >= input.period_start && s.scheduled_date <= input.period_end
  );
  const windowReflections = input.reflections.filter(
    (r) => r.date >= input.period_start && r.date <= input.period_end
  );
  const checkins = loadCheckinEnergy(input.userId, input.period_start, input.period_end);
  const energyByDate = buildEnergyByDate(windowReflections, checkins);

  const energyStats = {
    low: {completed: 0, total: 0},
    mid: {completed: 0, total: 0},
    high: {completed: 0, total: 0},
    unknown: {completed: 0, total: 0},
  };

  const minuteStats: Record<
    'short' | 'long' | 'short_low' | 'long_low',
    {completed: number; total: number}
  > = {
    short: {completed: 0, total: 0},
    long: {completed: 0, total: 0},
    short_low: {completed: 0, total: 0},
    long_low: {completed: 0, total: 0},
  };

  const domainStats = new Map<LifeDomain, {completed: number; total: number}>();
  const windowStats = new Map<PreferredActionWindow, {completed: number; total: number}>();

  for (const step of windowSteps) {
    if (step.status === 'pending') continue;

    const energy = energyByDate.get(step.scheduled_date) ?? null;
    const bucket = energyBucket(energy);
    energyStats[bucket].total += 1;
    if (isDone(step)) energyStats[bucket].completed += 1;

    const minuteBucket = step.estimated_minutes <= 10 ? 'short' : 'long';
    minuteStats[minuteBucket].total += 1;
    if (isDone(step)) minuteStats[minuteBucket].completed += 1;

    if (bucket === 'low') {
      const key = minuteBucket === 'short' ? 'short_low' : 'long_low';
      minuteStats[key].total += 1;
      if (isDone(step)) minuteStats[key].completed += 1;
    }

    const domainRow = domainStats.get(step.domain) ?? {completed: 0, total: 0};
    domainRow.total += 1;
    if (isDone(step)) domainRow.completed += 1;
    domainStats.set(step.domain, domainRow);

    const ts = step.completed_at ?? step.updated_at;
    const hour = ts ? new Date(ts).getHours() : 12;
    const timeWindow = hourToWindow(hour);
    const windowRow = windowStats.get(timeWindow) ?? {completed: 0, total: 0};
    windowRow.total += 1;
    if (isDone(step)) windowRow.completed += 1;
    windowStats.set(timeWindow, windowRow);
  }

  const by_energy = (['low', 'mid', 'high'] as const).map((bucket) => ({
    bucket,
    threshold: bucket === 'low' ? '<5' : bucket === 'mid' ? '5-7' : '8+',
    completed: energyStats[bucket].completed,
    total: energyStats[bucket].total,
    rate: completionRate(energyStats[bucket].completed, energyStats[bucket].total),
  }));

  const by_minutes = [
    {
      bucket: 'short' as const,
      label: '≤10 min',
      completed: minuteStats.short.completed,
      total: minuteStats.short.total,
      rate: completionRate(minuteStats.short.completed, minuteStats.short.total),
    },
    {
      bucket: 'long' as const,
      label: '>10 min',
      completed: minuteStats.long.completed,
      total: minuteStats.long.total,
      rate: completionRate(minuteStats.long.completed, minuteStats.long.total),
    },
    {
      bucket: 'long' as const,
      label: '>10 min @ low energy',
      energy_bucket: 'low' as const,
      completed: minuteStats.long_low.completed,
      total: minuteStats.long_low.total,
      rate: completionRate(minuteStats.long_low.completed, minuteStats.long_low.total),
    },
    {
      bucket: 'short' as const,
      label: '≤10 min @ low energy',
      energy_bucket: 'low' as const,
      completed: minuteStats.short_low.completed,
      total: minuteStats.short_low.total,
      rate: completionRate(minuteStats.short_low.completed, minuteStats.short_low.total),
    },
  ];

  const by_domain = [...domainStats.entries()].map(([domain, stats]) => ({
    domain,
    completed: stats.completed,
    total: stats.total,
    rate: completionRate(stats.completed, stats.total),
  }));

  const by_time_window = [...windowStats.entries()].map(([window, stats]) => ({
    window,
    completed: stats.completed,
    total: stats.total,
    rate: completionRate(stats.completed, stats.total),
  }));

  const base = {by_energy, by_minutes, by_domain, by_time_window};
  const insights = buildInsights(base, input.locale);
  const plan_adjustments = derivePlanAdjustments(base, input.locale);

  return {
    ...base,
    insights,
    plan_adjustments,
  };
}

function parseWeeklyReviewMetadata(
  metadata: unknown
): import('@/lib/life-coach/types').WeeklyReview | null {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    return parseJsonOr<import('@/lib/life-coach/types').WeeklyReview | null>(metadata, null);
  }
  return metadata as import('@/lib/life-coach/types').WeeklyReview;
}

export function getActiveWeeklyPlanAdjustments(
  insight: import('@/lib/life-coach/types').AiCoachingInsight | null
): WeeklyPlanAdjustments | null {
  const meta = parseWeeklyReviewMetadata(insight?.metadata);
  if (!meta?.plan_adjustments) return null;
  if (insight?.plan_adjustments_applied_at || meta.plan_adjustments_applied_at) return null;
  if (meta.period_end) {
    const end = new Date(meta.period_end);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    if (end < cutoff) return null;
  }
  return meta.plan_adjustments;
}
