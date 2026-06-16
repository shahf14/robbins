/**
 * Step 19: Formulation LLM Eval Framework
 *
 * Utilities to evaluate LLM output quality for formulation prompts.
 * Import from probe scripts or run ad-hoc via:
 *   npx tsx scripts/formulation-eval-framework.ts
 *
 * Checks:
 * 1. Exploration questions: all first-person, no questions marks, unique themes
 * 2. Draft formulation: field separation (no duplication), suppressed themes absent
 * 3. Micro-goals: 5 options, correct types, no generic wellness goals
 */

import type {FormulationApproved, LlmExplorationQuestion} from '../src/lib/life-coach/types';
import type {MicroGoalOptionSuggestion} from '../src/lib/ai-formulation/prompts';

export type EvalResult = {
  passed: boolean;
  score: number; // 0-100
  checks: Array<{name: string; passed: boolean; detail?: string}>;
};

/* ── Exploration eval ─────────────────────────── */

export function evalExplorationQuestions(
  questions: LlmExplorationQuestion[],
  suppressedThemes: string[]
): EvalResult {
  const checks: EvalResult['checks'] = [];

  // Check count
  checks.push({
    name: 'count_15',
    passed: questions.length === 15,
    detail: `Got ${questions.length} questions`,
  });

  // Check no question marks
  const questionMarks = questions.filter((q) => q.text.includes('?'));
  checks.push({
    name: 'no_question_marks',
    passed: questionMarks.length === 0,
    detail: questionMarks.length > 0 ? `${questionMarks.length} have "?"` : undefined,
  });

  // Check first-person
  const firstPerson = questions.filter((q) =>
    /^(I |My |Me |אני |לי |שלי |קשה לי)/i.test(q.text.trim())
  );
  checks.push({
    name: 'first_person',
    passed: firstPerson.length >= 12,
    detail: `${firstPerson.length}/15 are first-person`,
  });

  // Check unique texts
  const unique = new Set(questions.map((q) => q.text.toLowerCase().trim()));
  checks.push({
    name: 'unique_texts',
    passed: unique.size === questions.length,
    detail: `${unique.size} unique out of ${questions.length}`,
  });

  // Check suppressed themes not present
  const suppressedFound = questions.filter((q) =>
    suppressedThemes.some((s) => q.text.toLowerCase().includes(s.toLowerCase()))
  );
  checks.push({
    name: 'suppressed_absent',
    passed: suppressedFound.length === 0,
    detail: suppressedFound.length > 0
      ? `${suppressedFound.length} mention suppressed themes`
      : undefined,
  });

  // Check min length
  const tooShort = questions.filter((q) => q.text.length < 15);
  checks.push({
    name: 'min_length',
    passed: tooShort.length === 0,
    detail: tooShort.length > 0 ? `${tooShort.length} are too short` : undefined,
  });

  const passed = checks.every((c) => c.passed);
  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  return {passed, score, checks};
}

/* ── Formulation eval ─────────────────────────── */

export function evalFormulationDraft(
  draft: FormulationApproved,
  suppressedThemes: string[]
): EvalResult {
  const checks: EvalResult['checks'] = [];

  // Check presenting concern exists
  checks.push({
    name: 'has_concern',
    passed: draft.presenting_concern_user_words.length >= 10,
    detail: `Concern length: ${draft.presenting_concern_user_words.length}`,
  });

  // Check stressors non-empty
  checks.push({
    name: 'has_stressors',
    passed: draft.stressors.length >= 1,
    detail: `${draft.stressors.length} stressors`,
  });

  // Check maintaining factors non-empty
  checks.push({
    name: 'has_maintaining',
    passed: draft.maintaining_factors.length >= 1,
    detail: `${draft.maintaining_factors.length} maintaining factors`,
  });

  // Check strengths non-empty
  checks.push({
    name: 'has_strengths',
    passed: draft.existing_strengths.length >= 1,
    detail: `${draft.existing_strengths.length} strengths`,
  });

  // Check uncertainties non-empty
  checks.push({
    name: 'has_uncertainties',
    passed: draft.uncertainties.length >= 1,
    detail: `${draft.uncertainties.length} uncertainties`,
  });

  // Check no field duplication (stressor also appearing in maintaining)
  const stressorSet = new Set(draft.stressors.map((s) => s.toLowerCase()));
  const duplicated = draft.maintaining_factors.filter((m) => stressorSet.has(m.toLowerCase()));
  checks.push({
    name: 'no_field_duplication',
    passed: duplicated.length === 0,
    detail: duplicated.length > 0 ? `${duplicated.length} duplicated across fields` : undefined,
  });

  // Check suppressed themes not in concern
  const allText = [draft.presenting_concern_user_words, ...draft.stressors].join(' ').toLowerCase();
  const suppressedPresent = suppressedThemes.filter((s) => allText.includes(s.toLowerCase()));
  checks.push({
    name: 'suppressed_absent',
    passed: suppressedPresent.length === 0,
    detail: suppressedPresent.length > 0
      ? `Suppressed themes found: ${suppressedPresent.join(', ')}`
      : undefined,
  });

  // Check no diagnostic labels
  const diagnosticPattern = /\b(depression|anxiety disorder|ADHD|PTSD|OCD|bipolar|דיכאון|הפרעת)\b/i;
  checks.push({
    name: 'no_diagnostic_labels',
    passed: !diagnosticPattern.test(allText),
  });

  const passed = checks.every((c) => c.passed);
  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  return {passed, score, checks};
}

/* ── Micro-goal eval ─────────────────────────── */

export function evalMicroGoalOptions(
  options: MicroGoalOptionSuggestion[],
  burningFocus: string,
  suppressedThemes: string[]
): EvalResult {
  const checks: EvalResult['checks'] = [];

  // Check count
  checks.push({
    name: 'count_5',
    passed: options.length === 5,
    detail: `Got ${options.length} options`,
  });

  // Check type order: practical, mindset, freestyle, freestyle, freestyle
  const expectedTypes = ['practical', 'mindset', 'freestyle', 'freestyle', 'freestyle'];
  const typesMatch = options.every((o, i) => o.goal_type === expectedTypes[i]);
  checks.push({
    name: 'type_order',
    passed: typesMatch,
    detail: typesMatch ? undefined : `Types: ${options.map((o) => o.goal_type).join(', ')}`,
  });

  // Check unique titles
  const titles = new Set(options.map((o) => o.title.toLowerCase()));
  checks.push({
    name: 'unique_titles',
    passed: titles.size === options.length,
  });

  // Check micro_goal_week min length
  const shortGoals = options.filter((o) => o.micro_goal_week.length < 8);
  checks.push({
    name: 'goal_min_length',
    passed: shortGoals.length === 0,
    detail: shortGoals.length > 0 ? `${shortGoals.length} goals too short` : undefined,
  });

  // Check no generic wellness
  const genericPattern = /\b(meditat|נשימ|breath|before bed|לפני השינה)\b/i;
  const generic = options.filter((o) => genericPattern.test(o.micro_goal_week));
  checks.push({
    name: 'no_generic_wellness',
    passed: generic.length === 0,
    detail: generic.length > 0 ? `${generic.length} are generic wellness` : undefined,
  });

  // Check suppressed themes absent
  const allGoalText = options.map((o) => o.title + ' ' + o.micro_goal_week).join(' ').toLowerCase();
  const suppressedPresent = suppressedThemes.filter((s) => allGoalText.includes(s.toLowerCase()));
  checks.push({
    name: 'suppressed_absent',
    passed: suppressedPresent.length === 0,
  });

  const passed = checks.every((c) => c.passed);
  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  return {passed, score, checks};
}
