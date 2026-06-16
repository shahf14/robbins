import type {DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';
import type {IdentityTitle} from './identity-titles';

export type DailyRollUp = {
  completedCount: number;
  totalMinutes: number;
  topDomain: LifeDomain | null;
  topDomainCount: number;
  identityTitle: IdentityTitle | null;
  comebackChain: number;
};

export function buildDailyRollUp(
  todaySteps: DailyBabyStep[],
  identityTitle: IdentityTitle | null,
  comebackChain: number
): DailyRollUp | null {
  const completed = todaySteps.filter((s) => s.status === 'completed');
  if (completed.length === 0) return null;

  const allDone = todaySteps.every((s) => s.status !== 'pending');
  if (!allDone) return null;

  const totalMinutes = completed.reduce(
    (sum, s) => sum + (s.actual_minutes ?? s.estimated_minutes),
    0
  );

  const domainCounts = new Map<LifeDomain, number>();
  for (const step of completed) {
    domainCounts.set(step.domain, (domainCounts.get(step.domain) ?? 0) + 1);
  }

  let topDomain: LifeDomain | null = null;
  let topDomainCount = 0;
  for (const [domain, count] of domainCounts) {
    if (count > topDomainCount) {
      topDomain = domain;
      topDomainCount = count;
    }
  }

  return {
    completedCount: completed.length,
    totalMinutes,
    topDomain,
    topDomainCount,
    identityTitle,
    comebackChain,
  };
}
