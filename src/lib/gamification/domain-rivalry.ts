import type {DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';

export type DomainRivalrySnapshot = {
  leader: LifeDomain;
  leaderCount: number;
  challenger: LifeDomain;
  challengerCount: number;
  gap: number;
};

export function computeDomainRivalry(weekSteps: DailyBabyStep[]): DomainRivalrySnapshot | null {
  const completed = weekSteps.filter((s) => s.status === 'completed');
  if (completed.length < 2) return null;

  const counts = new Map<LifeDomain, number>();
  for (const domain of LIFE_DOMAINS) {
    counts.set(domain, 0);
  }
  for (const step of completed) {
    counts.set(step.domain, (counts.get(step.domain) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length < 2) return null;

  const [leader, leaderCount] = ranked[0];
  const [challenger, challengerCount] = ranked[1];

  return {
    leader,
    leaderCount,
    challenger,
    challengerCount,
    gap: leaderCount - challengerCount,
  };
}
