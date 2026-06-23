import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';

const dbPath = process.env.LIFE_COACH_DB_PATH
  ? path.resolve(process.env.LIFE_COACH_DB_PATH)
  : path.join(process.cwd(), 'data', 'life-coach.db');

const db = new Database(dbPath, {readonly: true});
const dailyStepColumns = new Set(
  db.pragma('table_info(daily_steps)').map((column) => column.name)
);
const isGeneralSql = dailyStepColumns.has('is_general')
  ? 'COALESCE(is_general, 0)'
  : 'CASE WHEN goal_id IS NULL THEN 1 ELSE 0 END';

const checks = [
  {
    name: 'non_general_steps_without_goal',
    sql: `
      SELECT id, user_id, domain, title, scheduled_date
      FROM daily_steps
      WHERE ${isGeneralSql} = 0 AND goal_id IS NULL
      ORDER BY scheduled_date DESC
    `,
  },
  {
    name: 'general_steps_with_goal',
    sql: `
      SELECT id, user_id, domain, goal_id, title, scheduled_date
      FROM daily_steps
      WHERE ${isGeneralSql} = 1 AND goal_id IS NOT NULL
      ORDER BY scheduled_date DESC
    `,
  },
  {
    name: 'steps_with_orphan_goal',
    sql: `
      SELECT ds.id, ds.user_id, ds.domain, ds.goal_id, ds.title
      FROM daily_steps ds
      LEFT JOIN goals g ON g.id = ds.goal_id AND g.user_id = ds.user_id
      WHERE ds.goal_id IS NOT NULL AND g.id IS NULL
    `,
  },
  {
    name: 'steps_goal_domain_mismatch',
    sql: `
      SELECT ds.id, ds.user_id, ds.domain AS step_domain,
             ds.goal_id, g.domain AS goal_domain, ds.title
      FROM daily_steps ds
      JOIN goals g ON g.id = ds.goal_id AND g.user_id = ds.user_id
      WHERE ds.domain <> g.domain
    `,
  },
  {
    name: 'active_goals_without_domain_assessment',
    sql: `
      SELECT g.id, g.user_id, g.domain, g.title, g.status
      FROM goals g
      LEFT JOIN domain_assessments da
        ON da.user_id = g.user_id AND da.domain = g.domain
      WHERE g.status = 'active' AND da.id IS NULL
      ORDER BY g.updated_at DESC
    `,
  },
  {
    name: 'milestones_with_orphan_goal',
    sql: `
      SELECT m.id, m.user_id, m.goal_id, m.title
      FROM milestones m
      LEFT JOIN goals g ON g.id = m.goal_id AND g.user_id = m.user_id
      WHERE g.id IS NULL
    `,
  },
  {
    name: 'weekly_focus_goal_domain_mismatch',
    sql: `
      SELECT w.id, w.user_id, w.goal_id, w.domain AS focus_domain,
             g.domain AS goal_domain, w.week_start
      FROM weekly_goal_focus w
      JOIN goals g ON g.id = w.goal_id AND g.user_id = w.user_id
      WHERE w.domain <> g.domain
    `,
  },
  {
    name: 'weekly_focus_milestone_goal_mismatch',
    sql: `
      SELECT w.id, w.user_id, w.goal_id AS focus_goal_id,
             w.active_milestone_id, m.goal_id AS milestone_goal_id
      FROM weekly_goal_focus w
      JOIN milestones m ON m.id = w.active_milestone_id
      WHERE w.active_milestone_id IS NOT NULL
        AND m.goal_id <> w.goal_id
    `,
  },
  {
    name: 'health_phases_with_orphan_goal',
    sql: `
      SELECT hp.id, hp.user_id, hp.goal_id, hp.phase_index
      FROM health_phases hp
      LEFT JOIN goals g ON g.id = hp.goal_id AND g.user_id = hp.user_id
      WHERE g.id IS NULL
    `,
  },
  {
    name: 'health_goals_with_legacy_health_context',
    sql: `
      SELECT id, user_id, title, health_context_json, plan_source
      FROM goals
      WHERE domain = 'health'
        AND (
          health_context_json IS NOT NULL
          OR plan_source IS NOT NULL
          OR health_category IS NOT NULL
          OR health_baseline IS NOT NULL
          OR health_target IS NOT NULL
          OR health_unit IS NOT NULL
          OR health_weight_dir IS NOT NULL
          OR health_anchor_habit IS NOT NULL
          OR health_anchor_time IS NOT NULL
          OR health_why_important IS NOT NULL
          OR health_why_now IS NOT NULL
          OR health_what_lost IS NOT NULL
        )
    `,
  },
  {
    name: 'health_phases_remaining',
    sql: `
      SELECT id, user_id, goal_id, phase_index
      FROM health_phases
    `,
  },
];

let failures = 0;

console.log(`Object relation audit: ${dbPath}`);

for (const check of checks) {
  const rows = db.prepare(check.sql).all();
  if (rows.length === 0) {
    console.log(`OK ${check.name}`);
    continue;
  }

  failures += rows.length;
  console.log(`FAIL ${check.name}: ${rows.length}`);
  console.table(rows.slice(0, 20));
  if (rows.length > 20) {
    console.log(`... ${rows.length - 20} more`);
  }
}

if (failures > 0) {
  console.error(`Object relation audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('Object relation audit passed.');
