import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {buildAccountabilityContext} from '@/lib/formulation/accountability-routing';
import {buildBehaviorChangeContext} from '@/lib/formulation/behavior-change-tracking';
import {buildSkipAdaptationContext} from '@/lib/formulation/skip-adaptation-routing';
import {buildPersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import {buildLoadAdaptationContext, shouldHidePersonalizedChallenge} from '@/lib/formulation/load-adaptation-routing';
import {buildComebackMessaging} from '@/lib/formulation/comeback-messaging';
import {getLatestCompletedFormulation} from '@/lib/life-coach/repository';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  try {
    const session = await getLatestCompletedFormulation(current.user.id);
    if (!session) {
      return Response.json({
        challenge: null,
        load_adaptation: null,
        comeback_messaging: null,
        accountability: null,
        behavior_change: null,
        skip_adaptation: null,
      });
    }

    const load_adaptation = buildLoadAdaptationContext(session, session.locale);
    const challenge = shouldHidePersonalizedChallenge(load_adaptation)
      ? null
      : buildPersonalizedChallenge(session, session.locale);
    const comeback_messaging = buildComebackMessaging(session, session.locale);
    const accountability = buildAccountabilityContext(session, session.locale);
    const behavior_change = buildBehaviorChangeContext(session, session.locale);
    const skip_adaptation = buildSkipAdaptationContext(session, session.locale);
    return Response.json({challenge, load_adaptation, comeback_messaging, accountability, behavior_change, skip_adaptation});
  } catch {
    return Response.json({
      challenge: null,
      load_adaptation: null,
      comeback_messaging: null,
      accountability: null,
      behavior_change: null,
    });
  }
}
