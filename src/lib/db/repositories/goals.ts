import {getDb} from '../sqlite';
import {randomUUID} from 'crypto';
import {parseJsonOr} from '@/lib/safe-json';
import type {Goal, Milestone} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';

const healthUnits = {
  fitness: 'workouts_per_week',
  sleep: 'hours',
  nutrition: 'healthy_meals_per_day',
  weight: 'kg',
  energy: 'score_1_10',
  specific_illness: 'severity_score_1_10',
} as const;

function extractHealthFields(goal: Goal) {
  const hc = goal.health_context;
  if (!hc) return {};
  return {
    health_category: hc.category ?? null,
    health_baseline: hc.metrics?.baseline_value ?? null,
    health_target: hc.metrics?.target_value ?? null,
    health_unit: healthUnits[hc.category] ?? null,
    health_weight_dir: hc.weight_direction ?? null,
    health_anchor_habit: hc.anchor?.habit_key ?? null,
    health_anchor_time: hc.anchor?.time ?? null,
    health_why_important: hc.why_deep?.why_important ?? null,
    health_why_now: hc.why_deep?.why_now ?? null,
    health_what_lost: hc.why_deep?.what_lost ?? null,
    plan_source: hc.plan_source ?? null,
  };
}

export function rowToGoal(row: Record<string, unknown>): Goal {
  const health_context = parseJsonOr<Goal['health_context']>(row.health_context_json, null);
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    domain: row.domain as Goal['domain'],
    domain_category: (row.domain_category as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? '',
    success_metric: (row.success_metric as string) ?? '',
    deadline: (row.deadline as string) ?? null,
    commitment_days: (row.commitment_days as number) ?? 30,
    commitment_started_at: (row.commitment_started_at as string) ?? null,
    status: row.status as Goal['status'],
    created_by: (row.created_by as Goal['created_by']) ?? 'user',
    health_context,
    completed_at: (row.completed_at as string) ?? null,
    revision_count: (row.revision_count as number) ?? 0,
    abandoned_before_first_step: (row.abandoned_before_first_step as number) ?? 0,
    success_metric_specificity: (row.success_metric_specificity as Goal['success_metric_specificity']) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function rowToMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as string,
    goal_id: row.goal_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    target_date: (row.target_date as string) ?? null,
    day_marker: (row.day_marker as number) ?? null,
    status: (row.status as Milestone['status']) ?? 'pending',
    completed_at: (row.completed_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function upsertGoal(goal: Goal, domainCategory = goal.domain_category ?? undefined): void {
  const db = getDb();
  const hf = extractHealthFields(goal);
  const insertGoal = db.prepare(
    `INSERT INTO goals
      (id, user_id, domain, domain_category, title, description, success_metric,
       deadline, commitment_days, commitment_started_at, status, created_by, completed_at, revision_count,
       abandoned_before_first_step, success_metric_specificity,
       health_category, health_baseline, health_target, health_unit,
       health_weight_dir, health_anchor_habit, health_anchor_time,
       health_why_important, health_why_now, health_what_lost,
       plan_source, health_context_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       domain = excluded.domain,
       domain_category = excluded.domain_category,
       title = excluded.title,
       description = excluded.description,
       success_metric = excluded.success_metric,
       deadline = excluded.deadline,
       commitment_days = excluded.commitment_days,
       commitment_started_at = excluded.commitment_started_at,
       status = excluded.status,
       created_by = excluded.created_by,
       completed_at = excluded.completed_at,
       revision_count = excluded.revision_count,
       abandoned_before_first_step = excluded.abandoned_before_first_step,
       success_metric_specificity = excluded.success_metric_specificity,
       health_category = excluded.health_category,
       health_baseline = excluded.health_baseline,
       health_target = excluded.health_target,
       health_unit = excluded.health_unit,
       health_weight_dir = excluded.health_weight_dir,
       health_anchor_habit = excluded.health_anchor_habit,
       health_anchor_time = excluded.health_anchor_time,
       health_why_important = excluded.health_why_important,
       health_why_now = excluded.health_why_now,
       health_what_lost = excluded.health_what_lost,
       plan_source = excluded.plan_source,
       health_context_json = excluded.health_context_json,
       updated_at = excluded.updated_at`
  ).run(
    goal.id, goal.user_id, goal.domain, domainCategory ?? null,
    goal.title, goal.description, goal.success_metric,
    goal.deadline ?? null, goal.commitment_days ?? 30, goal.commitment_started_at ?? null,
    goal.status, goal.created_by,
    goal.completed_at ?? null, goal.revision_count ?? 0,
    goal.abandoned_before_first_step ?? 0, goal.success_metric_specificity ?? null,
    hf.health_category ?? null, hf.health_baseline ?? null,
    hf.health_target ?? null, hf.health_unit ?? null,
    hf.health_weight_dir ?? null, hf.health_anchor_habit ?? null,
    hf.health_anchor_time ?? null, hf.health_why_important ?? null,
    hf.health_why_now ?? null, hf.health_what_lost ?? null,
    hf.plan_source ?? null,
    goal.health_context ? JSON.stringify(goal.health_context) : null,
    goal.created_at, goal.updated_at
  );

  // Upsert health phases from execution_plan
  const plan = goal.health_context?.execution_plan;
  if (plan?.phases?.length) {
    upsertHealthPhases(goal.id, goal.user_id, plan.phases);
  }
}

export function upsertMilestone(milestone: Milestone, userId: string): void {
  const db = getDb();
  const dayMarker = milestone.title.includes('30') ? 30
    : milestone.title.includes('60') ? 60
    : milestone.title.includes('90') ? 90
    : null;

  db.prepare(
    `INSERT OR REPLACE INTO milestones
      (id, goal_id, user_id, title, description, target_date, day_marker, status,
       completed_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    milestone.id, milestone.goal_id, userId,
    milestone.title, milestone.description ?? null,
    milestone.target_date ?? null, dayMarker,
    milestone.status, milestone.completed_at ?? null, milestone.created_at
  );
}

type Phase = {
  start_day: number;
  end_day: number;
  focus: string;
  task_templates?: Array<string | {title?: string; description?: string; [key: string]: unknown}>;
  weigh_in?: boolean;
};

function upsertHealthPhases(goalId: string, userId: string, phases: Phase[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO health_phases
      (id, goal_id, user_id, phase_index, start_day, end_day, focus, task_templates, weigh_in)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const run = db.transaction((items: Phase[]) => {
    db.prepare(`DELETE FROM health_phases WHERE goal_id = ?`).run(goalId);
    items.forEach((phase, idx) => {
      stmt.run(
        randomUUID(), goalId, userId, idx,
        phase.start_day, phase.end_day, phase.focus,
        JSON.stringify(
          (phase.task_templates ?? []).map((t) =>
            typeof t === 'string' ? t : (t as {title?: string}).title ?? JSON.stringify(t)
          )
        ),
        phase.weigh_in ? 1 : 0
      );
    });
  });
  run(phases);
}

/**
 * Create a "freestyle" goal — a lightweight, self-defined recurring task.
 *
 * Unified data model: instead of a parallel table, a freestyle task is a normal
 * goal (plan_source = 'freestyle') with one pre-generated daily_step per
 * occurrence: `times_per_day * target_days` steps in total, scheduled on
 * consecutive days starting today. They therefore show up alongside every other
 * daily task automatically.
 */
export function createFreestyleGoal(
  userId: string,
  input: {domain: string; title: string; success_metric?: string; times_per_day: number; target_days: number}
): Goal {
  const db = getDb();
  const now = new Date().toISOString();
  const goalId = randomUUID();
  const timesPerDay = Math.max(1, Math.round(input.times_per_day));
  const targetDays = Math.max(1, Math.round(input.target_days));
  const title = input.title.trim();

  const insertGoal = db.prepare(
    `INSERT INTO goals
      (id, user_id, domain, title, description, success_metric, deadline, status,
       created_by, plan_source, freestyle_times_per_day, freestyle_target_days,
       created_at, updated_at)
     VALUES (?,?,?,?,?,?,?, 'active', 'user', 'freestyle', ?, ?, ?, ?)`
  );

  const stepStmt = db.prepare(
    `INSERT INTO daily_steps
      (id, user_id, goal_id, domain, title, description, estimated_minutes,
       difficulty, scheduled_date, status, generated_by_ai, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'pending', 0, ?, ?)`
  );
  const today = new Date();
  db.transaction(() => {
    insertGoal.run(
      goalId, userId, input.domain, title, '',
      input.success_metric ?? '', null, timesPerDay, targetDays, now, now
    );
    for (let day = 0; day < targetDays; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      const scheduled = dateToYMD(date);
      for (let occ = 0; occ < timesPerDay; occ++) {
        stepStmt.run(
          randomUUID(), userId, goalId, input.domain, title, '', 5,
          'easy', scheduled, now, now
        );
      }
    }
  })();

  const row = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(goalId) as Record<string, unknown>;
  return rowToGoal(row);
}
