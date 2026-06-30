import {getDb} from '../sqlite';
import {randomUUID} from 'crypto';
import {inferDayMarkerFromTitle} from '@/lib/goal-day-marker';
import type {Goal, Milestone} from '@/lib/life-coach/types';

export function ensureDomainAssessmentForGoal(userId: string, domain: string): void {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM domain_assessments WHERE user_id = ? AND domain = ?`)
    .get(userId, domain);
  if (existing) return;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domain_assessments
      (id, user_id, domain, current_score, current_state, desired_state,
       main_blockers, available_time_per_day, intensity_preference, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(randomUUID(), userId, domain, 5, '', '', '[]', 10, 'balanced', now, now);
}

export function rowToGoal(row: Record<string, unknown>): Goal {
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

export function findGoalByCreateIdempotencyKey(userId: string, key: string): Goal | null {
  const row = getDb()
    .prepare(`SELECT * FROM goals WHERE user_id = ? AND create_idempotency_key = ?`)
    .get(userId, key) as Record<string, unknown> | undefined;
  return row ? rowToGoal(row) : null;
}

export function upsertGoal(
  goal: Goal,
  domainCategory = goal.domain_category ?? undefined,
  createIdempotencyKey: string | null = null
): void {
  const db = getDb();
  const insertGoal = db.prepare(
    `INSERT INTO goals
      (id, user_id, domain, domain_category, title, description, success_metric,
       deadline, commitment_days, commitment_started_at, status, created_by, completed_at, revision_count,
       abandoned_before_first_step, success_metric_specificity,
       create_idempotency_key, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
       updated_at = excluded.updated_at`
  ).run(
    goal.id, goal.user_id, goal.domain, domainCategory ?? null,
    goal.title, goal.description, goal.success_metric,
    goal.deadline ?? null, goal.commitment_days ?? 30, goal.commitment_started_at ?? null,
    goal.status, goal.created_by,
    goal.completed_at ?? null, goal.revision_count ?? 0,
    goal.abandoned_before_first_step ?? 0, goal.success_metric_specificity ?? null,
    createIdempotencyKey,
    goal.created_at, goal.updated_at
  );

  ensureDomainAssessmentForGoal(goal.user_id, goal.domain);
}

export function upsertMilestone(milestone: Milestone, userId: string): void {
  const db = getDb();
  const dayMarker = milestone.day_marker ?? inferDayMarkerFromTitle(milestone.title);

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
