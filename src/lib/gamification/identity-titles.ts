const IDENTITY_TITLES = ['builder', 'finisher', 'comebackArtist', 'strategist'] as const;
export type IdentityTitle = (typeof IDENTITY_TITLES)[number];

type Stats = {
  weeklyDone: number;
  allDoneToday: boolean;
  comebackChain: number;
  activeDomains: number;
  pendingEvening: number;
  recoveryRate?: number | null;
};

export function deriveIdentityTitle(stats: Stats): IdentityTitle | null {
  // recovery_rate from behavior profile must be meaningful (≥30%) for the title to ring true
  const recoveryRateQualifies = stats.recoveryRate == null || stats.recoveryRate >= 0.3;
  if (stats.comebackChain >= 2 && recoveryRateQualifies) return 'comebackArtist';
  if (stats.allDoneToday && stats.weeklyDone >= 3) return 'finisher';
  if (stats.activeDomains >= 3 && stats.weeklyDone >= 4) return 'strategist';
  if (stats.weeklyDone >= 2) return 'builder';
  return null;
}
