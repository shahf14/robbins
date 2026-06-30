import {openaiFormulationService} from '@/lib/ai-formulation/openai-formulation-service';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {MicroGoalLlmError} from '@/lib/formulation/micro-goal-llm';
import {
  PROMPT_VERSIONS,
  persistFormulationDraftAiResult,
  persistFormulationExplorationAiResult,
} from '@/lib/formulation/persist-ai-action';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  getFormulationSession,
  updateFormulationSessionAiMetrics,
} from '@/lib/life-coach/repository';
import {toFormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import {formulationAiActionSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonMutation, resolveLocale, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const {id} = await params;
  const parsed = await parseLifeCoachJsonBody(request, formulationAiActionSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const session = await getFormulationSession(current.user.id, id);
    if (!session) {
      return jsonError('Session not found.', 404);
    }

    const locale = resolveLocale(parsed.data.locale ?? session.locale);
    const limited = enforceAiRateLimit({
      action: `formulation:${parsed.data.action}`,
      userId: current.user.id,
      limit: 8,
    });
    if (limited) return limited;

    if (parsed.data.action === 'generate_exploration_questions') {
      // Cache — skip LLM if session already has valid questions
      if (session.llm_exploration_questions.length === 15) {
        return jsonMutation({
          session: toFormulationSessionResponse(session),
          questions: session.llm_exploration_questions,
        });
      }

      const result = await openaiFormulationService.generateExplorationQuestions(
        session,
        locale
      );
      const updated = persistFormulationExplorationAiResult(
        current.user.id,
        id,
        result.questions,
        {
          action: 'generate_exploration_questions',
          tokens_used: result.metrics.tokens_used ?? undefined,
          model_used: result.metrics.model_used ?? undefined,
          generation_duration_ms: result.metrics.generation_duration_ms ?? undefined,
        },
        {
          insight_type: 'pattern',
          content: result.questions.map((q) => q.text).join('\n'),
          metadata: {
            source: 'formulation',
            formulation_session_id: id,
            action: 'generate_exploration_questions',
            prompt_version: PROMPT_VERSIONS.exploration,
            raw_llm_json: result.questions,
            validation_passed: result.validation_passed,
          },
          tokens_used: result.metrics.tokens_used,
          generation_duration_ms: result.metrics.generation_duration_ms,
          model_used: result.metrics.model_used,
        }
      );

      return jsonMutation({session: toFormulationSessionResponse(updated), questions: result.questions});
    }

    if (parsed.data.action === 'draft_formulation') {
      const result = await openaiFormulationService.draftFormulation(session, locale);
      const updated = persistFormulationDraftAiResult(
        current.user.id,
        id,
        result.formulation,
        {
          action: 'draft_formulation',
          tokens_used: result.metrics.tokens_used ?? undefined,
          model_used: result.metrics.model_used ?? undefined,
          generation_duration_ms: result.metrics.generation_duration_ms ?? undefined,
        },
        {
          insight_type: 'pattern',
          content: result.formulation.presenting_concern_user_words,
          metadata: {
            source: 'formulation',
            formulation_session_id: id,
            action: 'draft_formulation',
            prompt_version: PROMPT_VERSIONS.formulation,
            raw_llm_json: result.formulation,
            validation_passed: result.validation_passed,
          },
          tokens_used: result.metrics.tokens_used,
          generation_duration_ms: result.metrics.generation_duration_ms,
          model_used: result.metrics.model_used,
        }
      );

      return jsonMutation({session: toFormulationSessionResponse(updated), formulation: result.formulation});
    }

    if (parsed.data.action === 'suggest_micro_goal') {
      const result = await openaiFormulationService.suggestMicroGoal(session, locale);

      await updateFormulationSessionAiMetrics(current.user.id, id, {
        action: 'suggest_micro_goal',
        tokens_used: result.metrics.tokens_used ?? undefined,
        model_used: result.metrics.model_used ?? undefined,
        generation_duration_ms: result.metrics.generation_duration_ms ?? undefined,
      });

      return jsonMutation({
        suggestions: result.suggestions,
        generated_by: result.generated_by,
      });
    }

    return jsonError('Unsupported action.', 400);
  } catch (error) {
    if (error instanceof MicroGoalLlmError) {
      return jsonError(error.message, 503);
    }
    return jsonError('AI action failed.', 500, String(error));
  }
}
