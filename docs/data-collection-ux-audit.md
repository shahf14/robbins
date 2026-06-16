# Data Collection UX Audit

## Collection principles

- Ask only for information the user can answer better than the product can infer.
- Capture interaction metadata passively and explain sensitive analysis in the privacy copy.
- Let users disable optional passive behavioral analytics without losing core coaching.
- Ask reflective questions at natural moments: check-in, ritual completion, task completion, skip, or periodic assessment.
- Keep optional questions skippable. Missing data is better than rushed or invented data.
- Treat AI outputs and derived scores as product signals, not as clinical facts.

## Users

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `id`, `created_at`, `updated_at` | System generated | No user input. |
| `email` | Authentication | Ask only during sign-in. |
| `display_name` | Optional profile input, stored locally | Keep optional; it is useful for personalization but not required for coaching. Server profile storage remains reserved until profile sync and consent are introduced. |
| `language`, `timezone` | Infer from locale and device, allow override in settings | Efficient: browser timezone is now used as the local default and existing profile values survive repeated requests. |

## Check-ins

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `focus_score`, `energy_score` | Two 1-10 sliders in the daily check-in | Efficient: fast, comparable over time, and placed before recommendations. |
| `selected_tags`, `primary_tag` | Up to two emotion/state chips | Efficient: the cap prevents choice overload. |
| `priority_action` | One short free-text prompt | Efficient: one concrete action is more useful than a broad journal prompt. |
| `stated_action_completed` | Yes / partly / no for the previous action | Efficient: ask only when a previous action exists. |
| `state_score`, `momentum`, `recommendation_type`, `insight_key`, `coach_support` | Derived by the product | Never ask the user. |
| `challenge_done`, `follow_ups`, `opened_coach_support`, `help_engagement_depth` | Passive interaction capture | Never ask the user. |
| `session_duration_sec`, `slider_adjustments`, `priority_action_word_count`, `rewrote_priority_action_count`, `tag_valence_shift`, `energy_focus_divergence`, `physical_complaint_mentioned` | Passive or derived capture when behavioral insights are enabled | Never ask the user. Sensitive inferences are optional and controlled in settings. |
| `id`, `user_id`, `date`, `created_at` | System generated | No user input. |

Change made: passive and derived check-in metrics now survive local-history migration and admin sync.

Change made: admin sync preserves original check-in dates instead of assigning the import date to historical entries.

Change made: changing the interface language now updates the shared local preference object as well as the routing cookie. Legacy preference records with no timezone infer it from the browser automatically.

## Morning rituals and gratitude entries

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `mode` | Quick / standard / deep choice | Efficient: gives the user control over effort before the ritual starts. |
| `mood_before`, `mood_after` | Optional 1-10 rating before and after | Efficient: optional and placed around the intervention. |
| `selected_affirmation_id`, `completed` | Passive interaction capture | Never ask the user. These remain core ritual history. |
| `breathing_rounds_done`, `skipped_steps`, `visualization_duration_sec`, `duration_sec` | Passive interaction capture when behavioral insights are enabled | Optional analytics; disable from settings without changing the ritual flow. |
| `gratitude_generic_flags`, `gratitude_target_types`, `mission_changed_from_yesterday`, `breathing_full_pattern_done`, `visualization_content_type` | Derived capture when behavioral insights are enabled | Never ask the user. These local inferences are optional. |
| `entry_text` | Guided text or voice input | Efficient: voice input lowers effort. |
| `position`, `trigger_key`, `entry_duration_sec`, `was_edited` | Passive capture while writing gratitude entries | Never ask the user. |
| `id`, `user_id`, `ritual_id`, `date`, `created_at` | System generated | No user input. |

Change made: ritual completion now persists flattened ritual fields and child gratitude rows. Gratitude composition time is captured passively.

Change made: admin sync preserves original ritual dates and stable ritual IDs, so repeated imports update existing history instead of duplicating it.

## Domain assessments

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `domain` | Context from the page the user opened | Never ask again inside the form. |
| `current_score` | One 1-10 slider | Efficient as a quick baseline. |
| `current_state`, `desired_state` | Short free text with starter chips | Efficient: starters reduce blank-page effort without forcing an answer. |
| `main_blockers` | Multi-select chips plus custom blocker | Efficient: supports both speed and specificity. |
| `available_time_per_day` | Four chips | Efficient: easier to answer than a numeric input. |
| `intensity_preference` | Gentle / balanced / intense chips | Efficient and directly useful for plan generation. |
| `id`, `user_id`, `created_at`, `updated_at` | System generated | No user input. |

## Goals, milestones, health phases

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `title`, `description`, `success_metric`, `deadline` | Goal wizard with AI-assisted structure | Efficient: ask for a rough goal, then let the user review structured output. |
| `domain`, `domain_category` | Page context or wizard selection | Infer whenever the entry point already establishes domain. |
| `status`, `completed_at`, `revision_count`, `abandoned_before_first_step`, `success_metric_specificity`, `created_by`, `plan_source` | Passive, derived, or system generated | Never ask the user. |
| `health_category`, `health_baseline`, `health_target`, `health_weight_dir`, `health_anchor_habit`, `health_anchor_time`, `health_why_important`, `health_why_now`, `health_what_lost` | Progressive health wizard | Efficient: show only fields relevant to the selected health category. |
| `health_unit`, `health_context_json` | Derived from the selected health category and wizard context | Never ask directly. |
| Milestone `title`, `description`, `target_date`, `day_marker` | AI suggestion with user review | Avoid asking users to author a complete roadmap from scratch. |
| Milestone `status`, `completed_at` | One compact action beside the milestone on the progress timeline | Efficient: capture achievement where the user already reviews progress, with an undo action for mistakes. |
| Health phase `phase_index`, `start_day`, `end_day`, `focus`, `task_templates`, `weigh_in` | Generated plan with review | Never ask as a raw form. |
| IDs, timestamps, sync flags | System generated | No user input. |

Change made: weight direction is inferred from baseline and target instead of being asked separately. Kilogram milestone inputs now appear only for weight goals, and health metric setup requires both a baseline and a target.

Change made: non-health goal categories selected in the wizard now persist with the goal instead of being used only during AI generation.

Change made: goals can now be marked complete and reopened directly from their card. This captures `status` and `completed_at` without adding a separate form.

## Daily steps and reflections

| Fields | Collection method | UX decision |
| --- | --- | --- |
| `title`, `description`, `estimated_minutes`, `difficulty`, `scheduled_date`, `generated_by_ai` | Generated plan with editable task management | Efficient: do not ask the user to repeatedly recreate daily steps. |
| `status` | Completed / partly / skipped buttons | Efficient and available inline. |
| `actual_minutes` | Optional quick chips after completion, with exact-value fallback | Efficient: ask at the moment of recall and allow skipping. |
| `blocker_category`, `blocker_reason` | Progressive chips after partial or skipped status | Efficient: ask only when relevant. |
| `reflection_text` | Optional note after a blocker or in the daily reflection | Efficient: free text remains optional. |
| `mood_score`, `energy_score` | Two sliders in the full daily reflection | Efficient: avoid asking on every task update. |
| `completed_at`, `rescheduled_from`, `reschedule_count`, `reattempt_same_day` | Passive capture from explicit task actions | Never ask the user. |
| `first_viewed_at`, `read_description`, `writing_duration_sec`, `reflection_word_count`, `self_blame_language` | Passive or derived capture when behavioral insights are enabled | Optional analytics; disable from settings without losing task or reflection features. |
| IDs, ownership, timestamps, sync flags | System generated | No user input. |

Change made: passive `first_viewed_at` and `read_description` updates are now accepted and persisted by the task-status API.

Change made: same-day reflection updates merge with prior answers instead of erasing mood, energy, or earlier notes.

Change made: blocker reason and optional reflection notes are stored on the relevant daily step as well as the merged daily reflection, using the single existing prompt.

Change made: remote sync now updates core task and reflection fields without replacing locally captured passive metrics with empty values.

Change made: the compact Daily Pulse now offers three estimated-duration chips after a completed task, plus skip. The full task view still supports an exact duration when needed.

## Insights, weekly reviews, and streaks

All fields in `ai_insights`, `weekly_reviews`, and `streaks` are generated from prior activity. They should remain read-only outputs. The user may correct source data, but should never fill in analytics manually.

`streaks` is currently a reserved snapshot table: the UI computes streaks from daily steps at read time. Add snapshot persistence only when reporting performance requires it.

Generated health phases replace prior phases on plan updates, milestone day markers are inferred during initial creation, and AI runtime metrics are returned when insights are read. These are passive data-quality fixes and add no user effort.

Repeated insight sync now preserves runtime metrics when the remote record omits them. Weekly review materialization uses the insight ID, so syncing the same generated review again updates the existing row instead of creating a duplicate.

## Follow-up product work

- Add a concise consent screen for sensitive emotional text analysis before production use.
- Add field-level event tests for check-in migration, ritual persistence, and passive task metrics.

Change made: settings now include a single opt-out for optional behavioral insights. Disabling it preserves core coaching inputs and explicit actions while stopping passive writing, editing, task-view, ritual-timing, and locally inferred text-pattern analytics.
