import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {
  saveReflectionAnalysisWithInsights,
  getUserGenerationContext,
  getUserParticipantProfile,
} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, resolveLocale, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {reflectionCreateInputSchema} from '@/lib/life-coach/schemas';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, reflectionCreateInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limited = enforceAiRateLimit({
    action: 'life-coach:analyze-reflection',
    userId: current.user.id,
    limit: 10,
  });
  if (limited) return limited;

  try {
    const [context, profile] = await Promise.all([
      getUserGenerationContext(current.user.id),
      getUserParticipantProfile(current.user.id),
    ]);
    const locale = resolveLocale(profile.preferred_language ?? null);
    const analysis = await openaiLifeCoachService.analyzeReflection({
      locale,
      date: parsed.data.date ?? startOfToday(),
      blocker_reason: parsed.data.blocker_reason,
      reflection_text: parsed.data.reflection_text || null,
      recentSteps: context.dailySteps,
      recentReflections: context.reflections,
      life_context_statuses: profile.life_context_statuses,
      user_behavior_profile: context.behaviorProfile,
      execution_history: context.executionHistory,
      short_term_context: context.shortTermContext,
      long_term_profile: context.longTermProfile,
    });

    const reflectionDate = parsed.data.date ?? startOfToday();
    const { _metrics, ...analysisData } = analysis;
    // Persist the analysis + derived insights atomically (see helper docs).
    saveReflectionAnalysisWithInsights(current.user.id, reflectionDate, analysisData, {
      tokens_used: _metrics.tokens_used,
      generation_duration_ms: _metrics.generation_duration_ms,
      model_used: _metrics.model_used,
    });

    return jsonOk({analysis: analysisData});
  } catch (error) {
    return jsonError('Could not analyze reflection.', 500, String(error));
  }
}
