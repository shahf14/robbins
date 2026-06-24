import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {z} from 'zod';
import {
  createDailyBabyStep,
  DailyStepRelationError,
  listDailyBabyStepsForDate,
  listDailyBabyStepsForRange,
} from '@/lib/life-coach/repository';
import {ensureAllActiveCommitmentSteps} from '@/lib/life-coach/ensure-active-commitment-steps';
import {
  dailyStepDifficultySchema,
  dailyStepStatusSchema,
  lifeDomainSchema,
} from '@/lib/life-coach/schemas';
import {isIsoDate, jsonError, jsonOk, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

const dailyStepCreateSchema = z.object({
  goal_id: z.string().uuid().nullable().optional(),
  domain: lifeDomainSchema,
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).optional().default(''),
  estimated_minutes: z.coerce.number().int().min(1).max(60),
  difficulty: dailyStepDifficultySchema,
  scheduled_date: z.string().date(),
  status: dailyStepStatusSchema.optional().default('pending'),
  generated_by_ai: z.boolean().optional().default(false),
  is_general: z.boolean().optional(),
});

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const domainParam = url.searchParams.get('domain');
  const isGeneralParam = url.searchParams.get('is_general');
  const domainFilter = domainParam ? lifeDomainSchema.safeParse(domainParam) : null;
  if (domainFilter && !domainFilter.success) {
    return jsonError('Unsupported domain.', 400);
  }
  if (
    isGeneralParam !== null &&
    isGeneralParam !== 'true' &&
    isGeneralParam !== 'false'
  ) {
    return jsonError('Invalid is_general. Expected true or false.', 400);
  }
  const isGeneralFilter =
    isGeneralParam === null ? null : isGeneralParam === 'true';

  function applyFilters(steps: Awaited<ReturnType<typeof listDailyBabyStepsForDate>>) {
    return steps.filter((step) => {
      if (domainFilter?.success && step.domain !== domainFilter.data) return false;
      if (isGeneralFilter !== null && step.is_general !== isGeneralFilter) return false;
      return true;
    });
  }

  if (start || end) {
    if (!start || !end || !isIsoDate(start) || !isIsoDate(end)) {
      return jsonError('Invalid date range. Expected start and end as YYYY-MM-DD.', 400);
    }
    if (start > end) {
      return jsonError('Invalid date range. start must be before or equal to end.', 400);
    }

    try {
      const steps = await listDailyBabyStepsForRange(start, end, current.user.id);
      return jsonOk({start, end, steps: applyFilters(steps)});
    } catch (error) {
      return jsonError('Could not load daily steps.', 500, String(error));
    }
  }

  const date = url.searchParams.get('date') || startOfToday();
  if (!isIsoDate(date)) {
    return jsonError('Invalid date. Expected YYYY-MM-DD.', 400);
  }

  try {
    await ensureAllActiveCommitmentSteps(current.user.id);
    const steps = await listDailyBabyStepsForDate(date, current.user.id);
    return jsonOk({date, steps: applyFilters(steps)});
  } catch (error) {
    return jsonError('Could not load daily steps.', 500, String(error));
  }
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, dailyStepCreateSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const step = await createDailyBabyStep(current.user.id, {
      ...parsed.data,
      goal_id: parsed.data.goal_id ?? null,
    });
    return jsonOk({step}, 201);
  } catch (error) {
    if (error instanceof DailyStepRelationError) {
      return jsonError(error.message, 400);
    }
    return jsonError('Could not create daily step.', 500, String(error));
  }
}
