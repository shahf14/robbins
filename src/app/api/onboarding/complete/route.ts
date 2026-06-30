import {buildAiPersonalizationSummaryFromOnboarding} from '@/lib/ai-personalization-summary';
import {markUserOnboardingComplete} from '@/lib/life-coach/repository';
import {jsonError, jsonMutation, resolveLocale} from '@/lib/life-coach/server';
import {onboardingCompleteRequestSchema} from '@/lib/onboarding-ai-schemas';
import {readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';

export async function POST(request: Request) {
  const bodyResult = await readAuthenticatedJsonBody(request, {
    schema: onboardingCompleteRequestSchema,
  });
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const locale = resolveLocale(bodyResult.data.locale ?? null);
    const summary = buildAiPersonalizationSummaryFromOnboarding({
      locale,
      primary_domain: bodyResult.data.primaryDomain ?? null,
      life_context_note: bodyResult.data.life_context_note,
      life_context_statuses: bodyResult.data.life_context_statuses,
      available_time: bodyResult.data.available_time,
      intensity_preference: bodyResult.data.intensity_preference,
      coaching_style: bodyResult.data.coaching_style,
      answers: bodyResult.data.answers,
      insight: bodyResult.data.insight,
      goal_title: bodyResult.data.goal_title,
      goal_description: bodyResult.data.goal_description,
      domain_score: bodyResult.data.domain_score,
    });

    await markUserOnboardingComplete(
      bodyResult.user.id,
      bodyResult.data.primaryDomain ?? null,
      summary
    );
    const completedAt = new Date().toISOString();
    return jsonMutation({
      completedAt,
      primaryDomain: bodyResult.data.primaryDomain ?? null,
    });
  } catch (error) {
    return jsonError('Could not mark onboarding complete.', 500, String(error));
  }
}
