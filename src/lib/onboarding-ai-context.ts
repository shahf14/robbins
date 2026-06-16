import type {AppLocale} from '@/i18n/config';
import type {ParticipantGender} from '@/lib/formulation/participant-profile';
import type {CoachingStyle} from '@/lib/user-preferences';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeContextStatus,
  LifeDomain,
} from '@/lib/life-coach/types';
import type {
  FamilyStatus,
  PhysicalConsideration,
  PreferredActionWindow,
} from '@/lib/user-preferences';

/** Profile + schedule fields passed to onboarding AI routes. */
export type OnboardingAiContext = {
  locale: AppLocale;
  domain?: LifeDomain;
  domainScore?: number;
  availableTime: AvailableTimePerDay;
  intensityPreference: IntensityPreference;
  coachingStyle: CoachingStyle;
  familyStatus: FamilyStatus | '';
  age?: number;
  gender: ParticipantGender | null;
  lifeContextStatuses: LifeContextStatus[];
  wakeTime: string;
  sleepTime: string;
  preferredActionWindow: PreferredActionWindow;
  physicalConsiderations: PhysicalConsideration[];
};

export function buildOnboardingAiContext(input: {
  locale: AppLocale;
  availableTime: AvailableTimePerDay;
  intensityPreference: IntensityPreference;
  coachingStyle: CoachingStyle;
  familyStatus: FamilyStatus | '';
  age: string;
  agePreferNot: boolean;
  gender: ParticipantGender | null;
  lifeContextStatuses: LifeContextStatus[];
  wakeTime: string;
  sleepTime: string;
  preferredActionWindow: PreferredActionWindow;
  physicalConsiderations: PhysicalConsideration[];
  domain?: LifeDomain;
  domainScore?: number;
}): OnboardingAiContext {
  const parsedAge = input.age && !input.agePreferNot ? parseInt(input.age, 10) : undefined;
  return {
    locale: input.locale,
    domain: input.domain,
    domainScore: input.domainScore,
    availableTime: input.availableTime,
    intensityPreference: input.intensityPreference,
    coachingStyle: input.coachingStyle,
    familyStatus: input.familyStatus,
    age: parsedAge && !Number.isNaN(parsedAge) ? parsedAge : undefined,
    gender: input.gender,
    lifeContextStatuses: input.lifeContextStatuses,
    wakeTime: input.wakeTime,
    sleepTime: input.sleepTime,
    preferredActionWindow: input.preferredActionWindow,
    physicalConsiderations: input.physicalConsiderations,
  };
}

export function onboardingAiContextPayload(ctx: OnboardingAiContext): Record<string, unknown> {
  return {
    locale: ctx.locale,
    availableTime: ctx.availableTime,
    intensityPreference: ctx.intensityPreference,
    coachingStyle: ctx.coachingStyle,
    familyStatus: ctx.familyStatus || undefined,
    age: ctx.age,
    gender: ctx.gender ?? undefined,
    lifeContextStatuses: ctx.lifeContextStatuses.length ? ctx.lifeContextStatuses : undefined,
    wakeTime: ctx.wakeTime,
    sleepTime: ctx.sleepTime,
    preferredActionWindow: ctx.preferredActionWindow,
    physicalConsiderations: ctx.physicalConsiderations.length
      ? ctx.physicalConsiderations
      : undefined,
    domainScore: ctx.domainScore,
  };
}
