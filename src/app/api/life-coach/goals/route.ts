import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {createGoalBundle, ensureCommitmentDailySteps, linkFormulationCreatedGoal, listGoals, listMilestonesForGoal} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {goalBundleCreateInputSchema} from '@/lib/life-coach/schemas';
import {formatGoalCreateError, sanitizeGoalBundleInput} from '@/lib/life-coach/sanitize-goal-bundle';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  try {
    const goals = await listGoals({userId: current.user.id});
    for (const goal of goals) {
      if (goal.status === 'active') {
        await ensureCommitmentDailySteps(current.user.id, goal);
      }
    }
    const withMilestones = await Promise.all(
      goals.map(async (goal) => ({
        ...goal,
        milestones: await listMilestonesForGoal(goal.id, current.user.id),
      }))
    );

    return jsonOk({goals: withMilestones});
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

  try {
    const today = startOfToday();
    const goal = await createGoalBundle(
      current.user.id,
      bundle.goal,
      bundle.milestones,
      bundle.initial_steps.map((step) => ({...step, goal_id: null})),
      today,
      {idempotencyKey: parsed.data.idempotency_key}
    );
    if (bundle.formulation_session_id) {
      linkFormulationCreatedGoal(current.user.id, bundle.formulation_session_id, goal.id);
    }

    return jsonOk({goal}, 201);
  } catch (error) {
    return jsonError('Could not create goal.', 500, formatGoalCreateError(error));
  }
}
