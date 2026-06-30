import {mergeToneWithPersonalization} from '@/lib/ai-personalization-summary';
import {resolveDynamicCoachTone} from '@/lib/coach-tone';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import type {CoachingStyle} from '@/lib/user-preferences';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {refreshUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {buildKnownBlockersProfile} from '@/lib/life-coach/known-blockers';
import {
  detectRecurringBlockers,
  getLifeDomainState,
  getUserParticipantProfile,
  listRecentReflections,
} from '@/lib/life-coach/repository';
import {jsonError, jsonMutation, resolveLocale, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {aiStructureGoalRequestSchema} from '@/lib/life-coach/schemas';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, aiStructureGoalRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limited = enforceAiRateLimit({
    action: 'life-coach:structure-goal',
    userId: current.user.id,
    limit: 8,
  });
  if (limited) return limited;

  try {
    const [assessment, profile, reflections, recurringBlockers] = await Promise.all([
      getLifeDomainState(parsed.data.domain, current.user.id),
      getUserParticipantProfile(current.user.id),
      listRecentReflections(14, current.user.id),
      Promise.resolve(detectRecurringBlockers(current.user.id, 14)),
    ]);
    const behaviorProfile = refreshUserBehaviorProfile(
      current.user.id,
      profile.preferred_action_window ?? 'flexible'
    );

    const knownBlockers = buildKnownBlockersProfile({
      assessment,
      life_context_statuses: profile.life_context_statuses,
      reflections,
      recurringBlockers,
      behaviorProfile,
      raw_goal: parsed.data.raw_goal,
      motivation: parsed.data.motivation,
      constraints: parsed.data.constraints,
    });
    const locale = resolveLocale(profile.preferred_language ?? null);
    const baseStyle = (profile.coaching_style ?? 'supportive') as CoachingStyle;
    const dynamicTone = resolveDynamicCoachTone(current.user.id, baseStyle, locale);
    const mergedTone = mergeToneWithPersonalization(
      {
        preferred_tone: dynamicTone.preferred_tone,
        avoid_tone: dynamicTone.avoid_tone,
      },
      profile.ai_personalization_summary
    );
    const plan = await openaiLifeCoachService.structureGoal({
      locale,
      domain: parsed.data.domain,
      assessment,
      raw_goal: parsed.data.raw_goal,
      deadline: parsed.data.deadline,
      motivation: parsed.data.motivation,
      constraints: parsed.data.constraints,
      life_context_statuses: profile.life_context_statuses,
      coaching_style: dynamicTone.effective_style,
      preferred_tone: mergedTone.preferred_tone,
      avoid_tone: mergedTone.avoid_tone,
      age: profile.age,
      gender: profile.gender,
      known_blockers: knownBlockers,
      ai_personalization_summary: profile.ai_personalization_summary ?? null,
      user_behavior_profile: behaviorProfile,
    });

    return jsonMutation({
      goal: {
        domain: parsed.data.domain,
        domain_category: parsed.data.domain_category ?? null,
        title: plan.goal_title,
        description: plan.goal_description,
        success_metric: plan.success_metric,
        deadline: plan.deadline,
        status: 'active',
        created_by: 'ai',
      },
      milestones: plan.milestones,
      suggested_baby_steps: plan.daily_baby_steps.map((step) => ({
        ...step,
        domain: parsed.data.domain,
        goal_id: null,
      })),
      realism_check: plan.realism_check ?? null,
      next_best_action: plan.next_best_action ?? null,
    });
  } catch (error) {
    return jsonError('Could not structure goal.', 500, String(error));
  }
}
