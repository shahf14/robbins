import {refreshWeeklyFocusesFromReview, persistWeeklyReviewWithFocusRefresh} from '@/lib/goal-decomposition-tree';
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
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import type {CoachingStyle} from '@/lib/user-preferences';
import type {AppLocale} from '@/i18n/config';
import {
  getUserGenerationContext,
  getUserParticipantProfile,
  hasWeeklyReviewForPeriod,
  listActiveGoalUsers,
} from '@/lib/life-coach/repository';
import {trailingSevenDayWindow, jsonError, jsonOk, verifyCronRequest} from '@/lib/life-coach/server';
import {logCronRun} from '@/lib/db/cron-log';
import {releaseCronLock, tryAcquireCronLock} from '@/lib/db/cron-lock';
import {consumeAiRateLimit, AiRateLimitExceededError} from '@/lib/ai-rate-limit';
import {getSupportContextForUser} from '@/lib/support-context/formulation-support-context';

const WEEKLY_REVIEW_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const unauthorized = verifyCronRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  if (!tryAcquireCronLock('weekly-review', WEEKLY_REVIEW_LOCK_TTL_MS)) {
    return jsonOk({ok: true, skipped: true, reason: 'lock_held'});
  }

  try {
    const userIds = await listActiveGoalUsers();
    let generatedCount = 0;
    let failedCount = 0;
    const errors: {userId: string; error: string}[] = [];
    const week = trailingSevenDayWindow();

    for (const userId of userIds) {
      try {
        const [context, profile, supportContext] = await Promise.all([
          getUserGenerationContext(userId),
          getUserParticipantProfile(userId),
          getSupportContextForUser(userId),
        ]);

        if (context.goals.length === 0) {
          continue;
        }
        if (await hasWeeklyReviewForPeriod(userId, week.start, week.end)) {
          continue;
        }

        try {
          consumeAiRateLimit({
            action: 'life-coach:weekly-review',
            userId,
            limit: 3,
            windowMs: 24 * 60 * 60 * 1000,
          });
        } catch (error) {
          if (error instanceof AiRateLimitExceededError) {
            continue;
          }
          throw error;
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
        });

        const {_metrics, ...reviewData} = review;
        persistWeeklyReviewWithFocusRefresh(
          userId,
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
        generatedCount += 1;
      } catch (error) {
        failedCount += 1;
        errors.push({userId, error: String(error)});
        console.error(`weekly-review cron failed for user ${userId}:`, error);
      }
    }

    logCronRun({
      job: 'weekly-review',
      status: failedCount === 0 ? 'success' : generatedCount === 0 ? 'failed' : 'partial',
      generatedCount,
      failedCount,
      errors,
    });
    return jsonOk({ok: true, generatedCount, failedCount, errors});
  } catch (error) {
    logCronRun({job: 'weekly-review', status: 'failed', generatedCount: 0, failedCount: 1, errors: [{userId: 'unknown', error: String(error)}]});
    return jsonError('Could not run weekly life coach cron.', 500, String(error));
  } finally {
    releaseCronLock('weekly-review');
  }
}
