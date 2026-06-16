import type {AppLocale} from '@/i18n/config';
import type {HealthWizardContextInput} from '@/lib/ai-life-coach/health-goal-fallback';
import type {KnownBlockersProfile} from '@/lib/life-coach/known-blockers';
import type {
  HealthExecutionPlan,
  LifeDomainState,
  StructuredGoalPlan,
} from '@/lib/life-coach/types';

export type GoalRealismStructuringInput = {
  locale: AppLocale;
  raw_goal: string;
  motivation: string;
  constraints: string;
  assessment: Pick<
    LifeDomainState,
    'available_time_per_day' | 'intensity_preference'
  > | null;
  known_blockers?: KnownBlockersProfile | null;
  health_wizard_context?: HealthWizardContextInput;
};

export type GoalRealismRiskLevel = 'low' | 'medium' | 'high';

export type GoalRealismCheck = {
  risk_level: GoalRealismRiskLevel;
  risk_reason: string;
  first_week_adjustment: string | null;
  adjusted: boolean;
};

type AiRealismCheckInput = {
  risk_level?: GoalRealismRiskLevel;
  risk_reason?: string;
  first_week_adjustment?: string | null;
};

const AMBITIOUS_HE =
  /מרתון|מיליון|שוטף|שפה|לרדת\s*\d+|לעלות\s*\d+\s*ק["']?ג|90\s*יום|לשנות\s*חיים|מנכ"ל|הכנסה|חופש\s*כלכלי|להפוך\s*ל|לגמרי|לחלוטין/i;
const AMBITIOUS_EN =
  /marathon|million|fluent|lose\s*\d+|gain\s*\d+\s*(kg|lb|pounds)|ceo|financial\s*freedom|transform\s*my\s*life|completely|entirely|90.day/i;

function availableMinutes(input: GoalRealismStructuringInput): number {
  return Math.max(5, input.assessment?.available_time_per_day ?? 10);
}

function isAmbitiousGoalText(text: string): boolean {
  const combined = text.trim();
  if (!combined) return false;
  return AMBITIOUS_HE.test(combined) || AMBITIOUS_EN.test(combined);
}

function assessRiskScore(input: GoalRealismStructuringInput, plan: StructuredGoalPlan): number {
  let score = 0;
  const minutes = availableMinutes(input);
  const goalText = [input.raw_goal, input.motivation, input.constraints].filter(Boolean).join(' ');

  if (minutes <= 10) score += 2;
  if (minutes <= 5) score += 1;
  if (isAmbitiousGoalText(goalText)) score += 3;
  if (input.assessment?.intensity_preference === 'gentle') score += 1;
  if (input.known_blockers?.has_no_time_signal) score += 2;
  if (
    input.known_blockers?.dominant_kind === 'energy' ||
    input.known_blockers?.blockers.some((entry) => entry.kind === 'energy')
  ) {
    score += 1;
  }

  const hardSteps = plan.daily_baby_steps.filter((s) => s.difficulty === 'hard').length;
  const longSteps = plan.daily_baby_steps.filter(
    (s) => s.estimated_minutes > minutes + 5
  ).length;
  if (hardSteps >= 1) score += 2;
  if (longSteps >= 1) score += 2;
  if (plan.daily_baby_steps.length >= 3 && minutes <= 10) score += 1;

  const wizard = input.health_wizard_context;
  if (wizard && minutes <= 10) {
    const delta = Math.abs(wizard.metrics.target_value - wizard.metrics.baseline_value);
    if (delta >= 8) score += 2;
    if (delta >= 15) score += 1;
  }

  return score;
}

function scoreToRiskLevel(score: number): GoalRealismRiskLevel {
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function buildRiskReason(
  level: GoalRealismRiskLevel,
  input: GoalRealismStructuringInput,
  locale: AppLocale
): string {
  const minutes = availableMinutes(input);
  const he = locale === 'he';
  const ambitious = isAmbitiousGoalText(
    [input.raw_goal, input.motivation].filter(Boolean).join(' ')
  );

  if (level === 'high' && ambitious && minutes <= 10) {
    return he
      ? `יעד שאפתני עם רק ${minutes} דקות ביום — סיכון גבוה לעומס יתר בשבוע הראשון.`
      : `Ambitious goal with only ${minutes} minutes per day — high first-week overload risk.`;
  }
  if (level === 'high') {
    return he
      ? `התוכנית הראשונית דורשת יותר זמן/עוצמה ממה שזמין (${minutes} דקות ביום).`
      : `The initial plan asks for more time/intensity than available (${minutes} minutes per day).`;
  }
  if (level === 'medium') {
    return he
      ? `יש פער בין גודל היעד לזמן היומי — מומלץ להתחיל מדורג.`
      : `There is a gap between goal size and daily time — a gradual start is safer.`;
  }
  return he
    ? `היעד והזמן היומי (${minutes} דקות) מתאימים לפתיחה מדורגת.`
    : `The goal and daily time (${minutes} minutes) support a gradual opening.`;
}

function buildFirstWeekAdjustment(locale: AppLocale, maxMinutes: number): string {
  return locale === 'he'
    ? `השבוע הראשון צומצם ל-1-2 צעדים קלים של עד ${maxMinutes} דקות — עקביות לפני האצה.`
    : `Week one was reduced to 1-2 easy steps of up to ${maxMinutes} minutes — consistency before acceleration.`;
}

function shrinkExecutionPlanFirstWeek(
  plan: HealthExecutionPlan | null | undefined,
  maxMinutes: number,
  highRisk: boolean
): HealthExecutionPlan | null | undefined {
  if (!plan?.phases?.length) return plan;

  const phases = plan.phases.map((phase, index) => {
    if (index > 0 || phase.end_day > 14) return phase;
    const templates = phase.task_templates
      .slice(0, highRisk ? 2 : 3)
      .map((task) => ({
        ...task,
        difficulty: 'easy' as const,
        estimated_minutes: Math.min(task.estimated_minutes, maxMinutes),
        description:
          highRisk && task.description.length > 120
            ? `${task.description.slice(0, 117)}…`
            : task.description,
      }));

    return {
      ...phase,
      focus:
        highRisk && phase.focus
          ? phase.focus.includes('הרחב') || phase.focus.includes('expand')
            ? phase.focus
            : phase.focus
          : phase.focus,
      task_templates: templates,
    };
  });

  return {phases};
}

function shrinkBabySteps(
  steps: StructuredGoalPlan['daily_baby_steps'],
  maxMinutes: number,
  highRisk: boolean
): StructuredGoalPlan['daily_baby_steps'] {
  const cap = highRisk ? 2 : steps.length;
  return steps.slice(0, cap).map((step) => ({
    ...step,
    difficulty: 'easy',
    estimated_minutes: Math.min(step.estimated_minutes, maxMinutes),
  }));
}

function softenFirstMilestone(
  milestones: StructuredGoalPlan['milestones'],
  locale: AppLocale,
  highRisk: boolean
): StructuredGoalPlan['milestones'] {
  if (!highRisk || milestones.length === 0) return milestones;
  const he = locale === 'he';
  const [first, ...rest] = milestones;
  const gentleNote = he
    ? ' (שבוע 1: רק עקביות קטנה — לא קפיצה גדולה.)'
    : ' (Week 1: small consistency only — no big leap.)';
  return [
    {
      ...first,
      description: first.description.trim()
        ? `${first.description.trim()}${gentleNote}`
        : he
          ? `התחלה מדורגת${gentleNote}`
          : `Gradual start${gentleNote}`,
    },
    ...rest,
  ];
}

function mergeRealismCheck(
  assessed: GoalRealismCheck,
  fromAi?: AiRealismCheckInput | null
): GoalRealismCheck {
  const aiLevel = fromAi?.risk_level;
  const levelRank = {low: 0, medium: 1, high: 2};
  const mergedLevel =
    aiLevel && levelRank[aiLevel] > levelRank[assessed.risk_level]
      ? aiLevel
      : assessed.risk_level;

  return {
    risk_level: mergedLevel,
    risk_reason: fromAi?.risk_reason?.trim() || assessed.risk_reason,
    first_week_adjustment:
      assessed.adjusted
        ? assessed.first_week_adjustment
        : fromAi?.first_week_adjustment?.trim() || null,
    adjusted: assessed.adjusted,
  };
}

function assessGoalRealism(
  plan: StructuredGoalPlan,
  input: GoalRealismStructuringInput
): GoalRealismCheck {
  const locale = input.locale;
  const score = assessRiskScore(input, plan);
  const risk_level = scoreToRiskLevel(score);
  return {
    risk_level,
    risk_reason: buildRiskReason(risk_level, input, locale),
    first_week_adjustment: null,
    adjusted: false,
  };
}

export function applyGoalRealismToPlan(
  plan: StructuredGoalPlan,
  input: GoalRealismStructuringInput,
  aiCheck?: AiRealismCheckInput | null
): {plan: StructuredGoalPlan; realism_check: GoalRealismCheck} {
  const assessed = assessGoalRealism(plan, input);
  const maxMinutes = Math.min(availableMinutes(input), 10);
  const shouldAdjust = assessed.risk_level === 'high';

  if (!shouldAdjust) {
    return {
      plan,
      realism_check: mergeRealismCheck(assessed, aiCheck),
    };
  }

  const adjustedPlan: StructuredGoalPlan = {
    ...plan,
    daily_baby_steps: shrinkBabySteps(plan.daily_baby_steps, maxMinutes, true),
    milestones: softenFirstMilestone(plan.milestones, input.locale, true),
    execution_plan: shrinkExecutionPlanFirstWeek(plan.execution_plan, maxMinutes, true) ?? plan.execution_plan,
  };

  const realism_check: GoalRealismCheck = {
    risk_level: 'high',
    risk_reason: buildRiskReason('high', input, input.locale),
    first_week_adjustment: buildFirstWeekAdjustment(input.locale, maxMinutes),
    adjusted: true,
  };

  return {
    plan: adjustedPlan,
    realism_check: mergeRealismCheck(realism_check, aiCheck),
  };
}

export function realismCheckForAiResponse(
  plan: StructuredGoalPlan,
  input: GoalRealismStructuringInput
): {
  risk_level: GoalRealismRiskLevel;
  risk_reason: string;
  first_week_adjustment: string | null;
} {
  const assessed = assessGoalRealism(plan, input);
  return {
    risk_level: assessed.risk_level,
    risk_reason: assessed.risk_reason,
    first_week_adjustment: assessed.first_week_adjustment,
  };
}

export const GOAL_REALISM_PROMPT_BLOCK = [
  '## Goal realism check (mandatory):',
  'Always return realism_check with risk_level (low|medium|high), risk_reason, first_week_adjustment.',
  'Compare raw_goal ambition vs available_time_per_day and intensity_preference.',
  'If risk_level is "high": you MUST shrink week one — max 2 easy daily_baby_steps, each ≤ available_time_per_day (cap 10 min), no hard steps.',
  'For health execution_plan: phase 1 (days 1-14) must have at most 2 easy task_templates within time budget.',
  'first_week_adjustment: one sentence explaining what you reduced (null if risk is low).',
  'Ambitious goal + ≤10 min/day → high risk and mandatory first-week reduction.',
].join('\n');
