import {dateToYMD} from '@/lib/date-utils';
import {z} from 'zod';
import type {AppLocale} from '@/i18n/config';
import {
  DAILY_STEP_DIFFICULTIES,
  LIFE_DOMAINS,
  type DailyBabyStep,
  type DailyStepDifficulty,
  type LifeDomain,
  type StructuredDailyBabyStep,
} from '@/lib/life-coach/types';

const STEP_MIN_MINUTES = 5;
const STEP_MAX_MINUTES = 20;

const stepDifficultySchema = z.enum(DAILY_STEP_DIFFICULTIES);
const stepDomainSchema = z.enum(LIFE_DOMAINS);

const stepContractFallbackSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(500),
  estimated_minutes: z.coerce.number().int().min(1).max(5),
});

import {detectFakeProgress, hasRealDeliverable} from '@/lib/life-coach/no-fluff';
import {detectVagueTask, VAGUE_TASK_PATTERNS} from '@/lib/life-coach/vague-task-detection';
import {clampStepReasoning, MAX_STEP_REASONING_LENGTH} from '@/lib/life-coach/step-reasoning';

const MAX_PAIN_ADDRESSED_LENGTH = 220;

const GENERIC_PAIN_PATTERNS = [
  /\b(helps? you|feel better|stay motivated|general|overall wellness|improve life|be healthier)\b/i,
  /(עוזר|מוטיבציה|כללי|להרגיש יותר טוב|שיפור כללי|בריאות יותר טובה)/,
];

/** Internal engine field — which user pain/friction this step reduces. */
export function isValidPainAddressed(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length < 8 || trimmed.length > MAX_PAIN_ADDRESSED_LENGTH) return false;
  return !GENERIC_PAIN_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function refinePainAddressed(value: {pain_addressed: string}, ctx: z.RefinementCtx): void {
  if (!isValidPainAddressed(value.pain_addressed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'pain_addressed must name the specific pain/friction reduced — not generic motivation.',
      path: ['pain_addressed'],
    });
  }
}

const ACTION_SIGNAL_PATTERNS = [
  /\b(write|send|call|open|list|schedule|walk|read|complete|finish|start|prepare|set|block|drink|eat|sleep|message|email|text|buy|pack|clean|review|submit)\b/i,
  /\b(לכתוב|לשלוח|להתקשר|לפתוח|לרשום|לתזמן|ללכת|לקרוא|לסיים|להתחיל|להכין|לשתות|לאכול|לנקות|לבדוק|לעדכן|למלא|להודיע)\b/,
  /\d+\s*(min|minute|דק|דק׳|דקות)/i,
  /:\s*\S+/,
];

/** Reject motivational/vague steps without a concrete first action. */
export function hasClearAction(title: string, description: string): boolean {
  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  if (trimmedTitle.length < 4 || trimmedDesc.length < 8) return false;
  if (detectVagueTask(trimmedTitle, trimmedDesc)) return false;
  if (detectFakeProgress(trimmedTitle, trimmedDesc)) return false;
  if (!hasRealDeliverable(trimmedTitle, trimmedDesc)) return false;
  if (VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(trimmedTitle))) return false;
  if (!ACTION_SIGNAL_PATTERNS.some((pattern) => pattern.test(trimmedTitle))) {
    const wordCount = trimmedTitle.split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) return false;
  }
  return true;
}

function refineClearAction(
  value: {title: string; description: string},
  ctx: z.RefinementCtx
): void {
  if (!hasClearAction(value.title, value.description)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Step must name a concrete, startable action in title — not vague motivation only.',
      path: ['title'],
    });
  }
}

const stepContractCoreSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(8).max(1000),
    estimated_minutes: z.coerce.number().int().min(STEP_MIN_MINUTES).max(STEP_MAX_MINUTES),
    difficulty: stepDifficultySchema,
    why_this_step: z.string().trim().min(8).max(MAX_STEP_REASONING_LENGTH),
    expected_resistance: z.string().trim().min(8).max(300),
    pain_addressed: z.string().trim().min(8).max(MAX_PAIN_ADDRESSED_LENGTH),
    fallback_step: stepContractFallbackSchema,
    success_signal: z.string().trim().min(8).max(300),
  })
  .superRefine(refineClearAction)
  .superRefine(refinePainAddressed);

export type StepContract = z.infer<typeof stepContractCoreSchema>;

export const goalBreakdownStepContractSchema = stepContractCoreSchema;

export const aiDailyStepContractSchema = stepContractCoreSchema.extend({
  domain: stepDomainSchema,
  goal_id: z.string().uuid().nullable(),
});

export type AiDailyStepContract = z.infer<typeof aiDailyStepContractSchema>;

export function stepContractToStructured(
  step: StepContract,
  meta: {domain: LifeDomain; goal_id: string | null}
): StructuredDailyBabyStep {
  return {
    domain: meta.domain,
    goal_id: meta.goal_id,
    title: step.title,
    description: step.description,
    estimated_minutes: step.estimated_minutes,
    difficulty: step.difficulty,
    reasoning: clampStepReasoning(step.why_this_step) ?? step.why_this_step,
    expected_resistance: step.expected_resistance,
    pain_addressed: step.pain_addressed,
    success_signal: step.success_signal,
    fallback_title: step.fallback_step.title,
    fallback_description: step.fallback_step.description,
    fallback_estimated_minutes: step.fallback_step.estimated_minutes,
  };
}

export function aiDailyStepContractToStructured(step: AiDailyStepContract): StructuredDailyBabyStep {
  return stepContractToStructured(step, {domain: step.domain, goal_id: step.goal_id});
}

export function buildFallbackStepContract(input: {
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty?: DailyStepDifficulty;
  locale: AppLocale;
  why?: string;
  resistance?: string;
  pain?: string;
  success?: string;
}): StepContract {
  const he = input.locale === 'he';
  const minutes = Math.max(5, Math.min(20, input.estimated_minutes));
  const shortTitle =
    input.title.length > 56 ? `${input.title.slice(0, 53).trim()}…` : input.title.trim();

  return {
    title: input.title,
    description: input.description,
    estimated_minutes: minutes,
    difficulty: input.difficulty ?? 'easy',
    why_this_step:
      input.why ??
      (he
        ? 'נבחר כי זה הצעד הקטן הבא — פעולה אחת ברורה.'
        : 'Chosen because this is the next small step — one clear action.'),
    expected_resistance:
      input.resistance ??
      (he ? 'עייפות או עומס — Plan B מוכן.' : 'Fatigue or overload — Plan B is ready.'),
    pain_addressed:
      input.pain ??
      (he
        ? 'מוריד חיכוך ומונע הימנעות ממשימות גדולות מדי.'
        : 'Reduces friction and prevents avoidance of oversized tasks.'),
    fallback_step: {
      title: he ? `2 דק׳: ${shortTitle}` : `2 min: ${shortTitle}`,
      description: he
        ? 'גרסת Plan B — רק הצעד הראשון.'
        : 'Plan B — just the first move.',
      estimated_minutes: 2,
    },
    success_signal:
      input.success ??
      (he ? 'סימנתי שהתחלתי או סיימתי את הפעולה.' : 'I started or finished the action.'),
  };
}

export const STEP_CONTRACT_PROMPT_BLOCK = [
  '## Step contract (REQUIRED for every daily_baby_steps[] item and every steps[] item):',
  'Return structured objects only — never free text blobs. Each step MUST include ALL fields:',
  '- title: imperative, concrete first action (verb + object), startable in under 30 seconds',
  '- description: what to do, where, and done-when in 1-2 sentences',
  '- estimated_minutes: integer 5-20',
  '- difficulty: easy | medium | hard',
  `- why_this_step: max ${MAX_STEP_REASONING_LENGTH} chars. REQUIRED user-facing reason — one short sentence shown in UI. Base on latest_morning_ritual (mood, energy, momentum), blocker, active goal, or life context. Start with "נבחר כי" (he) or "Chosen because" (en). Reject generic lines like "this helps you grow".`,
  '- expected_resistance: likely blocker (time, energy, avoidance)',
  '- pain_addressed: internal — which specific pain/friction this step reduces (not shown to user). Must answer "what pain does this shrink?" Example pain: "I cannot stay consistent because everything feels too big" → task: "Do a 5-minute version only" → pain_addressed: "Reduces friction and prevents avoidance". Reject generic pain like "helps you feel better".',
  '- fallback_step: { title, description, estimated_minutes } — 2-minute Plan B',
  '- success_signal: observable signal the step is done',
  'Reject vague titles like "be more consistent" or "work on mindset" — name the physical action.',
  'Banned phrasing: work on, improve, think about, be better, להשתפר, לעבוד על — rewrite as a ≤10 min physical/measurable action.',
  'No fake progress: every step must end in a deliverable (decision, message sent, short list, physical action, environmental change, specific choice, measurement, or timed minutes).',
].join('\n');

export function goalBabyStepsFromContracts(
  contracts: StepContract[]
): Array<Omit<StructuredDailyBabyStep, 'domain' | 'goal_id'>> {
  return contracts.map((contract) => {
    const {domain: _domain, goal_id: _goalId, ...rest} = stepContractToStructured(contract, {
      domain: 'health',
      goal_id: null,
    });
    return rest;
  });
}

export type StepContractQualityMetrics = {
  ai_steps: number;
  completion_rate: number;
  edit_rate: number;
  quality_index: number;
  unclear_task_skip_rate: number;
  validation_fallback_rate: number;
};

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

/** Step quality from AI-generated steps: completion vs manual edits before action. */
export function computeStepContractQuality(
  steps: DailyBabyStep[],
  windowDays = 14
): StepContractQualityMetrics | null {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const aiSteps = steps.filter((s) => s.scheduled_date >= since && s.generated_by_ai);
  if (aiSteps.length === 0) return null;

  const edited = aiSteps.filter((s) => s.user_edited).length;
  const completed = aiSteps.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  ).length;
  const actionable = aiSteps.filter((s) => s.status !== 'pending').length;
  const skippedUnclear = aiSteps.filter(
    (s) => s.status === 'skipped' && s.blocker_reason === 'unclear_task'
  ).length;
  const skippedTotal = aiSteps.filter((s) => s.status === 'skipped').length;
  const validationFallback = aiSteps.filter((s) => s.validation_fallback_applied).length;

  const completion_rate =
    actionable > 0 ? Math.round((completed / actionable) * 100) / 100 : 0;
  const edit_rate = Math.round((edited / aiSteps.length) * 100) / 100;
  const unclear_task_skip_rate =
    skippedTotal > 0 ? Math.round((skippedUnclear / skippedTotal) * 100) / 100 : 0;
  const validation_fallback_rate =
    Math.round((validationFallback / aiSteps.length) * 100) / 100;
  const quality_index =
    Math.round(completion_rate * (1 - edit_rate * 0.5) * 100) / 100;

  return {
    ai_steps: aiSteps.length,
    completion_rate,
    edit_rate,
    quality_index,
    unclear_task_skip_rate,
    validation_fallback_rate,
  };
}
