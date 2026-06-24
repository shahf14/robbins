import {buildAccountabilityContext} from '@/lib/formulation/accountability-routing';
import {
  buildBehaviorChangeContext,
  type BehaviorChangeContext,
} from '@/lib/formulation/behavior-change-tracking';
import {buildComebackMessaging, type ComebackMessaging} from '@/lib/formulation/comeback-messaging';
import {buildLoadAdaptationContext, shouldHidePersonalizedChallenge} from '@/lib/formulation/load-adaptation-routing';
import type {LoadAdaptationContext} from '@/lib/formulation/load-adaptation-routing';
import {buildPersonalizedChallenge, type PersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import {buildSkipAdaptationContext, type SkipAdaptationContext} from '@/lib/formulation/skip-adaptation-routing';
import {getLatestCompletedFormulation} from '@/lib/life-coach/repository';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {FormulationSession} from '@/lib/life-coach/types';

export type FormulationCoachContext = {
  challenge: PersonalizedChallenge | null;
  load_adaptation: LoadAdaptationContext | null;
  comeback_messaging: ComebackMessaging | null;
  accountability: AccountabilityContext | null;
  behavior_change: BehaviorChangeContext | null;
  skip_adaptation: SkipAdaptationContext | null;
};

export type SupportContextForUser = {
  latestFormulation: FormulationSession | null;
  formulation: FormulationCoachContext;
};

export const EMPTY_FORMULATION_COACH_CONTEXT: FormulationCoachContext = {
  challenge: null,
  load_adaptation: null,
  comeback_messaging: null,
  accountability: null,
  behavior_change: null,
  skip_adaptation: null,
};

export function buildFormulationCoachContext(
  session: FormulationSession | null
): FormulationCoachContext {
  if (!session) return EMPTY_FORMULATION_COACH_CONTEXT;

  const load_adaptation = buildLoadAdaptationContext(session, session.locale);
  return {
    challenge: shouldHidePersonalizedChallenge(load_adaptation)
      ? null
      : buildPersonalizedChallenge(session, session.locale),
    load_adaptation,
    comeback_messaging: buildComebackMessaging(session, session.locale),
    accountability: buildAccountabilityContext(session, session.locale),
    behavior_change: buildBehaviorChangeContext(session, session.locale),
    skip_adaptation: buildSkipAdaptationContext(session, session.locale),
  };
}

export async function getSupportContextForUser(userId: string): Promise<SupportContextForUser> {
  const latestFormulation = await getLatestCompletedFormulation(userId).catch(() => null);
  return {
    latestFormulation,
    formulation: buildFormulationCoachContext(latestFormulation),
  };
}
