import {dateToYMD} from '@/lib/date-utils';
import {randomUUID} from 'crypto';
import {dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {ReflectionAnalysis, ReflectionPlanAdjustments} from './types';

function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dateToYMD(d);
}

export function saveReflectionAnalysis(
  userId: string,
  date: string,
  analysis: ReflectionAnalysis
): void {
  const now = new Date().toISOString();
  const existing = dbGet<{id: string}>(
    `SELECT id FROM daily_reflections WHERE user_id = ? AND date = ?`,
    [userId, date]
  );

  if (existing) {
    dbRun(
      `UPDATE daily_reflections
       SET analysis_json = ?, analyzed_at = ?, adjustment_applied_at = NULL
       WHERE id = ? AND user_id = ?`,
      [JSON.stringify(analysis), now, existing.id, userId]
    );
    return;
  }

  dbRun(
    `INSERT INTO daily_reflections
      (id, user_id, date, analysis_json, analyzed_at, created_at)
     VALUES (?,?,?,?,?,?)`,
    [randomUUID(), userId, date, JSON.stringify(analysis), now, now]
  );
}

function parseReflectionAnalysis(raw: unknown): ReflectionAnalysis | null {
  if (!raw) return null;
  const value = typeof raw === 'string' ? parseJsonOr<unknown>(raw, null) : raw;
  if (!value || typeof value !== 'object') return null;
  return value as ReflectionAnalysis;
}

export function getActiveReflectionPlanAdjustments(
  userId: string,
  targetDate: string
): ReflectionPlanAdjustments | null {
  const reflectionDate = previousDate(targetDate);
  const row = dbGet<{
    date: string;
    analysis_json: string | null;
    adjustment_applied_at: string | null;
  }>(
    `SELECT date, analysis_json, adjustment_applied_at
     FROM daily_reflections
     WHERE user_id = ? AND date = ? AND analysis_json IS NOT NULL`,
    [userId, reflectionDate]
  );

  if (!row?.analysis_json || row.adjustment_applied_at) return null;

  const analysis = parseReflectionAnalysis(row.analysis_json);
  if (!analysis) return null;

  return {
    reflection_date: row.date,
    max_tasks: analysis.next_day_adjustments.max_tasks,
    max_minutes_per_task: analysis.next_day_adjustments.max_minutes_per_task,
    easy_only: analysis.next_day_adjustments.easy_only,
    recommended_adjustment: analysis.recommended_adjustment,
    risk_signal: analysis.risk_signal,
  };
}

export function markReflectionAdjustmentApplied(
  userId: string,
  reflectionDate: string
): void {
  dbRun(
    `UPDATE daily_reflections
     SET adjustment_applied_at = ?
     WHERE user_id = ? AND date = ?`,
    [new Date().toISOString(), userId, reflectionDate]
  );
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

export function computeReflectionAdjustmentMetrics(
  userId: string,
  windowDays = 14
): import('./types').ReflectionAdjustmentMetrics {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const rows = dbAll<{analyzed_at: string | null; adjustment_applied_at: string | null}>(
    `SELECT analyzed_at, adjustment_applied_at FROM daily_reflections
     WHERE user_id = ? AND analyzed_at IS NOT NULL AND date >= ?`,
    [userId, since]
  );

  const analyzed = rows.length;
  const applied = rows.filter((row) => row.adjustment_applied_at).length;

  return {
    analyzed_reflections: analyzed,
    adjustments_applied: applied,
    adjustment_rate: analyzed > 0 ? Math.round((applied / analyzed) * 100) / 100 : 0,
  };
}
