import type {AppLocale} from '@/i18n/config';
import {
  buildLifeContextAdaptationHint,
  lifeContextForPrompt,
} from '@/lib/life-context-labels';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {difficultyLabelFromRating} from '@/lib/formulation/rating-difficulty-label';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import {deriveDomainFromHandoff} from '@/lib/morning-ritual/goal-context';
import type {
  FormulationSession,
  LifeContextStatus,
  LifeDomain,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';

const STOP_WORDS =
  /^(של|עם|את|על|זה|מה|איך|לא|גם|כי|the|and|for|with|that|this|from|your|you|are|was|were|have|has)$/i;

const TIME_ENERGY_STRESSOR =
  /זמן|אנרג|עייפ|שינה|time|energy|tired|fatigue|sleep|exhaust|overload|עומס|לחץ|pressure|deadline/i;

const TIME_ENERGY_STEP =
  /\b(2\s*min|3\s*min|5\s*min|דק|דקות|minute|break|פסק|בוקר|evening|morning|before bed|לפני שינה|קצר|short|quick)\b/i;

const STATUS_KEYWORDS: Record<LifeContextStatus, RegExp[]> = {
  student: [/student|סטודנט|לימוד|exam|מבחן|study|class|שיעור/i],
  new_parent: [/parent|הורה|תינוק|baby|infant|שינה מקוטע|breast|feed|הנק/i],
  manager: [/manager|מנהל|work|עבוד|meeting|ישיב|deadline|צוות|team/i],
  caregiver: [/caregiver|מטפל|care|טיפול|patient|מטופל/i],
  between_jobs: [/between.?jobs|בין.?עבוד|transition|מעבר|job search|חיפוש/i],
  other: [],
  prefer_not: [],
};

type RealLifeAlignmentDimension =
  | 'life_context'
  | 'time_energy'
  | 'central_difficulty'
  | 'weekly_goal'
  | 'personal_value';

export type RealLifeAlignmentContext = {
  locale: AppLocale;
  life_context_statuses: LifeContextStatus[];
  life_context_labels: string[];
  contexts: string[];
  stressors: string[];
  presenting_concern: string | null;
  participant_age: number | null;
  participant_gender: string | null;
  value: string | null;
  micro_goal_week: string | null;
  primary_goal_focus: string | null;
  suggested_domain: LifeDomain | null;
  central_difficulty: string | null;
  time_energy_signals: string[];
  dimension_anchors: Record<RealLifeAlignmentDimension, string[]>;
};

export type RealLifeAlignmentResult = {
  passed: boolean;
  matched: RealLifeAlignmentDimension[];
};

export const REAL_LIFE_ALIGNMENT_PROMPT_BLOCK = [
  '## Real-life alignment gate (REQUIRED — reject disconnected steps):',
  'Each step MUST include at least ONE explicit tie to the user\'s clarification data in title, description, or reasoning.',
  'Valid tie dimensions (need ≥1):',
  '1. life_context — parent/student/manager/caregiver/job transition or their stated contexts.',
  '2. time_energy — their time/energy constraint (short break, low energy, fragmented sleep, exam week).',
  '3. central_difficulty — presenting concern, stressor, or main barrier they named.',
  '4. weekly_goal — micro_goal_week or primary_goal_focus.',
  '5. personal_value — the value phrase from handoff.',
  'If a step could apply to anyone with no link to real_life_alignment payload → REJECT and replace.',
  'WEAK (reject): "Take a 10-minute walk." with no link to their week, role, or pain.',
  'STRONG (pass): "2 min before the meeting: write one line you will say to your manager about the deadline." / "2 דק׳ לפני הישיבה: כתוב משפט אחד שתגיד למנהל על הדדליין."',
].join('\n');

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function significantTokens(text: string, minLen = 3): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,.;:·\-–—/|()]+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter((w) => w.length >= minLen && !STOP_WORDS.test(w))
    ),
  ];
}

function overlapCount(blob: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  return tokens.filter((token) => blob.includes(normalizeText(token))).length;
}

function textMatchesAnchor(blob: string, anchor: string | null | undefined): boolean {
  const trimmed = anchor?.trim();
  if (!trimmed) return false;
  const normalizedBlob = normalizeText(blob);
  const normalizedAnchor = normalizeText(trimmed);
  if (normalizedAnchor.length >= 8 && normalizedBlob.includes(normalizedAnchor)) return true;
  const tokens = significantTokens(trimmed, trimmed.length <= 12 ? 2 : 3);
  if (tokens.length === 0) return false;
  const hits = overlapCount(normalizedBlob, tokens);
  if (tokens.length <= 2) return hits >= 1;
  return hits >= 2 || hits / tokens.length >= 0.34;
}

function matchesAny(blob: string, anchors: string[]): boolean {
  return anchors.some((anchor) => textMatchesAnchor(blob, anchor));
}

function ratingScore(session: FormulationSession, key: string, fallback = 3): number {
  return session.passive_ratings.find((r) => r.key === key)?.score ?? fallback;
}

function buildTimeEnergySignals(session: FormulationSession, locale: AppLocale): string[] {
  const signals: string[] = [];
  const ratingKeys = [
    'day_energy',
    'motivation',
    'sleep_quality',
    'focus',
    'worry_load',
    'work_pressure',
  ] as const;

  for (const key of ratingKeys) {
    const score = ratingScore(session, key);
    if (distressWeight(key, score) >= 3) {
      signals.push(difficultyLabelFromRating(key, score, locale));
    }
  }

  for (const stressor of session.formulation_approved?.stressors ?? []) {
    if (TIME_ENERGY_STRESSOR.test(stressor)) {
      signals.push(stressor.trim());
    }
  }

  const adaptation = buildLifeContextAdaptationHint(session.life_context_statuses, locale);
  if (adaptation) {
    signals.push(
      ...adaptation
        .split('\n')
        .slice(1)
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter(Boolean)
    );
  }

  return [...new Set(signals.map((s) => clip(s, 120)).filter(Boolean))].slice(0, 6);
}

function matchesLifeContext(blob: string, ctx: RealLifeAlignmentContext): boolean {
  if (matchesAny(blob, ctx.contexts)) return true;
  if (matchesAny(blob, ctx.life_context_labels)) return true;

  for (const status of ctx.life_context_statuses) {
    if (status === 'prefer_not' || status === 'other') continue;
    if (STATUS_KEYWORDS[status].some((pattern) => pattern.test(blob))) return true;
  }

  return false;
}

function matchesTimeEnergy(blob: string, ctx: RealLifeAlignmentContext): boolean {
  if (matchesAny(blob, ctx.time_energy_signals)) return true;
  if (
    ctx.time_energy_signals.length > 0 &&
    TIME_ENERGY_STEP.test(blob) &&
    /\b(energy|אנרג|time|זמן|עייפ|tired|short|קצר|דק)\b/i.test(blob)
  ) {
    return true;
  }
  return false;
}

function stepBlob(step: StructuredDailyBabyStep): string {
  return normalizeText(
    [
      step.title,
      step.description,
      step.reasoning ?? '',
      step.pain_addressed ?? '',
      step.expected_resistance ?? '',
    ].join(' ')
  );
}

export function buildRealLifeAlignmentContext(
  session: FormulationSession,
  locale: AppLocale
): RealLifeAlignmentContext | null {
  const approved = session.formulation_approved;
  const handoff = session.coach_handoff;
  const insights = buildFormulationInsights(session, locale);
  const lifeContext = lifeContextForPrompt(session.life_context_statuses, locale);

  const presenting =
    approved?.presenting_concern_user_words?.trim() ||
    session.presenting_concern_user_words?.trim() ||
    null;

  const central_difficulty =
    handoff?.anticipated_barrier?.trim() ||
    presenting ||
    insights.burning_now_themes[0]?.label ||
    insights.primary_goal_focus ||
    null;

  const dimension_anchors: Record<RealLifeAlignmentDimension, string[]> = {
    life_context: [
      ...lifeContext.labels,
      ...(approved?.contexts ?? []).filter(Boolean),
    ],
    time_energy: buildTimeEnergySignals(session, locale),
    central_difficulty: [
      presenting,
      central_difficulty,
      ...(approved?.stressors ?? []).filter(Boolean),
      ...(approved?.maintaining_factors ?? []).filter(Boolean).slice(0, 3),
    ].filter((v): v is string => !!v?.trim()),
    weekly_goal: [
      handoff?.micro_goal_week?.trim(),
      insights.primary_goal_focus,
    ].filter((v): v is string => !!v?.trim()),
    personal_value: handoff?.value?.trim() ? [handoff.value.trim()] : [],
  };

  const totalAnchors = Object.values(dimension_anchors).flat().length;
  if (totalAnchors === 0) return null;

  return {
    locale,
    life_context_statuses: lifeContext.statuses,
    life_context_labels: lifeContext.labels,
    contexts: (approved?.contexts ?? []).filter(Boolean).slice(0, 6),
    stressors: (approved?.stressors ?? []).filter(Boolean).slice(0, 5),
    presenting_concern: presenting,
    participant_age: session.participant_age,
    participant_gender: session.participant_gender,
    value: handoff?.value?.trim() || null,
    micro_goal_week: handoff?.micro_goal_week?.trim() || null,
    primary_goal_focus: insights.primary_goal_focus || null,
    suggested_domain: deriveDomainFromHandoff(handoff?.suggested_domain),
    central_difficulty: central_difficulty ? clip(central_difficulty, 120) : null,
    time_energy_signals: dimension_anchors.time_energy,
    dimension_anchors,
  };
}

export function evaluateRealLifeAlignment(
  step: StructuredDailyBabyStep,
  ctx: RealLifeAlignmentContext | null | undefined
): RealLifeAlignmentResult {
  if (!ctx) return {passed: true, matched: []};

  const blob = stepBlob(step);
  const matched: RealLifeAlignmentDimension[] = [];

  if (matchesLifeContext(blob, ctx)) matched.push('life_context');
  if (matchesTimeEnergy(blob, ctx)) matched.push('time_energy');
  if (matchesAny(blob, ctx.dimension_anchors.central_difficulty)) {
    matched.push('central_difficulty');
  }
  if (matchesAny(blob, ctx.dimension_anchors.weekly_goal)) matched.push('weekly_goal');
  if (matchesAny(blob, ctx.dimension_anchors.personal_value)) matched.push('personal_value');

  if (
    ctx.suggested_domain &&
    step.domain === ctx.suggested_domain &&
    matched.length === 0 &&
    matchesAny(blob, [
      ...ctx.dimension_anchors.weekly_goal,
      ...ctx.dimension_anchors.personal_value,
      ctx.central_difficulty ?? '',
    ])
  ) {
    matched.push('weekly_goal');
  }

  return {passed: matched.length > 0, matched};
}

export function realLifeAlignmentForPrompt(
  ctx: RealLifeAlignmentContext | null
): Record<string, unknown> | null {
  if (!ctx) return null;

  return {
    life_context_statuses: ctx.life_context_statuses,
    life_context_labels: ctx.life_context_labels,
    contexts: ctx.contexts,
    stressors: ctx.stressors,
    presenting_concern: ctx.presenting_concern,
    participant_age: ctx.participant_age,
    participant_gender: ctx.participant_gender,
    value: ctx.value,
    micro_goal_week: ctx.micro_goal_week,
    primary_goal_focus: ctx.primary_goal_focus,
    suggested_domain: ctx.suggested_domain,
    central_difficulty: ctx.central_difficulty,
    time_energy_signals: ctx.time_energy_signals,
    required_rule:
      ctx.locale === 'he'
        ? 'כל צעד חייב לכלול לפחות התאמה אחת מהממדים למעלה — אחרת לא עובר.'
        : 'Each step must include at least one tie to the dimensions above — otherwise reject.',
  };
}

function pickRepairAnchor(ctx: RealLifeAlignmentContext): string {
  return (
    ctx.micro_goal_week ??
    ctx.value ??
    ctx.presenting_concern ??
    ctx.central_difficulty ??
    ctx.life_context_labels[0] ??
    ctx.contexts[0] ??
    (ctx.locale === 'he' ? 'מה שנראה משמעותי אצלך כרגע' : 'what looks significant for you right now')
  );
}

export function applyRealLifeAlignmentRepair(
  step: StructuredDailyBabyStep,
  ctx: RealLifeAlignmentContext
): StructuredDailyBabyStep {
  const he = ctx.locale === 'he';
  const anchor = clip(pickRepairAnchor(ctx), 72);
  const lifeLabel = ctx.life_context_labels[0];

  const contextPrefix = lifeLabel
    ? he
      ? `בהקשר של ${lifeLabel}, קשור ל"${anchor}": `
      : `As ${lifeLabel}, tied to "${anchor}": `
    : he
      ? `קשור ל"${anchor}": `
      : `Tied to "${anchor}": `;

  const reasoning =
    step.reasoning?.trim() ||
    (he
      ? `נבחר כי זה מתחבר ל${anchor} — לא צעד גנרי.`
      : `Chosen because it connects to ${anchor} — not a generic step.`);

  return {
    ...step,
    description: clip(`${contextPrefix}${step.description}`, 480),
    reasoning: clip(reasoning, 220),
    pain_addressed:
      step.pain_addressed ??
      (he
        ? `מקשר את הצעד ל${anchor} כדי שירגיש רלוונטי לחיים האמיתיים`
        : `Links the step to ${anchor} so it feels relevant to real life`),
  };
}
