import {refreshWeeklyFocusesFromReview} from '@/lib/goal-decomposition-tree';
import {mergeToneWithPersonalization} from '@/lib/ai-personalization-summary';
import {
  resolveDynamicCoachTone,
  saveToneEffectiveness,
  tonePersonalizationForPrompt,
} from '@/lib/coach-tone';
import {computeWeeklyPatternMining} from '@/lib/life-coach/weekly-pattern-mining';
import {buildAccountabilityContext} from '@/lib/formulation/accountability-routing';
import {
  analyzeWeekBehaviorChange,
  buildBehaviorChangeContext,
} from '@/lib/formulation/behavior-change-tracking';
import {
  analyzeReturningBarrierWeek,
  buildSkipAdaptationContext,
} from '@/lib/formulation/skip-adaptation-routing';
import {buildLoadAdaptationContext} from '@/lib/formulation/load-adaptation-routing';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import type {CoachingStyle} from '@/lib/user-preferences';
import type {AppLocale} from '@/i18n/config';
import {
  createAiInsight,
  getUserGenerationContext,
  getUserParticipantProfile,
  getLatestCompletedFormulation,
  hasWeeklyReviewForPeriod,
  listActiveGoalUsers,
} from '@/lib/life-coach/repository';
import {currentWeekWindow, jsonError, jsonOk, verifyCronRequest} from '@/lib/life-coach/server';

export async function POST(request: Request) {
  const unauthorized = verifyCronRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const userIds = await listActiveGoalUsers();
    let generatedCount = 0;
    const week = currentWeekWindow();

    for (const userId of userIds) {
      const [context, profile, formulation] = await Promise.all([
        getUserGenerationContext(userId),
        getUserParticipantProfile(userId),
        getLatestCompletedFormulation(userId).catch(() => null),
      ]);

      if (context.goals.length === 0) {
        continue;
      }
      if (await hasWeeklyReviewForPeriod(userId, week.start, week.end)) {
        continue;
      }

      const locale = (profile.preferred_language ?? 'he') as AppLocale;
      const pattern_mining = computeWeeklyPatternMining({
        userId,
        locale,
        period_start: week.start,
        period_end: week.end,
        steps: context.dailySteps,
        reflections: context.reflections,
      });

      const baseCoachingStyle = (profile.coaching_style ?? 'supportive') as CoachingStyle;
      const dynamicTone = resolveDynamicCoachTone(userId, baseCoachingStyle, locale);
      saveToneEffectiveness(userId, dynamicTone.tone_effectiveness);
      const mergedTone = mergeToneWithPersonalization(
        {
          preferred_tone: dynamicTone.preferred_tone,
          avoid_tone: dynamicTone.avoid_tone,
        },
        profile.ai_personalization_summary
      );

      const loadAdaptation = formulation
        ? buildLoadAdaptationContext(formulation, locale)
        : null;
      const accountability = formulation
        ? buildAccountabilityContext(formulation, locale)
        : null;
      const behavior_change = formulation
        ? buildBehaviorChangeContext(formulation, locale)
        : null;
      const skip_adaptation = formulation
        ? buildSkipAdaptationContext(formulation, locale)
        : null;
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
      });

      const { _metrics, ...reviewData } = review;
      refreshWeeklyFocusesFromReview(
        userId,
        context.goals,
        context.milestonesByGoalId,
        reviewData,
        week.end,
        locale
      );
      await createAiInsight(userId, {
        insight_type: 'weekly_review',
        content: reviewData.summary,
        metadata: {...reviewData, period_start: week.start, period_end: week.end},
        tokens_used: _metrics.tokens_used,
        generation_duration_ms: _metrics.generation_duration_ms,
        model_used: _metrics.model_used,
      });
      generatedCount += 1;
    }

    return jsonOk({ok: true, generatedCount});
  } catch (error) {
    return jsonError('Could not run weekly life coach cron.', 500, String(error));
  }
}
