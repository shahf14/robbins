import type {FormulationPhase} from '@/lib/life-coach/types';

/** Wizard steps shown in progress (excludes `complete`). */
export const WIZARD_PHASES: FormulationPhase[] = [
  'consent',
  'risk',
  'open',
  'dimensions',
  'exploration',
  'formulation',
  'goal',
];

export function previousWizardPhase(phase: FormulationPhase): FormulationPhase | null {
  const idx = WIZARD_PHASES.indexOf(phase);
  if (idx <= 0) return null;
  return WIZARD_PHASES[idx - 1] ?? null;
}

export function wizardPhaseNumber(phase: FormulationPhase): number {
  const idx = WIZARD_PHASES.indexOf(phase);
  return idx >= 0 ? idx + 1 : 1;
}
