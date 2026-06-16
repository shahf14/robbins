import {dbAll} from '@/lib/db/sqlite';
import {REFLECTION_BLOCKER_REASONS, type ReflectionBlockerReason} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';
import type {
  BlockerAdjustment,
  RecurringBlockerPattern,
  RecurringBlockerSeverity,
} from './types';

const RECURRENCE_THRESHOLD = 3;

const ADJUSTMENT_BY_BLOCKER: Record<ReflectionBlockerReason, BlockerAdjustment> = {
  low_energy: 'reduce_task_count',
  no_time: 'reduce_task_count',
  family_chaos: 'plan_b_first',
  unclear_task: 'clarify_steps',
  forgot: 'shift_to_best_window',
  emotional_resistance: 'gentler_difficulty',
  other: 'shorten_steps',
};

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function isBlockerReason(value: string): value is ReflectionBlockerReason {
  return (REFLECTION_BLOCKER_REASONS as readonly string[]).includes(value);
}

function severityForCount(count: number): RecurringBlockerSeverity {
  return count >= 5 ? 'high' : 'medium';
}

function loadBlockerCounts(userId: string, since: string): Map<ReflectionBlockerReason, number> {
  const counts = new Map<ReflectionBlockerReason, number>();

  const stepRows = dbAll<{blocker_reason: string}>(
    `SELECT blocker_reason FROM daily_steps
     WHERE user_id = ? AND scheduled_date >= ? AND blocker_reason IS NOT NULL`,
    [userId, since]
  );
  const reflectionRows = dbAll<{blocker_reason: string}>(
    `SELECT blocker_reason FROM daily_reflections
     WHERE user_id = ? AND date >= ? AND blocker_reason IS NOT NULL`,
    [userId, since]
  );

  for (const row of [...stepRows, ...reflectionRows]) {
    if (!row.blocker_reason || !isBlockerReason(row.blocker_reason)) continue;
    counts.set(row.blocker_reason, (counts.get(row.blocker_reason) ?? 0) + 1);
  }

  return counts;
}

/**
 * Detect blockers that repeat 3+ times within the window.
 * Returns patterns sorted by frequency (highest first).
 */
export function detectRecurringBlockers(
  userId: string,
  windowDays = 14
): RecurringBlockerPattern[] {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const counts = loadBlockerCounts(userId, since);

  const patterns: RecurringBlockerPattern[] = [];

  for (const [blocker, count] of counts.entries()) {
    if (count < RECURRENCE_THRESHOLD) continue;
    patterns.push({
      blocker,
      count,
      severity: severityForCount(count),
      suggested_adjustment: ADJUSTMENT_BY_BLOCKER[blocker],
    });
  }

  return patterns.sort((a, b) => b.count - a.count);
}

export function recurringBlockerPatternsForPrompt(
  patterns: RecurringBlockerPattern[]
): RecurringBlockerPattern[] | null {
  if (patterns.length === 0) return null;
  return patterns;
}

/** Apply rule-based caps from recurring blocker patterns before AI generation. */
export function maxStepsFromBlockerPatterns(
  patterns: RecurringBlockerPattern[],
  defaultMax = 3
): number {
  let max = defaultMax;

  for (const pattern of patterns) {
    if (pattern.suggested_adjustment === 'reduce_task_count') {
      max = Math.min(max, pattern.severity === 'high' ? 1 : 2);
    }
    if (pattern.blocker === 'low_energy' && pattern.count >= 3) {
      max = Math.min(max, 2);
    }
    if (pattern.blocker === 'no_time' && pattern.severity === 'high') {
      max = Math.min(max, 2);
    }
  }

  return Math.max(1, max);
}
