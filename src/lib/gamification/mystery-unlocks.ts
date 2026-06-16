const INSIGHT_UNLOCK_INTERVAL = 3;

export type MysteryUnlock = {
  remaining: number;
  rewardKey: 'newInsight' | 'weeklyPattern' | 'domainTip';
};

export function computeMysteryUnlock(
  weeklyDone: number,
  hasWeeklyReview: boolean
): MysteryUnlock | null {
  if (weeklyDone === 0) return null;

  const mod = weeklyDone % INSIGHT_UNLOCK_INTERVAL;
  const remaining = mod === 0 ? INSIGHT_UNLOCK_INTERVAL : INSIGHT_UNLOCK_INTERVAL - mod;

  if (remaining === 0) return null;

  const rewardKey =
    weeklyDone >= 9 && !hasWeeklyReview
      ? 'weeklyPattern'
      : weeklyDone >= 6
        ? 'domainTip'
        : 'newInsight';

  return {remaining, rewardKey};
}
