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

export async function fetchFormulationCoachContext(): Promise<FormulationCoachContext> {
  try {
    const response = await fetch('/api/formulation/personalized-challenge', {
      headers: {'Content-Type': 'application/json'},
    });
    if (!response.ok) {
      return {challenge: null, load_adaptation: null, comeback_messaging: null, accountability: null, behavior_change: null, skip_adaptation: null};
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
  } catch {
    return {challenge: null, load_adaptation: null, comeback_messaging: null, accountability: null, behavior_change: null, skip_adaptation: null};
  }
}
