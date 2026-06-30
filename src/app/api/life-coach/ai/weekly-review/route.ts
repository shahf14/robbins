import {persistWeeklyReviewWithFocusRefresh} from '@/lib/goal-decomposition-tree';
import {mergeToneWithPersonalization} from '@/lib/ai-personalization-summary';
import {
  resolveDynamicCoachTone,
  saveToneEffectiveness,
  tonePersonalizationForPrompt,
} from '@/lib/coach-tone';
import {computeWeeklyPatternMining} from '@/lib/life-coach/weekly-pattern-mining';
import {
  analyzeWeekBehaviorChange,
} from '@/lib/formulation/behavior-change-tracking';
import {
  analyzeReturningBarrierWeek,
} from '@/lib/formulation/skip-adaptation-routing';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import type {CoachingStyle} from '@/lib/user-preferences';
import {
  getUserGenerationContext,
  getUserParticipantProfile,
  hasWeeklyReviewForPeriod,
} from '@/lib/life-coach/repository';
import {getSupportContextForUser} from '@/lib/support-context/formulation-support-context';
import {trailingSevenDayWindow, jsonError, jsonOk, parseLifeCoachJsonBody, resolveLocale} from '@/lib/life-coach/server';
import {listMorningRitualSessions} from '@/lib/db/repositories/morning-rituals';
import {summarizeMorningRitualsForWeek} from '@/lib/life-coach/morning-ritual-weekly-summary';
import {listCheckinRowsForPeriod} from '@/lib/db/repositories/checkins';
import {summarizeCheckinsForWeek} from '@/lib/life-coach/checkin-weekly-summary';
import {computeStepValueFeedbackSummary} from '@/lib/step-value-feedback/summarize';
import {listGamificationUnlocksSince} from '@/lib/db/repositories/gamification-unlocks';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const bodyResult = await parseLifeCoachJsonBody<Record<string, unknown>>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = (bodyResult.data ?? {}) as Record<string, unknown>;

  try {
    const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : null);
    const [context, profile, supportContext] = await Promise.all([
      getUserGenerationContext(current.user.id),
      getUserParticipantProfile(current.user.id),
      getSupportContextForUser(current.user.id),
    ]);
    const week = trailingSevenDayWindow();
    const morningRitualSessions = listMorningRitualSessions(current.user.id, 14);
    const morning_ritual_summary = summarizeMorningRitualsForWeek(
      morningRitualSessions,
      week.start,
      week.end
    );
    const checkinRows = listCheckinRowsForPeriod(current.user.id, week.start, week.end);
    const checkin_weekly_summary = summarizeCheckinsForWeek(checkinRows);
    const step_value_feedback_summary = computeStepValueFeedbackSummary(context.dailySteps, 14);
    const weekLoot = listGamificationUnlocksSince(current.user.id, week.start).filter(
      (u) => u.kind === 'reflection_loot'
    );
    const lootCounts = weekLoot.reduce<Record<string, number>>((acc, u) => {
      const key = u.reward_key ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const reflection_loot_summary =
      weekLoot.length > 0
        ? {
            count: weekLoot.length,
            dominant_loot_type:
              Object.entries(lootCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          }
        : null;
    if (await hasWeeklyReviewForPeriod(current.user.id, week.start, week.end)) {
      return jsonError('Weekly review already exists for the current period.', 409);
    }

    const limited = enforceAiRateLimit({
      action: 'life-coach:weekly-review',
      userId: current.user.id,
      limit: 3,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (limited) return limited;

    const pattern_mining = computeWeeklyPatternMining({
      userId: current.user.id,
      locale,
      period_start: week.start,
      period_end: week.end,
      steps: context.dailySteps,
      reflections: context.reflections,
    });
    const baseCoachingStyle = (profile.coaching_style ?? 'supportive') as CoachingStyle;
    const dynamicTone = resolveDynamicCoachTone(current.user.id, baseCoachingStyle, locale);
    saveToneEffectiveness(current.user.id, dynamicTone.tone_effectiveness);
    const mergedTone = mergeToneWithPersonalization(
      {
        preferred_tone: dynamicTone.preferred_tone,
        avoid_tone: dynamicTone.avoid_tone,
      },
      profile.ai_personalization_summary
    );

    const loadAdaptation = supportContext.formulation.load_adaptation;
    const accountability = supportContext.formulation.accountability;
    const behavior_change = supportContext.formulation.behavior_change;
    const skip_adaptation = supportContext.formulation.skip_adaptation;
    let behavior_change_analysis = behavior_change
      ? analyzeWeekBehaviorChange({
          context: behavior_change,
          steps: context.dailySteps,
          reflections: context.reflections,
          periodStart: week.start,
          periodEnd: week.end,
          locale,
        })
      : null;
    const returning_barrier = analyzeReturningBarrierWeek({
      context: skip_adaptation,
      steps: context.dailySteps,
      reflections: context.reflections,
      periodStart: week.start,
      periodEnd: week.end,
      locale,
    });
    if (behavior_change_analysis && returning_barrier) {
      behavior_change_analysis = {
        ...behavior_change_analysis,
        returning_barrier_headline: returning_barrier.headline,
        returning_barrier_detail: returning_barrier.detail,
        detail_lines: [returning_barrier.detail, ...behavior_change_analysis.detail_lines],
      };
    }

    const review = await openaiLifeCoachService.generateWeeklyReview({
      locale,
      period_start: week.start,
      period_end: week.end,
      domainStates: context.domainStates,
      activeGoals: context.goals,
      recentSteps: context.dailySteps,
      recentReflections: context.reflections,
      life_context_statuses: profile.life_context_statuses,
      user_behavior_profile: context.behaviorProfile,
      recurring_blocker_patterns: context.recurringBlockers,
      execution_history: context.executionHistory,
      short_term_context: context.shortTermContext,
      long_term_profile: context.longTermProfile,
      pattern_mining,
      coaching_style: dynamicTone.effective_style,
      preferred_tone: mergedTone.preferred_tone,
      avoid_tone: mergedTone.avoid_tone,
      tone_personalization: tonePersonalizationForPrompt(dynamicTone),
      ai_personalization_summary: profile.ai_personalization_summary ?? null,
      load_adaptation: loadAdaptation,
      accountability,
      behavior_change,
      behavior_change_analysis,
      morning_ritual_summary,
      checkin_weekly_summary,
      step_value_feedback_summary,
      reflection_loot_summary,
    });

    const { _metrics, ...reviewData } = review;
    const insight = persistWeeklyReviewWithFocusRefresh(
      current.user.id,
      {
        insight_type: 'weekly_review',
        content: reviewData.summary,
        metadata: {...reviewData, period_start: week.start, period_end: week.end},
        tokens_used: _metrics.tokens_used,
        generation_duration_ms: _metrics.generation_duration_ms,
        model_used: _metrics.model_used,
      },
      {
        goals: context.goals,
        milestonesByGoalId: context.milestonesByGoalId,
        review: reviewData,
        periodEnd: week.end,
        locale,
      }
    );

    return jsonOk({review: reviewData, insight});
  } catch (error) {
    return jsonError('Could not generate weekly review.', 500, String(error));
  }
}
