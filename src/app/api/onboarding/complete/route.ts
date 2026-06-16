import {buildAiPersonalizationSummaryFromOnboarding} from '@/lib/ai-personalization-summary';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {markUserOnboardingComplete} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, resolveLocale} from '@/lib/life-coach/server';
import {onboardingCompleteRequestSchema} from '@/lib/onboarding-ai-schemas';

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = onboardingCompleteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid onboarding completion payload.', 400, parsed.error.flatten());
  }

  try {
    const locale = resolveLocale(parsed.data.locale ?? null);
    const summary = buildAiPersonalizationSummaryFromOnboarding({
      locale,
      primary_domain: parsed.data.primaryDomain ?? null,
      life_context_note: parsed.data.life_context_note,
      life_context_statuses: parsed.data.life_context_statuses,
      available_time: parsed.data.available_time,
      intensity_preference: parsed.data.intensity_preference,
      coaching_style: parsed.data.coaching_style,
      answers: parsed.data.answers,
      insight: parsed.data.insight,
      goal_title: parsed.data.goal_title,
      goal_description: parsed.data.goal_description,
      domain_score: parsed.data.domain_score,
    });

    await markUserOnboardingComplete(
      current.user.id,
      parsed.data.primaryDomain ?? null,
      summary
    );
    const completedAt = new Date().toISOString();
    return jsonOk({
      completedAt,
      primaryDomain: parsed.data.primaryDomain ?? null,
    });
  } catch (error) {
    return jsonError('Could not mark onboarding complete.', 500, String(error));
  }
}
