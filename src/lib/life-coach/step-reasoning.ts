import {dateToYMD} from '@/lib/date-utils';
import type {AppLocale} from '@/i18n/config';
import type {
  DailyBabyStep,
  DailyReflection,
  ReflectionBlockerReason,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';

export const MAX_STEP_REASONING_LENGTH = 140;

export const STEP_REASONING_PROMPT_BLOCK = [
  '## Step reasoning (user-facing, REQUIRED for every step):',
  'For each step, include why_this_step — one short reason the user will see below the task.',
  'Base it on latest_morning_ritual (mood, energy, momentum, priority_action), recurring blockers, active goal, weekly focus, or life context.',
  'Hebrew: start with "נבחר כי". English: start with "Chosen because".',
  'Reject generic lines ("helps you grow", "good for you") — cite a specific signal from the payload.',
].join('\n');

const CAUSAL_PREFIX_HE = 'נבחר כי';
const CAUSAL_PREFIX_EN = 'chosen because';

export type StepReasoningContext = {
  locale: AppLocale;
  date: string;
  easy_only?: boolean;
  yesterday_energy?: number | null;
  yesterday_blocker?: ReflectionBlockerReason | null;
  consecutive_skips?: number;
  weekly_theme?: string | null;
};

export type StepExplainabilityMetrics = {
  ai_steps: number;
  with_reasoning: number;
  reasoning_present_rate: number;
  causal_reasoning_rate: number;
  explained_completion_rate: number;
  unexplained_completion_rate: number;
  completion_lift: number;
  trust_proxy_rate: number;
};

export function clampStepReasoning(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_STEP_REASONING_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_STEP_REASONING_LENGTH - 1).trimEnd();
  return `${cut}…`;
}

function hasCausalReasoningPrefix(reasoning: string, locale: AppLocale): boolean {
  const lower = reasoning.trim().toLowerCase();
  return locale === 'he'
    ? lower.startsWith(CAUSAL_PREFIX_HE)
    : lower.startsWith(CAUSAL_PREFIX_EN);
}

/** Strip stored causal prefix before UI adds "בחרתי את זה כי…" / "I chose this because…". */
export function stripReasoningPrefix(reasoning: string, locale: AppLocale): string {
  const trimmed = reasoning.trim();
  if (!trimmed) return '';

  if (locale === 'he') {
    if (trimmed.startsWith(CAUSAL_PREFIX_HE)) {
      return trimmed.slice(CAUSAL_PREFIX_HE.length).replace(/^[\s:–—-]+/, '').trim();
    }
    return trimmed;
  }

  if (trimmed.toLowerCase().startsWith(CAUSAL_PREFIX_EN)) {
    return trimmed.slice(CAUSAL_PREFIX_EN.length).replace(/^[\s:–—-]+/, '').trim();
  }
  return trimmed;
}

export function buildStepReasoningContext(input: {
  locale: AppLocale;
  date: string;
  reflections: DailyReflection[];
  easy_only?: boolean;
  weekly_theme?: string | null;
  consecutive_skips?: number;
}): StepReasoningContext {
  const yesterday = findYesterdayReflection(input.reflections, input.date);
  return {
    locale: input.locale,
    date: input.date,
    easy_only: input.easy_only,
    yesterday_energy: yesterday?.energy_score ?? null,
    yesterday_blocker: yesterday?.blocker_reason ?? null,
    consecutive_skips: input.consecutive_skips,
    weekly_theme: input.weekly_theme,
  };
}

function findYesterdayReflection(
  reflections: DailyReflection[],
  date: string
): DailyReflection | undefined {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const yesterday = dateToYMD(d);
  return reflections.find((r) => r.date === yesterday);
}

export function buildStepReasoningFallback(
  ctx: StepReasoningContext,
  step: Pick<StructuredDailyBabyStep, 'estimated_minutes' | 'difficulty'>
): string {
  const he = ctx.locale === 'he';

  if (
    ctx.yesterday_blocker === 'low_energy' ||
    (ctx.yesterday_energy != null && ctx.yesterday_energy <= 3)
  ) {
    return (
      clampStepReasoning(
        he
          ? 'נבחר כי אתמול סימנת אנרגיה נמוכה ולכן זה קצר.'
          : 'Chosen because yesterday you marked low energy, so this stays short.'
      ) ?? ''
    );
  }

  if (ctx.yesterday_blocker === 'no_time') {
    return (
      clampStepReasoning(
        he
          ? 'נבחר כי אתמול לא היה זמן — קיצרנו את הצעד להיום.'
          : 'Chosen because yesterday you had no time — we shortened this step.'
      ) ?? ''
    );
  }

  if (ctx.yesterday_blocker === 'family_chaos') {
    return (
      clampStepReasoning(
        he
          ? 'נבחר כי אתמול היה כאוס משפחתי — צעד קטן שמתאים ליום עמוס.'
          : 'Chosen because yesterday was family chaos — a small step for a busy day.'
      ) ?? ''
    );
  }

  if (ctx.consecutive_skips && ctx.consecutive_skips >= 2) {
    return (
      clampStepReasoning(
        he
          ? `נבחר כי דילגת ${ctx.consecutive_skips} ימים — חוזרים בקטן.`
          : `Chosen because you skipped ${ctx.consecutive_skips} days — restarting small.`
      ) ?? ''
    );
  }

  if (ctx.easy_only || (step.difficulty === 'easy' && step.estimated_minutes <= 8)) {
    return (
      clampStepReasoning(
        he
          ? 'נבחר כי הדפוסים האחרונים דורשים צעד קל יותר.'
          : 'Chosen because recent patterns call for an easier step.'
      ) ?? ''
    );
  }

  if (ctx.weekly_theme) {
    const theme = ctx.weekly_theme.length > 50 ? `${ctx.weekly_theme.slice(0, 47)}…` : ctx.weekly_theme;
    return (
      clampStepReasoning(
        he ? `נבחר כי מיקוד השבוע: ${theme}.` : `Chosen because this week's focus: ${theme}.`
      ) ?? ''
    );
  }

  return (
    clampStepReasoning(
      he
        ? 'נבחר כי זה הצעד הקטן הבא לכיוון המטרה שלך.'
        : 'Chosen because this is your next small move toward the goal.'
    ) ?? ''
  );
}

function finalizeStepReasoning(
  step: StructuredDailyBabyStep,
  ctx: StepReasoningContext
): StructuredDailyBabyStep {
  const raw = step.reasoning?.trim();
  if (!raw || raw.length < 8) {
    const {reasoning: _omit, ...rest} = step;
    return rest;
  }

  const reasoning = clampStepReasoning(
    hasCausalReasoningPrefix(raw, ctx.locale)
      ? raw
      : `${ctx.locale === 'he' ? CAUSAL_PREFIX_HE : 'Chosen because'} ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
  );

  return reasoning ? {...step, reasoning} : step;
}

export function finalizeStepsReasoning(
  steps: StructuredDailyBabyStep[],
  baseCtx: StepReasoningContext,
  weeklyThemesByGoalId?: Record<string, string | null>
): StructuredDailyBabyStep[] {
  return steps.map((step) => {
    const weekly_theme = step.goal_id
      ? weeklyThemesByGoalId?.[step.goal_id] ?? null
      : null;
    return finalizeStepReasoning(step, {...baseCtx, weekly_theme});
  });
}

function completionRate(steps: DailyBabyStep[]): number {
  const actionable = steps.filter((s) => s.status !== 'pending');
  if (actionable.length === 0) return 0;
  const done = actionable.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  ).length;
  return Math.round((done / actionable.length) * 100) / 100;
}

/** Trust proxy: user opened description on AI steps that showed reasoning. */
function isCausalReasoning(reasoning: string): boolean {
  const lower = reasoning.trim().toLowerCase();
  return lower.startsWith(CAUSAL_PREFIX_HE) || lower.startsWith(CAUSAL_PREFIX_EN);
}

export function computeStepExplainabilityMetrics(
  steps: DailyBabyStep[],
  windowDays = 14
): StepExplainabilityMetrics | null {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const aiSteps = steps.filter((s) => s.scheduled_date >= since && s.generated_by_ai);
  if (aiSteps.length === 0) return null;

  const withReasoning = aiSteps.filter((s) => clampStepReasoning(s.reasoning));
  const explained = withReasoning.filter((s) => {
    const r = clampStepReasoning(s.reasoning);
    return r && r.length >= 8;
  });
  const causal = explained.filter((s) =>
    isCausalReasoning(clampStepReasoning(s.reasoning)!)
  );
  const unexplained = aiSteps.filter((s) => !clampStepReasoning(s.reasoning));

  const explainedCompletion = completionRate(explained);
  const unexplainedCompletion = completionRate(unexplained);
  const trustRead = explained.filter((s) => s.read_description).length;

  return {
    ai_steps: aiSteps.length,
    with_reasoning: explained.length,
    reasoning_present_rate:
      Math.round((explained.length / aiSteps.length) * 100) / 100,
    causal_reasoning_rate:
      explained.length > 0
        ? Math.round((causal.length / explained.length) * 100) / 100
        : 0,
    explained_completion_rate: explainedCompletion,
    unexplained_completion_rate: unexplainedCompletion,
    completion_lift:
      Math.round((explainedCompletion - unexplainedCompletion) * 100) / 100,
    trust_proxy_rate:
      explained.length > 0
        ? Math.round((trustRead / explained.length) * 100) / 100
        : 0,
  };
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}
