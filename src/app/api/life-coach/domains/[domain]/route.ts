import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getLatestWeeklyReview,
  getLifeDomainState,
  listDailyBabyStepsForDate,
  listGoals,
  listInsights,
  listMilestonesForGoal,
  listRecentDailyBabySteps,
} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, startOfToday} from '@/lib/life-coach/server';
import {lifeDomainSchema} from '@/lib/life-coach/schemas';
import {resolveDailyFocusContext} from '@/lib/daily-focus-context';
import {
  toAiCoachingInsightsResponse,
  toDailyBabyStepsResponse,
  toGoalsWithMilestonesResponse,
  toNullableAiCoachingInsightResponse,
  toNullableLifeDomainStateResponse,
} from '@/lib/life-coach/response-dtos';

export async function GET(
  request: Request,
  {params}: {params: Promise<{domain: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {domain: rawDomain} = await params;
  const parsedDomain = lifeDomainSchema.safeParse(rawDomain);

  if (!parsedDomain.success) {
    return jsonError('Unsupported domain.', 400);
  }

  try {
    const domain = parsedDomain.data;
    const today = startOfToday();
    const [state, goals, todaySteps, recentSteps, insights, weeklyReview, dailyFocus] = await Promise.all([
      getLifeDomainState(domain, current.user.id),
      listGoals({domain, userId: current.user.id}),
      listDailyBabyStepsForDate(today, current.user.id),
      listRecentDailyBabySteps(120, current.user.id),
      listInsights(undefined, current.user.id),
      getLatestWeeklyReview(current.user.id),
      resolveDailyFocusContext(current.user.id, today),
    ]);

    const goalsWithMilestones = await Promise.all(
      goals.map(async (goal) => ({
        ...goal,
        milestones: await listMilestonesForGoal(goal.id, current.user.id),
      }))
    );

    return jsonOk({
      domain,
      state: toNullableLifeDomainStateResponse(state),
      goals: toGoalsWithMilestonesResponse(goalsWithMilestones),
      todaySteps: toDailyBabyStepsResponse(todaySteps.filter((step) => step.domain === domain)),
      recentSteps: toDailyBabyStepsResponse(recentSteps),
      insights: toAiCoachingInsightsResponse(insights.slice(0, 6)),
      weeklyReview: toNullableAiCoachingInsightResponse(weeklyReview),
      dailyFocus,
    });
  } catch (error) {
    return jsonError('Could not load domain details.', 500, String(error));
  }
}
