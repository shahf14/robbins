import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {getDailyBabyStepById} from '@/lib/life-coach/repository';
import {skipRecoverySuggestInputSchema} from '@/lib/life-coach/schemas';
import {buildSkipRecoveryStep} from '@/lib/life-coach/simplify-step';
import {jsonError, jsonMutation, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import type {AppLocale} from '@/i18n/config';

export async function POST(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, skipRecoverySuggestInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {id} = await params;
  const step = getDailyBabyStepById(id, current.user.id);

  if (!step) {
    return jsonError('Daily step not found.', 404);
  }

  const locale = (parsed.data.locale ?? 'he') as AppLocale;
  const limited = enforceAiRateLimit({
    action: 'life-coach:skip-recovery',
    userId: current.user.id,
    limit: 20,
  });
  if (limited) return limited;

  try {
    const content = await openaiLifeCoachService.suggestSkipRecovery({
      locale,
      step,
      blocker_reason: parsed.data.blocker_reason,
    });
    return jsonMutation({content});
  } catch {
    return jsonMutation({content: buildSkipRecoveryStep(step, locale)});
  }
}
