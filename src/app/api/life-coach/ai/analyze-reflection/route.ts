import {saveReflectionAnalysis} from '@/lib/reflection-analysis';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {
  createAiInsight,
  getUserGenerationContext,
  getUserParticipantProfile,
} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, resolveLocale, startOfToday} from '@/lib/life-coach/server';
import {reflectionCreateInputSchema} from '@/lib/life-coach/schemas';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsed = reflectionCreateInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Invalid reflection payload.', 400, parsed.error.flatten());
  }

  const limited = enforceAiRateLimit({
    action: 'life-coach:analyze-reflection',
    userId: current.user.id,
    limit: 10,
  });
  if (limited) return limited;

  try {
    const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : null);
    const [context, profile] = await Promise.all([
      getUserGenerationContext(current.user.id),
      getUserParticipantProfile(current.user.id),
    ]);
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
    await Promise.all([
      Promise.resolve(
        saveReflectionAnalysis(current.user.id, reflectionDate, analysisData)
      ),
      createAiInsight(current.user.id, {
        insight_type: 'pattern',
        content: analysisData.patterns.join('\n'),
        metadata: analysisData,
        tokens_used: _metrics.tokens_used,
        generation_duration_ms: _metrics.generation_duration_ms,
        model_used: _metrics.model_used,
      }),
      createAiInsight(current.user.id, {
        insight_type: 'recommendation',
        content: analysisData.recommendations.join('\n'),
        metadata: analysisData,
      }),
    ]);

    return jsonOk({analysis: analysisData});
  } catch (error) {
    return jsonError('Could not analyze reflection.', 500, String(error));
  }
}
