export type IdentityMoment =
  | 'completed'
  | 'partial'
  | 'comeback'
  | 'recovery'
  | 'low_energy_win';

const KEYS: Record<IdentityMoment, string> = {
  completed: 'identity.completed',
  partial: 'identity.partial',
  comeback: 'identity.comeback',
  recovery: 'identity.recovery',
  low_energy_win: 'identity.lowEnergyWin',
};

export function identityMessageKey(moment: IdentityMoment): string {
  return KEYS[moment];
}

export function pickIdentityMoment(input: {
  status: 'completed' | 'partial' | 'skipped';
  reattempt?: boolean;
  energy?: number | null;
  stepMinutes?: number;
}): IdentityMoment | null {
  if (input.status === 'partial') return 'partial';
  if (input.status === 'completed') {
    if (input.reattempt) return 'comeback';
    if ((input.energy ?? 6) <= 4 || (input.stepMinutes ?? 10) <= 5) return 'low_energy_win';
    return 'completed';
  }
  return null;
}
