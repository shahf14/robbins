import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {deriveDomainFromHandoff} from '@/lib/morning-ritual/goal-context';
import {filterStepsInPeriod} from '@/lib/life-coach/weekly-review-emotional';
import type {
  DailyBabyStep,
  DailyReflection,
  LifeDomain,
} from '@/lib/life-coach/types';
import type {FormulationSession} from '@/lib/life-coach/types';

const STOP_WORDS =
  /^(של|עם|את|על|זה|מה|איך|לא|גם|כי|the|and|for|with|that|this|from|your|you|are|was|were|have|has)$/i;

export type BehaviorChangeContext = {
  primary_goal_focus: string;
  suggested_domain: LifeDomain | null;
  value: string | null;
  micro_goal_week: string | null;
  central_barrier: string;
  stressors: string[];
  maintaining_factors: string[];
  existing_strengths: string[];
};

type ScoredBehaviorStep = {
  step_id: string;
  title: string;
  date: string;
  status: DailyBabyStep['status'];
  aligns_micro_goal: boolean;
  touches_barrier: boolean;
  addresses_maintaining: boolean;
  in_target_domain: boolean;
};

export type WeekBehaviorChangeAnalysis = {
  show_up_count: number;
  completed_count: number;
  partial_count: number;
  goal_aligned_count: number;
  barrier_touched_count: number;
  maintaining_addressed_count: number;
  target_domain_action_count: number;
  target_domain_step_count: number;
  comeback_after_barrier: boolean;
  comeback_detail: string | null;
  headline: string | null;
  detail_lines: string[];
  scored_steps: ScoredBehaviorStep[];
  returning_barrier_headline?: string | null;
  returning_barrier_detail?: string | null;
};

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

function stepBlob(step: DailyBabyStep): string {
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

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** "1 step" / "3 steps" / "צעד אחד" / "3 צעדים" — keeps count and noun in agreement. */
function stepsWord(count: number, he: boolean): string {
  if (he) return count === 1 ? 'צעד אחד' : `${count} צעדים`;
  return count === 1 ? '1 step' : `${count} steps`;
}

export function buildBehaviorChangeContext(
  session: FormulationSession,
  locale: AppLocale
): BehaviorChangeContext | null {
  const approved = session.formulation_approved;
  const handoff = session.coach_handoff;
  if (!approved && !handoff?.micro_goal_week?.trim()) return null;

  const insights = buildFormulationInsights(session, locale);
  const central_barrier =
    handoff?.anticipated_barrier?.trim() ||
    insights.burning_now_themes[0]?.label ||
    approved?.presenting_concern_user_words?.trim() ||
    insights.primary_goal_focus;

  return {
    primary_goal_focus: insights.primary_goal_focus,
    suggested_domain: deriveDomainFromHandoff(handoff?.suggested_domain),
    value: handoff?.value?.trim() || null,
    micro_goal_week: handoff?.micro_goal_week?.trim() || null,
    central_barrier: clip(central_barrier, 90),
    stressors: (approved?.stressors ?? []).filter(Boolean).slice(0, 5),
    maintaining_factors: (approved?.maintaining_factors ?? []).filter(Boolean).slice(0, 5),
    existing_strengths: (approved?.existing_strengths ?? []).filter(Boolean).slice(0, 4),
  };
}

function detectComebackAfterBarrier(
  steps: DailyBabyStep[],
  reflections: DailyReflection[],
  locale: AppLocale
): {found: boolean; detail: string | null} {
  const he = locale === 'he';
  const byDate = new Map<string, DailyBabyStep[]>();
  for (const step of steps) {
    const list = byDate.get(step.scheduled_date) ?? [];
    list.push(step);
    byDate.set(step.scheduled_date, list);
  }

  const dates = [...byDate.keys()].sort();
  const reflectionByDate = new Map(reflections.map((r) => [r.date, r]));

  for (let i = 0; i < dates.length - 1; i++) {
    const hardDate = dates[i]!;
    const returnDate = dates[i + 1]!;
    const hardSteps = byDate.get(hardDate) ?? [];
    const returnSteps = byDate.get(returnDate) ?? [];
    const hardDayFailed =
      hardSteps.length > 0 &&
      hardSteps.every((step) => step.status === 'skipped' || step.status === 'partial');
    const reflection = reflectionByDate.get(hardDate);
    const barrierSignal =
      reflection?.blocker_reason ||
      handoffBarrierFromReflection(reflection?.reflection_text) ||
      (hardDayFailed ? (he ? 'יום קשה' : 'a hard day') : null);
    const comebackStep = returnSteps.find(
      (step) => step.status === 'completed' || step.status === 'partial'
    );

    if ((hardDayFailed || reflection?.blocker_reason || reflection?.reflection_text?.trim()) && comebackStep) {
      return {
        found: true,
        detail: he
          ? `חזרת ל"${clip(comebackStep.title, 50)}" ב-${returnDate} אחרי ${barrierSignal || 'קושי'}`
          : `Returned to "${clip(comebackStep.title, 50)}" on ${returnDate} after ${barrierSignal || 'difficulty'}`,
      };
    }
  }

  return {found: false, detail: null};
}

function handoffBarrierFromReflection(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  return clip(text.trim(), 40);
}

function scoreStep(step: DailyBabyStep, ctx: BehaviorChangeContext): ScoredBehaviorStep {
  const blob = stepBlob(step);
  const goalAnchors = [ctx.micro_goal_week, ctx.value, ctx.primary_goal_focus].filter(Boolean);
  const aligns_micro_goal = goalAnchors.some((anchor) => textMatchesAnchor(blob, anchor));
  const touches_barrier = textMatchesAnchor(blob, ctx.central_barrier);
  const addresses_maintaining = ctx.maintaining_factors.some((factor) =>
    textMatchesAnchor(blob, factor)
  );
  const in_target_domain = ctx.suggested_domain ? step.domain === ctx.suggested_domain : false;

  return {
    step_id: step.id,
    title: step.title,
    date: step.scheduled_date,
    status: step.status,
    aligns_micro_goal,
    touches_barrier,
    addresses_maintaining,
    in_target_domain,
  };
}

function buildHeadline(
  ctx: BehaviorChangeContext,
  analysis: Omit<WeekBehaviorChangeAnalysis, 'headline' | 'detail_lines' | 'scored_steps'>,
  locale: AppLocale
): {headline: string | null; detail_lines: string[]} {
  const he = locale === 'he';
  const showUps = analysis.show_up_count;
  const barrier = clip(ctx.central_barrier, 55);
  const details: string[] = [];

  if (showUps === 0) {
    if (analysis.comeback_after_barrier && analysis.comeback_detail) {
      return {
        headline: he
          ? 'עדיין לא השלמת צעדים — אבל חזרת למסלול אחרי קושי, וזה נספר.'
          : 'No completed steps yet — but you returned to the path after difficulty, and that counts.',
        detail_lines: [analysis.comeback_detail],
      };
    }
    return {headline: null, detail_lines: []};
  }

  if (analysis.barrier_touched_count >= 1 && showUps <= 5) {
    if (analysis.barrier_touched_count >= 2 || showUps <= 3) {
      return {
        headline: he
          ? `השבוע השלמת ${showUps === 1 ? 'צעד אחד' : `${showUps} צעדים`}, אבל ${analysis.barrier_touched_count} מהם נגעו ישירות בחסם המרכזי שלך: ${barrier}.`
          : `This week you completed only ${showUps} step${showUps === 1 ? '' : 's'}, but ${analysis.barrier_touched_count} directly touched your central barrier: ${barrier}.`,
        detail_lines: buildDetailLines(analysis, ctx, locale),
      };
    }
  }

  if (analysis.goal_aligned_count >= 1 && analysis.goal_aligned_count < showUps) {
    details.push(
      he
        ? `${analysis.goal_aligned_count} מתוך ${showUps} צעדים קשורים להתחייבות השבועית שלך.`
        : `${analysis.goal_aligned_count} of ${showUps} steps connected to your weekly commitment.`
    );
  } else if (analysis.goal_aligned_count >= 1) {
    details.push(
      he
        ? `כל ${showUps === 1 ? 'הצעד שביצעת' : `${showUps} הצעדים שביצעת`} קשורים ל-${clip(ctx.micro_goal_week ?? ctx.primary_goal_focus, 50)}.`
        : `${showUps === 1 ? 'The single step you took connected' : `All ${showUps} steps you took connected`} to ${clip(ctx.micro_goal_week ?? ctx.primary_goal_focus, 50)}.`
    );
  }

  if (analysis.maintaining_addressed_count >= 1) {
    details.push(
      he
        ? `${stepsWord(analysis.maintaining_addressed_count, true)} עבדו נגד דפוסים שמחזיקים את הקושי במקום.`
        : `${stepsWord(analysis.maintaining_addressed_count, false)} worked against patterns that keep the struggle in place.`
    );
  }

  if (analysis.comeback_after_barrier && analysis.comeback_detail) {
    details.push(analysis.comeback_detail);
  }

  if (ctx.suggested_domain && analysis.target_domain_step_count > 0) {
    const ratio = analysis.target_domain_action_count / Math.max(1, analysis.target_domain_step_count);
    if (ratio < 0.5 && showUps >= 2) {
      details.push(
        he
          ? `רק ${stepsWord(analysis.target_domain_action_count, true)} בתחום ${ctx.suggested_domain} — שווה לכוון יותר פעולה לשם השבוע הבא.`
          : `Only ${stepsWord(analysis.target_domain_action_count, false)} in ${ctx.suggested_domain} — worth steering more action there next week.`
      );
    } else if (analysis.target_domain_action_count >= 2) {
      details.push(
        he
          ? `${analysis.target_domain_action_count} צעדים בתחום היעד (${ctx.suggested_domain}) — התחום קיבל מספיק תשומת לב.`
          : `${analysis.target_domain_action_count} steps in your target domain (${ctx.suggested_domain}) — the domain got real attention.`
      );
    }
  }

  if (details.length === 0) {
    return {headline: null, detail_lines: []};
  }

  const headline = he
    ? `השבוע ${showUps === 1 ? 'הופעת בצעד אחד' : `הופעת ב-${showUps} צעדים`} — לא רק כמות, גם כיוון: ${details[0]}`
    : `This week you showed up for ${showUps} step${showUps === 1 ? '' : 's'} — not just volume, also direction: ${details[0]}`;

  return {headline, detail_lines: details.slice(1)};
}

function buildDetailLines(
  analysis: Omit<WeekBehaviorChangeAnalysis, 'headline' | 'detail_lines' | 'scored_steps'>,
  ctx: BehaviorChangeContext,
  locale: AppLocale
): string[] {
  const he = locale === 'he';
  const lines: string[] = [];

  if (analysis.goal_aligned_count >= 1) {
    lines.push(
      he
        ? `${stepsWord(analysis.goal_aligned_count, true)} קשורים ל-${clip(ctx.micro_goal_week ?? ctx.primary_goal_focus, 45)}.`
        : `${stepsWord(analysis.goal_aligned_count, false)} tied to ${clip(ctx.micro_goal_week ?? ctx.primary_goal_focus, 45)}.`
    );
  }
  if (analysis.maintaining_addressed_count >= 1) {
    lines.push(
      he
        ? `${stepsWord(analysis.maintaining_addressed_count, true)} עבדו נגד דפוסים שמחזיקים את הקושי במקום.`
        : `${stepsWord(analysis.maintaining_addressed_count, false)} addressed maintaining factors.`
    );
  }
  if (analysis.comeback_after_barrier && analysis.comeback_detail) {
    lines.push(analysis.comeback_detail);
  }
  return lines;
}

export function analyzeWeekBehaviorChange(input: {
  context: BehaviorChangeContext;
  steps: DailyBabyStep[];
  reflections?: DailyReflection[];
  periodStart?: string;
  periodEnd?: string;
  locale: AppLocale;
}): WeekBehaviorChangeAnalysis {
  const periodSteps = input.periodStart && input.periodEnd
    ? filterStepsInPeriod(input.steps, input.periodStart, input.periodEnd)
    : input.steps;

  const scored = periodSteps.map((step) => scoreStep(step, input.context));
  const actioned = periodSteps.filter(
    (step) => step.status === 'completed' || step.status === 'partial'
  );
  const completed = periodSteps.filter((step) => step.status === 'completed');
  const partial = periodSteps.filter((step) => step.status === 'partial');
  const actionedScored = scored.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  );

  const comeback = detectComebackAfterBarrier(
    periodSteps,
    input.reflections ?? [],
    input.locale
  );

  const base = {
    show_up_count: actioned.length,
    completed_count: completed.length,
    partial_count: partial.length,
    goal_aligned_count: actionedScored.filter((s) => s.aligns_micro_goal).length,
    barrier_touched_count: actionedScored.filter((s) => s.touches_barrier).length,
    maintaining_addressed_count: actionedScored.filter((s) => s.addresses_maintaining).length,
    target_domain_action_count: actionedScored.filter((s) => s.in_target_domain).length,
    target_domain_step_count: input.context.suggested_domain
      ? periodSteps.filter((s) => s.domain === input.context.suggested_domain).length
      : 0,
    comeback_after_barrier: comeback.found,
    comeback_detail: comeback.detail,
  };

  const {headline, detail_lines} = buildHeadline(input.context, base, input.locale);

  return {
    ...base,
    headline,
    detail_lines,
    scored_steps: scored,
  };
}

export function behaviorChangeForPrompt(
  context: BehaviorChangeContext | null,
  analysis: WeekBehaviorChangeAnalysis | null
): Record<string, unknown> | null {
  if (!context) return null;
  return {
    primary_goal_focus: context.primary_goal_focus,
    suggested_domain: context.suggested_domain,
    micro_goal_week: context.micro_goal_week,
    central_barrier: context.central_barrier,
    maintaining_factors: context.maintaining_factors,
    week_analysis: analysis
      ? {
          show_up_count: analysis.show_up_count,
          goal_aligned_count: analysis.goal_aligned_count,
          barrier_touched_count: analysis.barrier_touched_count,
          maintaining_addressed_count: analysis.maintaining_addressed_count,
          target_domain_action_count: analysis.target_domain_action_count,
          comeback_after_barrier: analysis.comeback_after_barrier,
          headline: analysis.headline,
          returning_barrier_headline: analysis.returning_barrier_headline ?? null,
        }
      : null,
  };
}

export function behaviorChangePromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## מעקב שינוי התנהגות (behavior_change):',
        'אם קיים behavior_change — אל תסתמך רק על כמות צעדים/streak/אחוז ביצוע.',
        'progress_evidence/summary חייבים לכלול: כמה צעדים נגעו ב-central_barrier, goal_aligned_count, maintaining_addressed, comeback_after_barrier.',
        'דוגמה: "השלמת 3 צעדים, אבל 2 נגעו בהימנעות משיחה קשה."',
      ].join('\n')
    : [
        '## Behavior change tracking (behavior_change):',
        'When behavior_change exists — do not rely only on step count/streak/completion rate.',
        'progress_evidence/summary must include: steps touching central_barrier, goal_aligned_count, maintaining_addressed, comeback_after_barrier.',
        'Example: "You completed 3 steps, but 2 touched avoidance of a hard conversation."',
      ].join('\n');
}
