import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  countGoals,
  createGoalBundle,
  linkFormulationCreatedGoal,
  listGoals,
  listMilestonesForGoal,
} from '@/lib/life-coach/repository';
import {toGoalResponse, toGoalsWithMilestonesResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonMutation, jsonOk, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {goalBundleCreateInputSchema} from '@/lib/life-coach/schemas';
import {formatGoalCreateError, sanitizeGoalBundleInput} from '@/lib/life-coach/sanitize-goal-bundle';
import {offsetCapMetadata, parseLimitOffset} from '@/lib/list-pagination';
import {randomUUID} from 'crypto';

const DEFAULT_GOALS_LIMIT = 100;
const MAX_GOALS_LIMIT = 200;

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {limit, offset, requestedOffset, offsetCapped} = parseLimitOffset(
    new URL(request.url).searchParams,
    {defaultLimit: DEFAULT_GOALS_LIMIT, maxLimit: MAX_GOALS_LIMIT}
  );

  if (offsetCapped) {
    console.warn(
      `[goals] offset capped at 10000 (requested ${requestedOffset}, user ${current.user.id})`
    );
  }

  try {
    const [goals, total_count] = await Promise.all([
      listGoals({userId: current.user.id, limit, offset}),
      countGoals({userId: current.user.id}),
    ]);
    const withMilestones = await Promise.all(
      goals.map(async (goal) => ({
        ...goal,
        milestones: await listMilestonesForGoal(goal.id, current.user.id),
      }))
    );

    return jsonOk({
      goals: toGoalsWithMilestonesResponse(withMilestones),
      limit,
      offset,
      total_count,
      ...offsetCapMetadata(requestedOffset, offsetCapped),
    });
  } catch (error) {
    return jsonError('Could not load goals.', 500, String(error));
  }
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, goalBundleCreateInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const bundle = sanitizeGoalBundleInput(parsed.data);
  const idempotencyKey = parsed.data.idempotency_key ?? randomUUID();

  try {
    const today = startOfToday();
    const goal = await createGoalBundle(
      current.user.id,
      bundle.goal,
      bundle.milestones,
      bundle.initial_steps.map((step) => ({...step, goal_id: null})),
      today,
      {idempotencyKey}
    );
    if (bundle.formulation_session_id) {
      linkFormulationCreatedGoal(current.user.id, bundle.formulation_session_id, goal.id);
    }

    return jsonMutation({goal: toGoalResponse(goal)}, 201);
  } catch (error) {
    return jsonError('Could not create goal.', 500, formatGoalCreateError(error));
  }
}
