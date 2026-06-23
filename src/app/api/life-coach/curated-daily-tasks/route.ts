import {z} from 'zod';
import {markUserOnboardingComplete} from '@/lib/life-coach/repository';
import {
  createDailyBabyStep,
  listDailyBabyStepsForDate,
} from '@/lib/life-coach/repository';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  curatedIdFromStepReasoning,
  curatedTaskToStructuredDailyStep,
  getCuratedDailyTaskOption,
  MAX_CURATED_STEPS_PER_DAY,
  suggestCuratedDailyTasks,
} from '@/lib/life-coach/curated-daily-tasks';
import type {CuratedDailyTaskOption} from '@/lib/life-coach/curated-daily-tasks';
import {lifeDomainSchema} from '@/lib/life-coach/schemas';
import {isIsoDate, jsonError, jsonOk, resolveLocale, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

const curatedSelectionSchema = z.object({
  domain: lifeDomainSchema,
  task_ids: z.array(z.string().trim().min(1)).min(1).max(3),
  date: z.string().date().optional(),
  locale: z.enum(['he', 'en']).optional(),
});

const selectionLocks = new Map<string, Promise<void>>();

async function withSelectionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = selectionLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  selectionLocks.set(key, queued);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (selectionLocks.get(key) === queued) {
      selectionLocks.delete(key);
    }
  }
}

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const url = new URL(request.url);
  const domain = lifeDomainSchema.safeParse(url.searchParams.get('domain'));
  if (!domain.success) {
    return jsonError('Invalid domain.', 400, domain.error.flatten());
  }

  const locale = resolveLocale(url.searchParams.get('locale'));
  const date = url.searchParams.get('date') || startOfToday();
  if (!isIsoDate(date)) {
    return jsonError('Invalid date. Expected YYYY-MM-DD.', 400);
  }

  try {
    const todaySteps = await listDailyBabyStepsForDate(date, current.user.id);
    const completedTaskIds = todaySteps
      .map((step) => curatedIdFromStepReasoning(step.reasoning))
      .filter((id): id is string => Boolean(id));
    const tasks = suggestCuratedDailyTasks({
      domain: domain.data,
      locale,
      completedTaskIds,
    });
    return jsonOk({domain: domain.data, date, tasks});
  } catch (error) {
    return jsonError('Could not load curated daily tasks.', 500, String(error));
  }
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const parsed = await parseLifeCoachJsonBody(request, curatedSelectionSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const locale = parsed.data.locale ?? 'he';
  const date = parsed.data.date ?? startOfToday();

  try {
    const requestedTaskIds = parsed.data.task_ids;
    if (new Set(requestedTaskIds).size !== requestedTaskIds.length) {
      return jsonError('curated_duplicate_ids', 400);
    }

    const selectedTasks: CuratedDailyTaskOption[] = [];
    for (const taskId of requestedTaskIds) {
      const task = getCuratedDailyTaskOption(taskId, locale);
      if (!task || task.world !== parsed.data.domain) {
        return jsonError(`Unknown curated task: ${taskId}`, 400);
      }
      selectedTasks.push(task);
    }

    return await withSelectionLock(`${current.user.id}:${date}`, async () => {
      const todaySteps = await listDailyBabyStepsForDate(date, current.user.id);
      const existingCuratedIds = new Set(
        todaySteps
          .map((step) => curatedIdFromStepReasoning(step.reasoning))
          .filter((id): id is string => Boolean(id))
      );
      const newTaskIds = selectedTasks
        .map((task) => task.id)
        .filter((taskId) => !existingCuratedIds.has(taskId));

      if (existingCuratedIds.size >= MAX_CURATED_STEPS_PER_DAY) {
        return jsonError('curated_max_reached', 409);
      }
      const slotsLeft = MAX_CURATED_STEPS_PER_DAY - existingCuratedIds.size;
      if (newTaskIds.length > slotsLeft) {
        return jsonError('curated_slots_exceeded', 400, {slotsLeft});
      }

      const inserted = [];

      for (const task of selectedTasks.filter((item) => newTaskIds.includes(item.id))) {
        const step = curatedTaskToStructuredDailyStep(task, date);
        inserted.push(
          await createDailyBabyStep(current.user.id, {
            goal_id: null,
            is_general: true,
            domain: step.domain,
            title: step.title,
            description: step.description,
            estimated_minutes: step.estimated_minutes,
            difficulty: step.difficulty,
            scheduled_date: date,
            status: 'pending',
            generated_by_ai: false,
            reasoning: step.reasoning,
            pain_addressed: step.pain_addressed,
            success_signal: step.success_signal,
          })
        );
        existingCuratedIds.add(task.id);
      }

      await markUserOnboardingComplete(current.user.id, parsed.data.domain, null);
      const steps = await listDailyBabyStepsForDate(date, current.user.id);
      return jsonOk({date, steps, inserted}, 201);
    });
  } catch (error) {
    return jsonError('Could not create today plan from curated tasks.', 500, String(error));
  }
}
