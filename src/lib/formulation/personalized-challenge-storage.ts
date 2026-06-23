import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';
import {throwIfNotOk} from '@/lib/http/api-response-error';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {BehaviorChangeContext} from '@/lib/formulation/behavior-change-tracking';
import type {SkipAdaptationContext} from '@/lib/formulation/skip-adaptation-routing';
import type {PersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import type {LoadAdaptationContext} from '@/lib/formulation/load-adaptation-routing';
import type {ComebackMessaging} from '@/lib/formulation/comeback-messaging';

export type FormulationCoachContext = {
  challenge: PersonalizedChallenge | null;
  load_adaptation: LoadAdaptationContext | null;
  comeback_messaging: ComebackMessaging | null;
  accountability: AccountabilityContext | null;
  behavior_change: BehaviorChangeContext | null;
  skip_adaptation: SkipAdaptationContext | null;
};

export async function fetchFormulationCoachContext(
  options?: {strict?: boolean}
): Promise<FormulationCoachContext> {
  const empty: FormulationCoachContext = {
    challenge: null,
    load_adaptation: null,
    comeback_messaging: null,
    accountability: null,
    behavior_change: null,
    skip_adaptation: null,
  };

  try {
    const response = await fetch('/api/formulation/personalized-challenge', {
      headers: mergeLocalAuthHeaders(),
    });
    if (options?.strict) {
      await throwIfNotOk(response);
    } else {
      observeAuthResponse(response);
      if (!response.ok) return empty;
    }
    const data = (await response.json()) as FormulationCoachContext;
    return {
      challenge: data.challenge ?? null,
      load_adaptation: data.load_adaptation ?? null,
      comeback_messaging: data.comeback_messaging ?? null,
      accountability: data.accountability ?? null,
      behavior_change: data.behavior_change ?? null,
      skip_adaptation: data.skip_adaptation ?? null,
    };
  } catch (error) {
    if (options?.strict) throw error;
    return empty;
  }
}
