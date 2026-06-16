import type {AppLocale} from '@/i18n/config';
import {
  buildFallbackStepContract,
  goalBabyStepsFromContracts,
  type StepContract,
} from '@/lib/life-coach/step-contract';
import type {
  HealthAnchorHabit,
  HealthCategory,
  HealthExecutionPlan,
  HealthGoalAnchor,
  HealthGoalContext,
  StructuredGoalPlan,
} from '@/lib/life-coach/types';
import type {z} from 'zod';
import type {healthWizardContextInputSchema} from '@/lib/life-coach/schemas';
import {dateToYMD} from '@/lib/date-utils';

export type HealthWizardContextInput = z.infer<typeof healthWizardContextInputSchema>;

const ANCHOR_LABELS: Record<AppLocale, Record<HealthAnchorHabit, string>> = {
  he: {
    morning_coffee: 'קפה בוקר',
    commute: 'נסיעה לעבודה',
    before_shower: 'לפני מקלחת',
    before_sleep: 'לפני שינה',
    lunch_break: 'הפסקת צהריים',
    after_kids_school: 'אחרי שהילדים בבי"ס',
    before_evening_meal: 'לפני ארוחת ערב',
    after_work: 'אחרי סיום יום העבודה',
    custom: 'הרגל קבוע',
  },
  en: {
    morning_coffee: 'morning coffee',
    commute: 'commute',
    before_shower: 'before shower',
    before_sleep: 'before sleep',
    lunch_break: 'lunch break',
    after_kids_school: 'after kids are at school',
    before_evening_meal: 'before evening meal',
    after_work: 'after work',
    custom: 'my routine',
  },
};

export function wizardInputToHealthContext(
  wizard: HealthWizardContextInput,
  executionPlan: HealthExecutionPlan,
  planSource: 'ai' | 'fallback'
): HealthGoalContext {
  return {
    category: wizard.category,
    metrics: wizard.metrics,
    weight_direction: wizard.weight_direction,
    secondary_focus: wizard.secondary_focus,
    current_kg: wizard.current_kg,
    target_kg: wizard.target_kg,
    timeline: wizard.timeline,
    why_deep: wizard.why_deep,
    anchor: wizard.anchor,
    execution_plan: executionPlan,
    plan_source: planSource,
  };
}

export function formatAnchorPrefix(anchor: HealthGoalAnchor | undefined, locale: AppLocale): string {
  if (!anchor) {
    return locale === 'he' ? 'היום' : 'Today';
  }

  const label =
    anchor.habit_key === 'custom' && anchor.custom_label
      ? anchor.custom_label
      : ANCHOR_LABELS[locale][anchor.habit_key];
  const timePart = anchor.time ? ` (${anchor.time})` : '';

  return locale === 'he' ? `אחרי ${label}${timePart}` : `After ${label}${timePart}`;
}

export function buildHealthStructuredGoalFallbackResponse(input: {
  locale: AppLocale;
  raw_goal: string;
  deadline: string | null;
  motivation: string;
  wizard: HealthWizardContextInput;
  availableMinutes: number;
}): {
  goal_title: string;
  goal_description: string;
  success_metric: string;
  deadline: string | null;
  milestones: StructuredGoalPlan['milestones'];
  daily_baby_steps: StepContract[];
  execution_plan: HealthExecutionPlan;
  plan_source: 'fallback';
} {
  const {locale, wizard, raw_goal, deadline, motivation, availableMinutes} = input;
  const executionPlan = buildDefaultExecutionPlan(wizard, locale);
  const firstStep = executionPlan.phases[0]?.task_templates[0];
  const anchorPrefix = formatAnchorPrefix(wizard.anchor, locale);
  const goalTitle = buildGoalTitle(wizard, locale);
  const goalDescription = [raw_goal, motivation].filter(Boolean).join('\n\n');

  const daily_baby_steps: StepContract[] = firstStep
    ? [
        buildFallbackStepContract({
          title: `${anchorPrefix}, ${firstStep.title}`.slice(0, 180),
          description: firstStep.description,
          estimated_minutes: Math.min(firstStep.estimated_minutes, availableMinutes || 15),
          difficulty: firstStep.difficulty,
          locale,
          why:
            locale === 'he'
              ? 'צעד ראשון מהתוכנית — מחובר להרגל הקיים שלך.'
              : 'First step from your plan — tied to your existing routine.',
        }),
      ]
    : [
        buildFallbackStepContract({
          title:
            locale === 'he'
              ? `${anchorPrefix}, צעד בריאות קטן להיום`
              : `${anchorPrefix}, one small health step today`,
          description:
            locale === 'he'
              ? 'פעולה אחת קצרה שמתחילה עכשיו.'
              : 'One short action to start now.',
          estimated_minutes: Math.min(10, availableMinutes || 10),
          locale,
        }),
      ];

  return {
    goal_title: goalTitle,
    goal_description: goalDescription.slice(0, 2000),
    success_metric: buildSuccessMetric(wizard, locale),
    deadline,
    milestones: buildFallbackMilestones(wizard, locale),
    daily_baby_steps,
    execution_plan: executionPlan,
    plan_source: 'fallback',
  };
}

export function buildHealthStructuredGoalFallback(
  input: {
    locale: AppLocale;
    raw_goal: string;
    deadline: string | null;
    motivation: string;
    wizard: HealthWizardContextInput;
    availableMinutes: number;
  }
): StructuredGoalPlan {
  const response = buildHealthStructuredGoalFallbackResponse(input);
  return {
    goal_title: response.goal_title,
    goal_description: response.goal_description,
    success_metric: response.success_metric,
    deadline: response.deadline,
    milestones: response.milestones,
    daily_baby_steps: goalBabyStepsFromContracts(response.daily_baby_steps),
    execution_plan: response.execution_plan,
    plan_source: response.plan_source,
  };
}

function buildGoalTitle(wizard: HealthWizardContextInput, locale: AppLocale): string {
  const {category, metrics} = wizard;

  if (locale === 'he') {
    const names: Record<HealthCategory, string> = {
      fitness: 'כושר',
      sleep: 'שינה',
      nutrition: 'תזונה',
      weight: 'משקל',
      energy: 'אנרגיה',
      specific_illness: 'ניהול מצב בריאותי',
    };
    return `שיפור ${names[category]}: ${metrics.baseline_value} → ${metrics.target_value}`;
  }

  return `Improve ${category}: ${metrics.baseline_value} → ${metrics.target_value}`;
}

function buildSuccessMetric(wizard: HealthWizardContextInput, locale: AppLocale): string {
  const {category, metrics, weight_direction, current_kg, target_kg} = wizard;

  if (category === 'nutrition') {
    return locale === 'he'
      ? `${metrics.baseline_value} → ${metrics.target_value} ארוחות בריאות ביום (90 יום)`
      : `${metrics.baseline_value} → ${metrics.target_value} healthy meals per day (90 days)`;
  }

  if (category === 'weight' || wizard.secondary_focus) {
    const dir =
      weight_direction === 'gain' || wizard.secondary_focus === 'weight_gain'
        ? locale === 'he'
          ? 'עלייה'
          : 'gain'
        : weight_direction === 'loss' || wizard.secondary_focus === 'weight_loss'
          ? locale === 'he'
            ? 'ירידה'
            : 'loss'
          : locale === 'he'
            ? 'שמירה'
            : 'maintain';
    const from = current_kg ?? metrics.baseline_value;
    const to = target_kg ?? metrics.target_value;
    return locale === 'he'
      ? `${dir} במשקל: ${from} → ${to} ק"ג (90 יום)`
      : `Weight ${dir}: ${from} → ${to} kg (90 days)`;
  }

  return locale === 'he'
    ? `${metrics.baseline_value} → ${metrics.target_value} תוך 90 יום`
    : `${metrics.baseline_value} → ${metrics.target_value} within 90 days`;
}

function buildFallbackMilestones(
  wizard: HealthWizardContextInput,
  locale: AppLocale
): StructuredGoalPlan['milestones'] {
  const labels =
    locale === 'he'
      ? {d30: 'יום 30', d60: 'יום 60', d90: 'יום 90'}
      : {d30: 'Day 30', d60: 'Day 60', d90: 'Day 90'};

  const items: StructuredGoalPlan['milestones'] = [];

  if (wizard.timeline.days_30) {
    items.push({title: `${labels.d30}: ${wizard.timeline.days_30}`, description: '', target_date: offsetDate(30)});
  }
  if (wizard.timeline.days_60) {
    items.push({title: `${labels.d60}: ${wizard.timeline.days_60}`, description: '', target_date: offsetDate(60)});
  }
  if (wizard.timeline.days_90) {
    items.push({title: `${labels.d90}: ${wizard.timeline.days_90}`, description: '', target_date: offsetDate(90)});
  }

  return items;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateToYMD(d);
}

export function buildDefaultExecutionPlan(
  wizard: HealthWizardContextInput,
  locale: AppLocale
): HealthExecutionPlan {
  const templates = buildCategoryTaskTemplates(wizard, locale);

  return {
    phases: [
      {
        start_day: 1,
        end_day: 14,
        focus:
          locale === 'he'
            ? 'הקמת הרגל בסיסי קבוע'
            : 'Establish a consistent base habit',
        task_templates: templates.base,
      },
      {
        start_day: 15,
        end_day: 28,
        focus:
          locale === 'he' ? 'עקביות 5 ימים בשבוע' : 'Consistency 5 days per week',
        task_templates: templates.consistency,
      },
      {
        start_day: 29,
        end_day: 56,
        focus: locale === 'he' ? 'העמקה והרחבה' : 'Deepen and expand',
        task_templates: templates.expand,
        weigh_in: true,
      },
      {
        start_day: 57,
        end_day: 77,
        focus: locale === 'he' ? 'שמירה תחת לחץ' : 'Maintain under pressure',
        task_templates: templates.maintain,
        weigh_in: true,
      },
      {
        start_day: 78,
        end_day: 90,
        focus: locale === 'he' ? 'ייצוב לטווח ארוך' : 'Long-term stabilization',
        task_templates: templates.stabilize,
        weigh_in: true,
      },
    ],
  };
}

function buildCategoryTaskTemplates(
  wizard: HealthWizardContextInput,
  locale: AppLocale
) {
  const {category, metrics} = wizard;
  const isGain =
    wizard.weight_direction === 'gain' ||
    wizard.secondary_focus === 'weight_gain' ||
    (category === 'weight' && metrics.target_value > metrics.baseline_value);

  if (category === 'nutrition' || wizard.secondary_focus) {
    return nutritionTemplates(locale, isGain);
  }

  switch (category) {
    case 'fitness':
      return fitnessTemplates(locale);
    case 'sleep':
      return sleepTemplates(locale);
    case 'weight':
      return weightTemplates(locale, isGain);
    case 'energy':
      return energyTemplates(locale);
    default:
      return nutritionTemplates(locale, false);
  }
}

function nutritionTemplates(locale: AppLocale, isGain: boolean) {
  const meal =
    locale === 'he'
      ? isGain
        ? 'הכן ואכול ארוחת ערב מלאה (חלבון + פחמימה + ירק)'
        : 'הכן ארוחה מאוזנת (חלבון + ירק + מנת פחמימה מודעת)'
      : isGain
        ? 'Prepare and eat a full evening meal (protein + carbs + vegetables)'
        : 'Prepare a balanced meal (protein + vegetables + mindful carbs)';

  const plan =
    locale === 'he'
      ? 'תכנן מראש מה תאכל בארוחת הערב (3 מרכיבים)'
      : 'Plan what you will eat for evening meal (3 components)';

  const track =
    locale === 'he' ? 'סמן ביומן: האם אכלת 2 ארוחות היום' : 'Log whether you had 2 meals today';

  const base = [
    {title: meal, description: locale === 'he' ? '15 דקות, בלי מסכים' : '15 minutes, no screens', estimated_minutes: 15, difficulty: 'easy' as const},
    {title: plan, description: locale === 'he' ? '5 דקות לפני הארוחה' : '5 minutes before the meal', estimated_minutes: 5, difficulty: 'easy' as const},
  ];

  return {
    base,
    consistency: [...base, {title: track, description: '', estimated_minutes: 5, difficulty: 'easy' as const}],
    expand: base,
    maintain: base,
    stabilize: [{title: track, description: '', estimated_minutes: 5, difficulty: 'easy' as const}],
  };
}

function fitnessTemplates(locale: AppLocale) {
  const walk =
    locale === 'he'
      ? 'הליכה או תנועה קלה'
      : 'Walk or light movement';
  const t = [
    {
      title: walk,
      description: locale === 'he' ? '8 דקות ברצף' : '8 minutes continuously',
      estimated_minutes: 8,
      difficulty: 'easy' as const,
    },
  ];
  return {base: t, consistency: t, expand: t, maintain: t, stabilize: t};
}

function sleepTemplates(locale: AppLocale) {
  const windDown =
    locale === 'he'
      ? 'שגרת הרגעה לפני שינה'
      : 'Wind-down routine before sleep';
  const t = [
    {
      title: windDown,
      description: locale === 'he' ? 'כיבוי מסכים + 5 נשימות' : 'Screens off + 5 breaths',
      estimated_minutes: 10,
      difficulty: 'easy' as const,
    },
  ];
  return {base: t, consistency: t, expand: t, maintain: t, stabilize: t};
}

function weightTemplates(locale: AppLocale, isGain: boolean) {
  return nutritionTemplates(locale, isGain);
}

function energyTemplates(locale: AppLocale) {
  const hydrate =
    locale === 'he' ? 'שתה כוס מים + מתיחה קצרה' : 'Drink water + brief stretch';
  const t = [
    {title: hydrate, description: '', estimated_minutes: 5, difficulty: 'easy' as const},
  ];
  return {base: t, consistency: t, expand: t, maintain: t, stabilize: t};
}

export function healthFallbackStepTitle(
  domain: 'health',
  goalTitle: string,
  healthContext: HealthGoalContext | null | undefined,
  locale: AppLocale
): string {
  if (!healthContext?.execution_plan?.phases?.[0]?.task_templates?.[0]) {
    if (healthContext?.category === 'fitness') {
      return locale === 'he'
        ? `הליכה או תנועה 8 דקות — ${goalTitle}`
        : `Walk or move 8 minutes — ${goalTitle}`;
    }
    return locale === 'he'
      ? `צעד בריאות קטן — ${goalTitle}`
      : `Small health step — ${goalTitle}`;
  }

  const template = healthContext.execution_plan.phases[0].task_templates[0];
  const prefix = formatAnchorPrefix(healthContext.anchor, locale);
  return `${prefix}, ${template.title}`.slice(0, 180);
}
