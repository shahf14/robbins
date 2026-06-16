/**
 * Smoke test: chip filter (per-source), polarity labels, reflection sync.
 * Run: npx --yes tsx scripts/probe-chip-synthesis.ts
 */
import {
  buildFormulationInsights,
  buildReflectionFromInsights,
  syncSessionNarrativeFromInsights,
} from '../src/lib/formulation/formulation-insights';
import {getRatingFollowUps} from '../src/lib/formulation/passive-ratings';
import type {FormulationSession} from '../src/lib/life-coach/types';

const ratings = [
  {key: 'male_provider_pressure_between_jobs', score: 5},
  {key: 'worry_load', score: 5},
  {key: 'transition_instability', score: 5},
  {key: 'day_energy', score: 2},
  {key: 'self_criticism', score: 4},
  {key: 'body_tension', score: 4},
];

const followUps = getRatingFollowUps(ratings, ['between_jobs', 'new_parent']);

const session = {
  id: 'probe-chip',
  user_id: 'u',
  locale: 'he',
  status: 'draft',
  current_phase: 'dimensions',
  life_context_statuses: ['between_jobs', 'new_parent'],
  life_context_status_note: null,
  participant_gender: 'male',
  participant_age: 35,
  passive_ratings: ratings,
  rating_follow_ups: followUps,
  // כמו במשתמש: רק דאגות + מעבר (לא פרנסה) — לפי מפתחות follow-up בפועל
  prior_question_answers: [
    {key: 'worry_load', answer: 'not_at_all'},
    {key: 'transition_instability', answer: 'not_at_all'},
  ].filter((a) => followUps.some((f) => f.key === a.key)),
  llm_exploration_questions: [],
  llm_exploration_answers: [],
  presenting_concern_user_words: null,
  presenting_concern_raw: null,
  reflection_llm_text: null,
} as unknown as FormulationSession;

syncSessionNarrativeFromInsights(session);
const insights = buildFormulationInsights(session, 'he');

const providerId = 'male_provider_pressure_between_jobs';
const suppressedIds = new Set(insights.suppressed_by_chips.map((s) => s.id));
const burningIds = new Set(insights.burning_now_themes.map((t) => t.id));
const reflection = buildReflectionFromInsights(insights, 'he');

const checks: Array<{name: string; ok: boolean; detail: string}> = [
  {
    name: 'פרנסה לא בסונן (לא נשאל בצ\'יפ)',
    ok: !suppressedIds.has(providerId),
    detail: suppressedIds.has(providerId)
      ? 'ERROR: provider in suppressed_by_chips'
      : 'OK',
  },
  {
    name: 'דאגות כן בסונן (נשאל בצ\'יפ)',
    ok: suppressedIds.has('worry_load'),
    detail: `suppressed: ${[...suppressedIds].join(', ')}`,
  },
  {
    name: 'מעבר לא בסונן אם רק פרנסה/הקשר נשאלו (לא instability)',
    ok: !suppressedIds.has('transition_instability') || burningIds.has('transition_instability'),
    detail: `transition suppressed=${suppressedIds.has('transition_instability')}`,
  },
  {
    name: 'פרנסה עדיין בוער (ציון 5)',
    ok: burningIds.has(providerId),
    detail: `burning: ${[...burningIds].join(', ')}`,
  },
  {
    name: 'אנרגיה בניסוח שלילי (לא "יש לי מספיק")',
    ok: !insights.primary_goal_focus.includes('יש לי מספיק') &&
      !insights.one_line_concern.includes('יש לי מספיק'),
    detail: `primary: ${insights.primary_goal_focus}`,
  },
  {
    name: 'שיקוף ללא דאגות שסוננו (פרנסה יכולה להישאר אם בוערת)',
    ok: !reflection.includes('דאגות') && reflection.includes('בוער'),
    detail: reflection,
  },
];

console.log('\n=== probe-chip-synthesis (he) ===\n');
console.log('Follow-ups:', followUps.map((f) => ({key: f.key, source: f.source_rating_key})));
console.log('\n--- insights ---');
console.log('suppressed_by_chips:', insights.suppressed_by_chips);
console.log('burning_now_themes:', insights.burning_now_themes.map((t) => t.label));
console.log('primary_goal_focus:', insights.primary_goal_focus);
console.log('one_line_concern:', insights.one_line_concern);
console.log('reflection:', session.reflection_llm_text);

let failed = 0;
for (const c of checks) {
  const mark = c.ok ? 'PASS' : 'FAIL';
  if (!c.ok) failed++;
  console.log(`\n[${mark}] ${c.name}`);
  console.log(`  ${c.detail}`);
}

console.log(`\n${failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
