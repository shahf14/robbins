import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {
  buildFormulationSessionContext,
  buildMicroGoalWizardContext,
  buildSlimFormulationContext,
} from '@/lib/formulation/session-context';
import type {CoachHandoff, FormulationApproved, FormulationDimensions, FormulationSession} from '@/lib/life-coach/types';

/* ── Prompt versions (Step 18) ─────────────────────────── */

export const PROMPT_VERSIONS = {
  exploration: 'v2',
  formulation: 'v2',
  microGoal: 'v2',
} as const;

/* ── Base rules ────────────────────────────────────────── */

const languageInstruction: Record<AppLocale, string> = {
  en: 'Respond in native English. Use the user\'s own words in reflections.',
  he: 'הגב בעברית טבעית. בשיקוף (reflection) השתמש במילים של המשתמש — אל תרפא ואל תתייג.',
};

const baseRules = [
  'You are a collaborative clarification assistant — NOT a therapist, NOT diagnosing.',
  'Never assign diagnostic labels (depression, ADHD, PTSD, etc.).',
  'Never give medication, legal, or relationship advice.',
  'Never interpret family history or trauma causes.',
  'Use language of difficulty, barrier, need — not disorder or problem.',
  'Return only valid JSON when JSON is requested.',
];

/* ── Step 5: Exploration questions ─────────────────────── */

export function buildGenerateExplorationQuestionsSystemPrompt(locale: AppLocale) {
  const likertRules =
    locale === 'he'
      ? [
          'פורמט חובה: כל `text` הוא משפט הצהרה בגוף ראשון (אני / לי / שלי) — לא שאלה.',
          'המשתמש ידרג 1=לא מסכים … 5=מסכים בהחלט — כמו שלב 3. אסור סימן שאלה (?).',
          'אסור: "איך… משפיע", "מה…", "למה…", "האם…", "תאר/י", "ספר/י".',
          'אסור מילים באנגלית, מזהי מערכת (sleep_quality), או slug עם קו תחתון בתוך הטקסט.',
          'השתמש רק בניסוח עברי חלק מתוך synthesis.burning_now_themes ו-life_context — לא מ-ids.',
          'אם synthesis.suppressed_by_chips לא ריק — אל תבנה משפטים על נושאים שם.',
          'דוגמה לא טובה: "איך הלחץ הכלכלי בזמן המעבר בין עבודות משפיע על התחושה הכללית שלך?"',
          'דוגמה טובה: "הלחץ הכלכלי בזמן המעבר מרגיש כבד עליי השבוע"',
          'דוגמה טובה: "קשה לי לשמור על שגרה כשהעתיד התעסוקתי לא ברור"',
        ]
      : [
          'Required format: each `text` is a first-person declarative statement (I / my / me) — NOT a question.',
          'User will rate 1=disagree … 5=agree strongly — same as step 3. No question marks (?).',
          'Forbidden: "How does… affect", "What…", "Why…", "Do you…", "Explain", "Describe".',
          'Bad example: "How does financial pressure during your job transition affect how you feel overall?"',
          'Good example: "Financial pressure during this transition feels heavy on me this week"',
          'Good example: "It is hard for me to keep a routine when my work future feels unclear"',
        ];

  return [
    ...baseRules,
    languageInstruction[locale],
    'Task: generate exactly 15 NEW Likert statements for step 5 — a fresh angle on everything collected so far.',
    'Input includes passive_ratings (step 3), chip_follow_ups (step 4 flare filter), synthesis.burning_now_themes, synthesis.suppressed_by_chips.',
    'Do NOT repeat or lightly rephrase any passive_ratings[].label — those were already scored.',
    'Honor synthesis.chip_filter_rule: themes in suppressed_by_chips must NOT appear in new statements.',
    'Synthesize cross-themes from burning_now_themes + exploration gaps (guilt, comparison, avoidance, hope).',
    'Each statement adds a distinct lens: hidden cost, guilt, control, avoidance, comparison, loneliness, self-criticism, boundaries, hope, small wins, identity, body tension, etc.',
    ...likertRules,
    'One idea per statement. Max ~140 characters. Not diagnostic, not advice.',
    'Return JSON only: { "questions": [ { "id": "q01".."q15", "text": "...", "focus_area": "short tag" } ] }',
    'Ids must be exactly q01 through q15 in order.',
  ].join('\n');
}

export function buildGenerateExplorationQuestionsUserPrompt(
  session: FormulationSession,
  locale: AppLocale
) {
  // Step 4 & 13: Send slim context — only what the LLM needs
  const full = buildFormulationSessionContext(session, locale);
  return JSON.stringify({
    locale,
    synthesis: {
      burning_now_themes: full.synthesis.burning_now_themes,
      suppressed_by_chips: full.synthesis.suppressed_by_chips,
      chip_filter_rule: full.synthesis.chip_filter_rule,
    },
    passive_ratings: full.passive_ratings,
    chip_follow_ups: full.chip_follow_ups,
    do_not_repeat_these_step3_statements: full.do_not_repeat_these_step3_statements,
    profile: full.profile,
    concern_summary: full.concern_summary,
  }, null, 2);
}

/* ── Step 6: Draft formulation (Step 9: simplified with few-shot) ── */

const FORMULATION_RULES: Record<AppLocale, string[]> = {
  he: [
    '[כללי סינתזה]',
    '1. סינון צ\'יפים: נושא נכנס ל-suppressed_by_chips רק אם נשאל בשלב 4 והמשתמש בחר "בכלל לא". נושא גבוה בשלב 3 שלא נשאל בשלב 4 — נשאר תקף.',
    '2. קוטביות: אם polarity=positive וציון 1-2, השתמש ב-difficulty_label (לא label הגולמי).',
    '3. הפרדת שדות — אסור שכפול:',
    '   presenting_concern_user_words = חוויית הקושי הנוכחית (1-2 משפטים).',
    '   stressors = מה מצית עכשיו (מ-exploration_ratings גבוהים). לא לחזור על נושאי הליבה.',
    '   maintaining_factors = מה מחזיק לאורך זמן (הימנעות, אשמה, דאגות עתיד).',
    '   existing_strengths = משאבים (מ-exploration_ratings גבוהים על ערכים/תקווה).',
    '4. אסור להתמקד בשינה אם היא ב-suppressed_by_chips או חסרה מ-burning_now_themes.',
    '5. שיקוף חייב לשקף burning_now_themes בלבד — לא suppressed.',
  ],
  en: [
    '[Synthesis rules]',
    '1. Chip filter: a theme is suppressed ONLY if asked in Phase 4 and user chose "not at all". Phase 3 themes not asked in Phase 4 remain valid.',
    '2. Polarity: if polarity=positive and score 1-2, use difficulty_label (not raw label).',
    '3. Field separation — no duplication:',
    '   presenting_concern_user_words = current lived difficulty (1-2 sentences).',
    '   stressors = what ignites now (from high exploration_ratings). Do not repeat core topics.',
    '   maintaining_factors = what keeps it going (avoidance, guilt, future worry).',
    '   existing_strengths = resources (from high exploration on values/hope).',
    '4. Never center sleep if suppressed_by_chips or absent from burning_now_themes.',
    '5. Reflection must reflect burning_now_themes only — not suppressed.',
  ],
};

const FORMULATION_FEW_SHOT: Record<AppLocale, string> = {
  he: `
דוגמה לקלט מצומצם:
burning_now_themes: ["חוסר אנרגיה ומותשות", "עומס תפקידים כמפרנס"]
suppressed_by_chips: ["קושי בשינה"]
exploration_high: ["אני משווה את עצמי לאחרים (5)", "קשה לי לבקש עזרה (4)"]

דוגמה לפלט נכון:
{
  "formulation": {
    "presenting_concern_user_words": "תחושת מותשות ועומס סביב התפקיד כמפרנס — קשה להרגיש שמספיק",
    "intensity_0_10": 7,
    "contexts": ["מנהל / עומס בעבודה"],
    "stressors": ["השוואה חברתית שמעמיקה תחושת כישלון", "קושי לבקש עזרה כשצריך"],
    "maintaining_factors": ["הימנעות מלהתעמת עם עומס", "ביקורת עצמית חוזרת"],
    "existing_strengths": ["מודעות לכך שמשהו צריך להשתנות", "ערכים ברורים"],
    "uncertainties": ["לא ברור אם העייפות פיזית או רגשית"],
    "risk_screen": {"level": "none", "action": "continue"}
  }
}
שים לב: שינה לא מופיעה כי היא ב-suppressed_by_chips.`.trim(),
  en: `
Example condensed input:
burning_now_themes: ["Low energy and fatigue", "Provider role overload"]
suppressed_by_chips: ["Sleep difficulty"]
exploration_high: ["I compare myself to others (5)", "It is hard for me to ask for help (4)"]

Example correct output:
{
  "formulation": {
    "presenting_concern_user_words": "Exhaustion and overload around the provider role — hard to feel like enough",
    "intensity_0_10": 7,
    "contexts": ["Manager / work overload"],
    "stressors": ["Social comparison deepening sense of failure", "Difficulty asking for help when needed"],
    "maintaining_factors": ["Avoidance of confronting overload", "Recurring self-criticism"],
    "existing_strengths": ["Awareness that something needs to change", "Clear values"],
    "uncertainties": ["Unclear whether fatigue is physical or emotional"],
    "risk_screen": {"level": "none", "action": "continue"}
  }
}
Note: sleep not mentioned because it is in suppressed_by_chips.`.trim(),
};

export function buildDraftFormulationSystemPrompt(locale: AppLocale) {
  const formulationLanguage =
    locale === 'he' ? 'הגב בעברית טבעית וזורמת.' : 'Respond in natural, flowing English.';

  return [
    ...baseRules,
    formulationLanguage,
    'Task: produce a collaborative formulation JSON from the wizard dataset.',
    'Required output: { "formulation": { presenting_concern_user_words, intensity_0_10, contexts, stressors, maintaining_factors, existing_strengths, uncertainties (>=1), risk_screen {level, action} } }',
    ...FORMULATION_RULES[locale],
    '',
    FORMULATION_FEW_SHOT[locale],
  ].join('\n');
}

export function buildDraftFormulationUserPrompt(input: {
  locale: AppLocale;
  session: FormulationSession;
}) {
  // Step 4 & 13: Slim context — only what the LLM needs for formulation
  return JSON.stringify(
    buildSlimFormulationContext(input.session, input.locale),
    null,
    2
  );
}

/* ── Step 7: Micro-goal ────────────────────────────────── */

export function buildMicroGoalSystemPrompt(locale: AppLocale) {
  const analysis =
    locale === 'he'
      ? [
          '[משימה: 5 יעדים דינמיים מניתוח מלא]',
          'קרא את wizard_snapshot — כל מה שנאסף.',
          'שלב 1: קבע burning_focus — משפט אחד: מה הכי בוער השבוע.',
          'שלב 2: צור בדיוק 5 goal_options:',
          '  (1) goal_type=practical — פעולה פרקטית שמפחיתה את burning_focus (ראה goal_alignment.practical_must_reduce).',
          '  (2) goal_type=mindset — עובד על maintaining_factors (goal_alignment.mindset_must_address), לא על burning_focus.',
          '  השתמש ב-mindset_exercise_recommendation.recommended_exercise — בסיס ליעד המיינדסט.',
          '  חובה: why_this_exercise ב-goal_option של mindset (מהחסם שהוא מפחית).',
          '  (3-5) goal_type=freestyle — שלושה יעדים לשיחה: uncertainties + secondary_goal_themes (goal_alignment.freestyle_open_on).',
          'סדר: practical, mindset, freestyle, freestyle, freestyle.',
          'אסור יעדי wellness גנריים (מדיטציה, שינה, נשימות) אלא אם שינה ב-burning_now_themes ולא ב-suppressed.',
          'אסור לחזור על נושאים ב-suppressed_do_not_center / goal_alignment.suppressed_do_not_center — גם אם דירוג שלב 3 גבוה.',
          'התאם קצב וגודל יעד ל-emotional_stage.content_profile: growth_focus=stretch קטן; regulation_clarity=צעדים קטנים; gentle_safety=רך ובטוח.',
          'אם emotional_stage.clarity_over_action — העדף יעדים שמבהירים, לא פעולה קשה.',
          'אם emotional_stage.strengths_signal=strong — practical/mindset יכולים להפעיל existing_strengths.',
          'אם personalized_challenge קיים — goal_options חייבים לעמוד ב-daily_minimum / success_definition (לא "7 ימים" גנרי).',
          'כל goal_option: id, goal_type, title, value, micro_goal_week, anticipated_barrier, plan_b.',
          'goal_type=mindset: גם why_this_exercise (משפט קצר — איזה חסם התרגיל מפחית).',
          'title: ניסוח טבעי — אסור להופיע "פרקטי", "מיינדסט", "פרייסטייל".',
          'שדות שורש = העתק מה-practical.',
        ]
      : [
          '[TASK: 5 dynamic goals from full analysis]',
          'Read wizard_snapshot — everything collected.',
          'Step 1: Set burning_focus — one sentence for what burns most this week.',
          'Step 2: Create exactly 5 goal_options:',
          '  (1) goal_type=practical — concrete action that reduces burning_focus (see goal_alignment.practical_must_reduce).',
          '  (2) goal_type=mindset — addresses maintaining_factors (goal_alignment.mindset_must_address), not burning_focus directly.',
          '  Use mindset_exercise_recommendation.recommended_exercise as the basis for the mindset goal.',
          '  REQUIRED: why_this_exercise on the mindset goal_option (which blocker it reduces).',
          '  (3-5) goal_type=freestyle — three coach/chat goals from uncertainties + secondary_goal_themes (goal_alignment.freestyle_open_on).',
          'Array order: practical, mindset, freestyle, freestyle, freestyle.',
          'No generic wellness goals unless sleep is in burning_now_themes and not suppressed.',
          'Never center themes in suppressed_do_not_center / goal_alignment.suppressed_do_not_center — even if Phase-3 rating was high.',
          'Match goal pace to emotional_stage.content_profile: growth_focus=small stretch; regulation_clarity=tiny steps; gentle_safety=soft and safe.',
          'If emotional_stage.clarity_over_action — prefer clarifying goals, not hard action.',
          'If emotional_stage.strengths_signal=strong — practical/mindset may activate existing_strengths.',
          'If personalized_challenge exists — goal_options must honor daily_minimum / success_definition (no generic "7 days").',
          'Each goal_option: id, goal_type, title, value, micro_goal_week, anticipated_barrier, plan_b.',
          'goal_type=mindset: also why_this_exercise (short sentence — which blocker the exercise reduces).',
          'title: natural user-facing wording — never include "practical", "mindset", "freestyle".',
          'Root fields = copy from the practical option.',
        ];

  return [
    ...baseRules,
    languageInstruction[locale],
    'Return ONLY valid JSON (no markdown). goal_options MUST be an array of exactly 5 objects in order.',
    'Write ALL user-facing text in fresh wording from THIS user data — never copy canned templates.',
    'Small and kind — not personality change. Every goal must clearly ease instruction.anchor_burning_now.',
    ...analysis,
  ].join('\n');
}

// Step 10: Better retry strategy — include what went wrong
export function buildMicroGoalRetryHint(locale: AppLocale, attempt: number): string {
  if (attempt === 0) return '';
  if (locale === 'he') {
    const hints = [
      '',
      '\n\n[ניסיון 2] הניסיון הקודם נכשל. ודא: practical מקושר ל-burning_focus; mindset ל-maintaining_factors; freestyle ל-uncertainties; אין נושאים מ-suppressed_by_chips. JSON תקין.',
      '\n\n[ניסיון 3 — אחרון] בדוק goal_alignment.slot_rules: practical→burning_focus, mindset→maintaining, freestyle→uncertainties, אסור suppressed. JSON בלבד.',
    ];
    return hints[attempt] ?? '';
  }
  const hints = [
    '',
    '\n\n[Attempt 2] Previous attempt failed. Ensure: practical ties to burning_focus; mindset to maintaining_factors; freestyle to uncertainties; no suppressed_by_chips themes. Valid JSON only.',
    '\n\n[Attempt 3 — final] Check goal_alignment.slot_rules: practical→burning_focus, mindset→maintaining, freestyle→uncertainties, no suppressed themes. JSON only.',
  ];
  return hints[attempt] ?? '';
}

export function buildMicroGoalUserPrompt(session: FormulationSession, locale: AppLocale) {
  return JSON.stringify(buildMicroGoalWizardContext(session, locale), null, 2);
}

export type MicroGoalOptionSuggestion = {
  id: string;
  goal_type: 'practical' | 'mindset' | 'freestyle';
  title: string;
  value: string;
  micro_goal_week: string;
  anticipated_barrier: string;
  plan_b: string;
  why_this_exercise?: string;
  mindset_exercise_id?: string;
};

export type MicroGoalSuggestion = Partial<CoachHandoff> & {
  burning_focus?: string;
  goal_options?: MicroGoalOptionSuggestion[];
  generated_by?: 'llm';
};
