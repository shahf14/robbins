import type {DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';

export function filterStepsForDomain<T extends {domain: LifeDomain}>(
  steps: T[],
  domain?: LifeDomain
): T[] {
  return domain ? steps.filter((step) => step.domain === domain) : steps;
}

/** Pending AI steps that should block another generate call without force. */
export function hasReusablePendingAiSteps(
  steps: Array<Pick<DailyBabyStep, 'domain' | 'generated_by_ai' | 'status'>>,
  domain?: LifeDomain
): boolean {
  const scoped = filterStepsForDomain(steps, domain);
  return scoped.some((step) => step.generated_by_ai && step.status === 'pending');
}
