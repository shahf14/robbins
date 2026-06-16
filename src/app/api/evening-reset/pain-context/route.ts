import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {buildAccountabilityContext} from '@/lib/formulation/accountability-routing';
import {buildEveningResetPainContext} from '@/lib/evening-reset/pain-context';
import {buildEmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import {buildMeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {getLatestCompletedFormulation} from '@/lib/life-coach/repository';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  try {
    const session = await getLatestCompletedFormulation(current.user.id);
    if (!session) {
      return Response.json({
        pain_context: null,
        emotional_stage: null,
        meditation_recommendation: null,
        accountability: null,
      });
    }

    const pain_context = buildEveningResetPainContext(session);
    const emotional_stage = buildEmotionalStageRouting(session, session.locale);
    const meditation_recommendation = buildMeditationRecommendation(session, session.locale);
    const accountability = buildAccountabilityContext(session, session.locale);
    return Response.json({pain_context, emotional_stage, meditation_recommendation, accountability});
  } catch {
    return Response.json({
      pain_context: null,
      emotional_stage: null,
      meditation_recommendation: null,
      accountability: null,
    });
  }
}
