export const SCHEMA_SQL = /* sql */ `

-- ── Users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                           TEXT PRIMARY KEY,
  email                        TEXT,
  display_name                 TEXT,
  language                     TEXT DEFAULT 'he' CHECK (language IN ('he', 'en')),
  timezone                     TEXT DEFAULT 'Asia/Jerusalem',
  life_context_status          TEXT,
  gender                       TEXT,
  age                          INTEGER,
  last_completed_formulation_at TEXT,
  formulation_gate_dismissed   INTEGER DEFAULT 0 CHECK (formulation_gate_dismissed IN (0, 1)),
  created_at                   TEXT DEFAULT (datetime('now')),
  updated_at                   TEXT DEFAULT (datetime('now'))
);

-- ── Check-ins ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
  date                 TEXT NOT NULL,
  focus_score          INTEGER CHECK (focus_score BETWEEN 1 AND 10),
  energy_score         INTEGER CHECK (energy_score BETWEEN 1 AND 10),
  state_score          INTEGER,
  momentum             INTEGER,
  primary_tag          TEXT,
  selected_tags        TEXT,        -- JSON array
  priority_action      TEXT,
  recommendation_type  TEXT,
  insight_key          TEXT,
  coach_support        TEXT,
  challenge_done       INTEGER DEFAULT 0,
  follow_ups           TEXT,        -- JSON array
  session_duration_sec              INTEGER,     -- seconds from form open to submit
  slider_adjustments                INTEGER,     -- slider moves before submit
  opened_coach_support              INTEGER DEFAULT 0, -- 1 if user read coach support
  -- Psychological metrics
  priority_action_word_count        INTEGER,     -- word count of priority action text
  rewrote_priority_action_count     INTEGER DEFAULT 0, -- times user deleted+rewrote
  tag_valence_shift                 INTEGER,     -- -1 / 0 / 1 vs previous check-in
  energy_focus_divergence           INTEGER,     -- |energy - focus|
  physical_complaint_mentioned      INTEGER DEFAULT 0, -- somatic language detected
  help_engagement_depth             TEXT,        -- none / glanced / read / acted
  stated_action_completed           INTEGER,     -- 0/1/NULL: did yesterday's action get done?
  entry_json                         TEXT,        -- Full local UI payload
  created_at                        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checkins_date   ON checkins(date);
CREATE INDEX IF NOT EXISTS idx_checkins_user   ON checkins(user_id, date);

-- ── Morning Rituals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS morning_rituals (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT REFERENCES users(id) ON DELETE SET NULL,
  date                     TEXT NOT NULL,
  mood_before              INTEGER CHECK (mood_before BETWEEN 1 AND 10),
  mood_after               INTEGER CHECK (mood_after BETWEEN 1 AND 10),
  triggers                 TEXT,              -- JSON array
  duration_sec             INTEGER,
  completed                INTEGER DEFAULT 0 CHECK (completed IN (0, 1)),
  mode                     TEXT CHECK (mode IN ('quick', 'standard', 'deep')),
  selected_affirmation_id  TEXT,              -- which affirmation was chosen
  breathing_rounds_done         INTEGER,   -- rounds actually completed
  skipped_steps                 TEXT,      -- JSON array of skipped step names
  visualization_duration_sec    INTEGER,   -- seconds on visualization step
  -- Psychological metrics
  gratitude_generic_flags       TEXT,      -- JSON [0,1,0] per entry
  gratitude_target_types        TEXT,      -- JSON ["person","thing","experience"]
  mission_changed_from_yesterday INTEGER DEFAULT 0,
  breathing_full_pattern_done   INTEGER DEFAULT 0,
  visualization_content_type    TEXT,      -- future_positive/problem_solving/escapist/empty
  created_at                    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_morning_rituals_date      ON morning_rituals(date);
CREATE INDEX IF NOT EXISTS idx_morning_rituals_user_date ON morning_rituals(user_id, date DESC, created_at DESC);

-- ── Gratitude Entries (child of morning_rituals) ─────────────────────────
CREATE TABLE IF NOT EXISTS gratitude_entries (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  ritual_id         TEXT REFERENCES morning_rituals(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  entry_text        TEXT NOT NULL,
  position          INTEGER DEFAULT 0, -- 1st / 2nd / 3rd gratitude of the day
  trigger_key       TEXT,              -- which gratitude prompt was shown
  entry_duration_sec INTEGER,          -- seconds from first keystroke to submit
  was_edited        INTEGER DEFAULT 0 CHECK (was_edited IN (0, 1)),
  created_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gratitude_date ON gratitude_entries(date);
CREATE INDEX IF NOT EXISTS idx_gratitude_ritual ON gratitude_entries(ritual_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gratitude_ritual_position ON gratitude_entries(ritual_id, position);

-- ── Ritual Content ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ritual_content (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('affirmation', 'identity')),
  item_json    TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ritual_content_user_type
  ON ritual_content(user_id, content_type, created_at DESC);

-- ── Domain Assessments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domain_assessments (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain                 TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  current_score          INTEGER CHECK (current_score BETWEEN 1 AND 10),
  current_state          TEXT,
  desired_state          TEXT,
  main_blockers          TEXT,    -- JSON array
  available_time_per_day INTEGER CHECK (available_time_per_day IN (5, 10, 20, 30)),
  intensity_preference   TEXT CHECK (intensity_preference IN ('gentle', 'balanced', 'intense')),
  created_at             TEXT DEFAULT (datetime('now')),
  updated_at             TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_assessment_user_domain
  ON domain_assessments(user_id, domain);

-- ── Goals ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain                TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  domain_category       TEXT,
  title                 TEXT NOT NULL,
  description           TEXT,
  success_metric        TEXT,
  deadline              TEXT,
  commitment_days       INTEGER DEFAULT 30,
  commitment_started_at TEXT,
  status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
  created_by            TEXT DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
  completed_at                  TEXT,    -- exact timestamp when marked complete
  revision_count                INTEGER DEFAULT 0, -- times goal text was edited
  -- Psychological metrics
  abandoned_before_first_step   INTEGER DEFAULT 0, -- deleted/archived with 0 completed steps
  success_metric_specificity    TEXT,    -- measurable / vague / absent
  create_idempotency_key TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_create_idempotency
  ON goals(user_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_user_domain ON goals(user_id, domain, status);
CREATE INDEX IF NOT EXISTS idx_goals_user_status_updated ON goals(user_id, status, updated_at DESC);

-- ── Milestones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  target_date  TEXT,
  day_marker   INTEGER,           -- 30 / 60 / 90
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at TEXT,              -- exact timestamp when marked complete
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_milestones_goal    ON milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user    ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal_created ON milestones(goal_id, created_at);

-- ── Daily Steps ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_steps (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id              TEXT REFERENCES goals(id) ON DELETE CASCADE,
  domain               TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  title                TEXT NOT NULL,
  description          TEXT,
  estimated_minutes    INTEGER NOT NULL CHECK (estimated_minutes BETWEEN 1 AND 60),
  difficulty           TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  scheduled_date       TEXT NOT NULL,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'partial')),
  generated_by_ai      INTEGER DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  is_general           INTEGER DEFAULT 0 CHECK (is_general IN (0, 1)),
  reflection_text      TEXT,
  blocker_reason        TEXT,
  completed_at          TEXT,              -- exact timestamp of status→completed
  actual_minutes        INTEGER,           -- self-reported actual duration
  rescheduled_from      TEXT,              -- original scheduled_date before first snooze
  reschedule_count      INTEGER DEFAULT 0, -- cumulative snooze count
  first_viewed_at       TEXT,              -- when step first appeared in UI
  coach_message_impression_at TEXT,        -- daily coach message shown above primary CTA
  primary_cta_clicked_at    TEXT,          -- primary step CTA clicked (CTR numerator)
  read_description      INTEGER DEFAULT 0 CHECK (read_description IN (0, 1)),
  -- Psychological metrics
  blocker_category      TEXT,              -- external / internal / unclear
  reattempt_same_day    INTEGER DEFAULT 0 CHECK (reattempt_same_day IN (0, 1)),
  fallback_title              TEXT,
  fallback_description        TEXT,
  fallback_estimated_minutes  INTEGER CHECK (fallback_estimated_minutes IS NULL OR fallback_estimated_minutes BETWEEN 1 AND 10),
  reasoning                 TEXT,
  expected_resistance       TEXT,
  pain_addressed            TEXT,
  success_signal            TEXT,
  user_edited               INTEGER DEFAULT 0 CHECK (user_edited IN (0, 1)),
  validation_fallback_applied INTEGER DEFAULT 0 CHECK (validation_fallback_applied IN (0, 1)),
  coach_tone           TEXT CHECK (coach_tone IS NULL OR coach_tone IN ('supportive', 'direct', 'motivational')),
  weekly_focus_id      TEXT REFERENCES weekly_goal_focus(id) ON DELETE SET NULL,
  value_feedback       TEXT CHECK (value_feedback IS NULL OR value_feedback IN ('felt_progress', 'too_small', 'too_generic', 'missed_problem')),
  create_idempotency_key TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_steps_date         ON daily_steps(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_steps_domain_date  ON daily_steps(user_id, domain, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_steps_goal_status  ON daily_steps(goal_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_steps_commitment_goal_date
  ON daily_steps(user_id, goal_id, scheduled_date)
  WHERE generated_by_ai = 0 AND goal_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_steps_create_idempotency
  ON daily_steps(user_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS api_idempotency_records (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope            TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  resource_id      TEXT,
  response_json    TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, scope, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_api_idempotency_resource
  ON api_idempotency_records(user_id, scope, resource_id);

-- ── Daily Reflections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reflections (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                 TEXT NOT NULL,
  mood_score           INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  energy_score         INTEGER CHECK (energy_score BETWEEN 1 AND 10),
  reflection_text      TEXT,
  blocker_reason            TEXT,
  writing_duration_sec      INTEGER,  -- seconds from textarea focus to submit
  -- Psychological metrics
  reflection_word_count     INTEGER,  -- word count
  self_blame_language       INTEGER DEFAULT 0, -- self-critical language detected
  analysis_json             TEXT,
  analyzed_at               TEXT,
  adjustment_applied_at     TEXT,
  created_at           TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reflections_user_date
  ON daily_reflections(user_id, date);

-- ── Weekly Goal Focus (Goal → milestone → weekly focus → daily steps) ───
CREATE TABLE IF NOT EXISTS weekly_goal_focus (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id             TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  domain              TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  week_start          TEXT NOT NULL,
  week_end            TEXT NOT NULL,
  active_milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  active_day_marker   INTEGER CHECK (active_day_marker IS NULL OR active_day_marker IN (30, 60, 90)),
  focus_title         TEXT NOT NULL,
  focus_description   TEXT,
  weekly_themes_json  TEXT NOT NULL DEFAULT '[]',
  progress_cue        TEXT,
  source              TEXT DEFAULT 'fallback' CHECK (source IN ('ai', 'fallback', 'weekly_review')),
  created_at          TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_focus_user_goal_week
  ON weekly_goal_focus(user_id, goal_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_focus_user_week
  ON weekly_goal_focus(user_id, week_start);

-- ── Skip coach loop (post-skip adjustment for tomorrow) ───────────────────
CREATE TABLE IF NOT EXISTS skip_coach_adjustments (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skip_date        TEXT NOT NULL,
  step_id          TEXT REFERENCES daily_steps(id) ON DELETE SET NULL,
  goal_id          TEXT REFERENCES goals(id) ON DELETE SET NULL,
  blocker_reason   TEXT,
  coach_action     TEXT NOT NULL CHECK (coach_action IN ('shrink_tomorrow', 'change_time', 'plan_b')),
  adjustment_json  TEXT NOT NULL,
  applied_at       TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_skip_coach_user_date
  ON skip_coach_adjustments(user_id, skip_date);
CREATE INDEX IF NOT EXISTS idx_skip_coach_user_created
  ON skip_coach_adjustments(user_id, created_at DESC);

-- ── AI Insights ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type         TEXT CHECK (insight_type IN ('pattern', 'recommendation', 'weekly_review')),
  content              TEXT,
  metadata             TEXT,     -- JSON
  tokens_used          INTEGER,  -- LLM tokens consumed
  generation_duration_ms INTEGER, -- ms for the AI call
  model_used           TEXT,     -- e.g. gpt-4o-mini
  plan_adjustments_applied_at TEXT,
  created_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_insights_user_type ON ai_insights(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_user_created ON ai_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_user_type_created ON ai_insights(user_id, insight_type, created_at DESC);

-- ── Weekly Reviews (flattened from ai_insights type=weekly_review) ────────
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id                     TEXT PRIMARY KEY REFERENCES ai_insights(id) ON DELETE CASCADE,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start           TEXT,
  period_end             TEXT,
  completed_steps_count  INTEGER,
  main_blocker           TEXT,
  strongest_domain       TEXT,
  weakest_domain         TEXT,
  recommended_adjustment TEXT,
  summary                TEXT,
  domain_progress        TEXT,   -- JSON array
  created_at             TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user ON weekly_reviews(user_id, period_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_user_period_unique
  ON weekly_reviews(user_id, period_start, period_end)
  WHERE period_start IS NOT NULL AND period_end IS NOT NULL;

-- ── Streaks (daily snapshot per domain) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain           TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  snapshot_date    TEXT NOT NULL,
  current_streak   INTEGER DEFAULT 0,
  longest_streak   INTEGER DEFAULT 0,
  total_completed  INTEGER DEFAULT 0,
  total_steps      INTEGER DEFAULT 0,
  consistency_rate REAL DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_streaks_snapshot
  ON streaks(user_id, domain, snapshot_date);

-- ── Formulation sessions (therapeutic clarification) ─────────────────────
CREATE TABLE IF NOT EXISTS formulation_sessions (
  id                            TEXT PRIMARY KEY,
  user_id                       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  locale                        TEXT NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
  status                        TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'abandoned', 'crisis_stopped', 'skipped_after_consent')),
  current_phase                 TEXT NOT NULL DEFAULT 'consent'
    CHECK (current_phase IN ('consent', 'risk', 'open', 'dimensions', 'exploration', 'formulation', 'goal', 'complete')),
  life_context_status           TEXT,
  life_context_statuses_json    TEXT,
  life_context_status_note      TEXT,
  participant_gender            TEXT,
  participant_age               INTEGER,
  consent_accepted_at           TEXT,
  consent_version               TEXT,
  boundaries_ack_json           TEXT,
  risk_q1                       INTEGER,
  risk_q2                       INTEGER,
  risk_follow_up_confirmed      INTEGER,
  risk_level                    TEXT CHECK (risk_level IN ('none', 'elevated', 'crisis')),
  risk_action                   TEXT CHECK (risk_action IN ('continue', 'resources', 'stop')),
  risk_screen_at                TEXT,
  presenting_concern_raw        TEXT,
  presenting_concern_user_words TEXT,
  reflection_llm_text           TEXT,
  passive_ratings_json          TEXT,
  rating_follow_ups_json        TEXT,
  dimensions_json               TEXT,
  formulation_draft_json        TEXT,
  formulation_approved_json     TEXT,
  user_edited_formulation       INTEGER DEFAULT 0 CHECK (user_edited_formulation IN (0, 1)),
  formulation_approved_at       TEXT,
  coach_handoff_json            TEXT,
  suggested_domain              TEXT CHECK (suggested_domain IS NULL OR suggested_domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
  created_goal_id               TEXT REFERENCES goals(id) ON DELETE SET NULL,
  checkin_prefill_json          TEXT,
  phases_skipped_json           TEXT,
  prior_question_key            TEXT,
  prior_question_answer         TEXT,
  prior_question_answers_json   TEXT,
  llm_exploration_questions_json TEXT,
  llm_exploration_answers_json   TEXT,
  last_ai_action                TEXT,
  last_ai_tokens                INTEGER,
  last_ai_model                 TEXT,
  last_ai_duration_ms           INTEGER,
  started_at                    TEXT DEFAULT (datetime('now')),
  completed_at                  TEXT,
  updated_at                    TEXT DEFAULT (datetime('now')),
  duration_sec                  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_formulation_user_status
  ON formulation_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_formulation_user_completed
  ON formulation_sessions(user_id, completed_at DESC);

-- ── Evening Resets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evening_resets (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT REFERENCES users(id) ON DELETE SET NULL,
  date                       TEXT NOT NULL,
  duration_sec               INTEGER,
  completed                  INTEGER DEFAULT 0 CHECK (completed IN (0, 1)),
  mode                       TEXT CHECK (mode IN ('quick', 'standard', 'deep')),
  readiness_score            INTEGER DEFAULT 0,
  tomorrows_win              TEXT,
  emotional_dump_word_count  INTEGER,
  blocker_mentioned          INTEGER DEFAULT 0,
  skipped_steps              TEXT,  -- JSON array
  tomorrow_constraint        TEXT,
  what_worked                TEXT,
  what_failed                TEXT,
  energy_forecast            TEXT CHECK (energy_forecast IN ('low', 'medium', 'high')),
  tomorrow_takeaway          TEXT,
  session_json               TEXT,  -- full session backup
  created_at                 TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evening_resets_date      ON evening_resets(date);
CREATE INDEX IF NOT EXISTS idx_evening_resets_user_date ON evening_resets(user_id, date DESC, created_at DESC);

-- Seed profile placeholders for local-first data that predates the users table.
INSERT OR IGNORE INTO users(id)
SELECT user_id FROM (
  SELECT user_id FROM checkins
  UNION SELECT user_id FROM morning_rituals
  UNION SELECT user_id FROM gratitude_entries
  UNION SELECT user_id FROM ritual_content
  UNION SELECT user_id FROM domain_assessments
  UNION SELECT user_id FROM goals
  UNION SELECT user_id FROM milestones
  UNION SELECT user_id FROM daily_steps
  UNION SELECT user_id FROM daily_reflections
  UNION SELECT user_id FROM weekly_goal_focus
  UNION SELECT user_id FROM skip_coach_adjustments
  UNION SELECT user_id FROM ai_insights
  UNION SELECT user_id FROM weekly_reviews
  UNION SELECT user_id FROM streaks
  UNION SELECT user_id FROM formulation_sessions
  UNION SELECT user_id FROM evening_resets
) WHERE user_id IS NOT NULL;

-- Local mode can write domain data before a profile settings screen is opened.
-- Create a minimal parent profile so user-level foreign keys remain enforceable.
CREATE TRIGGER IF NOT EXISTS trg_checkins_user_seed
BEFORE INSERT ON checkins WHEN NEW.user_id IS NOT NULL
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_rituals_user_seed
BEFORE INSERT ON morning_rituals WHEN NEW.user_id IS NOT NULL
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_gratitude_user_seed
BEFORE INSERT ON gratitude_entries WHEN NEW.user_id IS NOT NULL
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_ritual_content_user_seed
BEFORE INSERT ON ritual_content
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_assessments_user_seed
BEFORE INSERT ON domain_assessments
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_goals_user_seed
BEFORE INSERT ON goals
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_milestones_user_seed
BEFORE INSERT ON milestones
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_steps_user_seed
BEFORE INSERT ON daily_steps
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_reflections_user_seed
BEFORE INSERT ON daily_reflections
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_insights_user_seed
BEFORE INSERT ON ai_insights
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_weekly_reviews_user_seed
BEFORE INSERT ON weekly_reviews
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_streaks_user_seed
BEFORE INSERT ON streaks
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_formulation_sessions_user_seed
BEFORE INSERT ON formulation_sessions
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS trg_evening_resets_user_seed
BEFORE INSERT ON evening_resets WHEN NEW.user_id IS NOT NULL
BEGIN INSERT OR IGNORE INTO users(id) VALUES (NEW.user_id); END;

-- Existing SQLite files cannot gain FOREIGN KEY clauses through ALTER TABLE.
-- These guards provide equivalent protection without rebuilding user data.
CREATE TRIGGER IF NOT EXISTS trg_milestones_goal_guard_insert
BEFORE INSERT ON milestones
WHEN NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'milestones.goal_id must reference a goal owned by user_id'); END;
CREATE TRIGGER IF NOT EXISTS trg_milestones_goal_guard_update
BEFORE UPDATE OF goal_id, user_id ON milestones
WHEN NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'milestones.goal_id must reference a goal owned by user_id'); END;

CREATE TRIGGER IF NOT EXISTS trg_steps_goal_guard_insert
BEFORE INSERT ON daily_steps
WHEN NEW.goal_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'daily_steps.goal_id must reference a goal owned by user_id'); END;
CREATE TRIGGER IF NOT EXISTS trg_steps_goal_guard_update
BEFORE UPDATE OF goal_id, user_id ON daily_steps
WHEN NEW.goal_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'daily_steps.goal_id must reference a goal owned by user_id'); END;

CREATE TRIGGER IF NOT EXISTS trg_steps_general_guard_insert
BEFORE INSERT ON daily_steps
WHEN NEW.is_general = 1 AND NEW.goal_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'general daily_steps cannot reference goal_id'); END;
CREATE TRIGGER IF NOT EXISTS trg_steps_general_guard_update
BEFORE UPDATE OF is_general, goal_id ON daily_steps
WHEN NEW.is_general = 1 AND NEW.goal_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'general daily_steps cannot reference goal_id'); END;

CREATE TRIGGER IF NOT EXISTS trg_steps_goal_required_guard_insert
BEFORE INSERT ON daily_steps
WHEN COALESCE(NEW.is_general, 0) = 0 AND NEW.goal_id IS NULL
BEGIN SELECT RAISE(ABORT, 'non-general daily_steps must reference goal_id'); END;
CREATE TRIGGER IF NOT EXISTS trg_steps_goal_required_guard_update
BEFORE UPDATE OF is_general, goal_id ON daily_steps
WHEN COALESCE(NEW.is_general, 0) = 0 AND NEW.goal_id IS NULL
BEGIN SELECT RAISE(ABORT, 'non-general daily_steps must reference goal_id'); END;

CREATE TRIGGER IF NOT EXISTS trg_steps_goal_domain_guard_insert
BEFORE INSERT ON daily_steps
WHEN NEW.goal_id IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM goals
   WHERE id = NEW.goal_id AND user_id = NEW.user_id AND domain <> NEW.domain
 )
BEGIN SELECT RAISE(ABORT, 'daily_steps.domain must match linked goal domain'); END;
CREATE TRIGGER IF NOT EXISTS trg_steps_goal_domain_guard_update
BEFORE UPDATE OF goal_id, user_id, domain ON daily_steps
WHEN NEW.goal_id IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM goals
   WHERE id = NEW.goal_id AND user_id = NEW.user_id AND domain <> NEW.domain
 )
BEGIN SELECT RAISE(ABORT, 'daily_steps.domain must match linked goal domain'); END;

CREATE TRIGGER IF NOT EXISTS trg_gratitude_ritual_guard_insert
BEFORE INSERT ON gratitude_entries
WHEN NEW.ritual_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM morning_rituals
   WHERE id = NEW.ritual_id
     AND (user_id = NEW.user_id OR user_id IS NULL OR NEW.user_id IS NULL)
 )
BEGIN SELECT RAISE(ABORT, 'gratitude_entries.ritual_id must reference a compatible ritual'); END;
CREATE TRIGGER IF NOT EXISTS trg_gratitude_ritual_guard_update
BEFORE UPDATE OF ritual_id, user_id ON gratitude_entries
WHEN NEW.ritual_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM morning_rituals
   WHERE id = NEW.ritual_id
     AND (user_id = NEW.user_id OR user_id IS NULL OR NEW.user_id IS NULL)
 )
BEGIN SELECT RAISE(ABORT, 'gratitude_entries.ritual_id must reference a compatible ritual'); END;

CREATE TRIGGER IF NOT EXISTS trg_weekly_reviews_insight_guard_insert
BEFORE INSERT ON weekly_reviews
WHEN NOT EXISTS (SELECT 1 FROM ai_insights WHERE id = NEW.id AND user_id = NEW.user_id AND insight_type = 'weekly_review')
BEGIN SELECT RAISE(ABORT, 'weekly_reviews.id must reference a weekly_review insight owned by user_id'); END;
CREATE TRIGGER IF NOT EXISTS trg_weekly_reviews_insight_guard_update
BEFORE UPDATE OF id, user_id ON weekly_reviews
WHEN NOT EXISTS (SELECT 1 FROM ai_insights WHERE id = NEW.id AND user_id = NEW.user_id AND insight_type = 'weekly_review')
BEGIN SELECT RAISE(ABORT, 'weekly_reviews.id must reference a weekly_review insight owned by user_id'); END;

CREATE TRIGGER IF NOT EXISTS trg_goals_delete_dependents
AFTER DELETE ON goals
BEGIN
  DELETE FROM milestones WHERE goal_id = OLD.id;
  DELETE FROM daily_steps WHERE goal_id = OLD.id;
  DELETE FROM weekly_goal_focus WHERE goal_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_rituals_delete_dependents
AFTER DELETE ON morning_rituals
BEGIN
  DELETE FROM gratitude_entries WHERE ritual_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_insights_delete_dependents
AFTER DELETE ON ai_insights
BEGIN
  DELETE FROM weekly_reviews WHERE id = OLD.id;
END;

-- ── User behavior profile (dynamic, refreshed from actions) ───────────────────
CREATE TABLE IF NOT EXISTS user_behavior_profile (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_action_window     TEXT DEFAULT 'flexible'
    CHECK (best_action_window IN ('morning', 'midday', 'evening', 'flexible')),
  avoid_windows          TEXT DEFAULT '[]',
  best_windows           TEXT DEFAULT '[]',
  weekday_skip_patterns  TEXT DEFAULT '[]',
  avg_completion_rate_7d REAL DEFAULT 0,
  avg_actual_minutes     REAL,
  common_blockers        TEXT DEFAULT '[]',
  preferred_domains      TEXT DEFAULT '[]',
  low_energy_frequency   REAL DEFAULT 0,
  recovery_rate          REAL DEFAULT 0,
  failed_action_patterns TEXT DEFAULT '[]',
  sample_size_7d         INTEGER DEFAULT 0,
  tone_effectiveness     TEXT,
  updated_at             TEXT DEFAULT (datetime('now'))
);

-- ── Gamification unlocks (persisted reward history) ───────────────────────
CREATE TABLE IF NOT EXISTS gamification_unlocks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('mystery_unlock', 'reflection_loot', 'identity_title')),
  reward_key  TEXT NOT NULL,
  week_start  TEXT,
  context_json TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gamification_unlocks_user ON gamification_unlocks(user_id, created_at DESC);

-- Existing local databases may predate the foreign-key declarations above.
-- Keep user deletion complete even when those older tables cannot be rebuilt.
CREATE TRIGGER IF NOT EXISTS trg_users_delete_dependents
AFTER DELETE ON users
BEGIN
  DELETE FROM checkins WHERE user_id = OLD.id;
  DELETE FROM gratitude_entries WHERE user_id = OLD.id;
  DELETE FROM morning_rituals WHERE user_id = OLD.id;
  DELETE FROM ritual_content WHERE user_id = OLD.id;
  DELETE FROM domain_assessments WHERE user_id = OLD.id;
  DELETE FROM daily_reflections WHERE user_id = OLD.id;
  DELETE FROM milestones WHERE user_id = OLD.id;
  DELETE FROM daily_steps WHERE user_id = OLD.id;
  DELETE FROM goals WHERE user_id = OLD.id;
  DELETE FROM weekly_reviews WHERE user_id = OLD.id;
  DELETE FROM skip_coach_adjustments WHERE user_id = OLD.id;
  DELETE FROM weekly_goal_focus WHERE user_id = OLD.id;
  DELETE FROM ai_insights WHERE user_id = OLD.id;
  DELETE FROM streaks WHERE user_id = OLD.id;
  DELETE FROM formulation_sessions WHERE user_id = OLD.id;
  DELETE FROM evening_resets WHERE user_id = OLD.id;
  DELETE FROM user_behavior_profile WHERE user_id = OLD.id;
  DELETE FROM gamification_unlocks WHERE user_id = OLD.id;
END;

`;
