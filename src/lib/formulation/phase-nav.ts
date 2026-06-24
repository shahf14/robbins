import type {FormulationPhase, FormulationSession} from '@/lib/life-coach/types';

/** Wizard steps shown in progress (excludes `complete` and legacy `risk`). */
export const WIZARD_PHASES: FormulationPhase[] = [
  'consent',
  'open',
  'exploration',
  'formulation',
  'goal',
];

/** Map legacy wizard steps onto the current flow. */
export function normalizeWizardPhase(
  phase: FormulationPhase,
  status?: FormulationSession['status']
): FormulationPhase {
  if (phase === 'risk' || status === 'crisis_stopped') return 'open';
  if (phase === 'dimensions') return 'exploration';
  return phase;
}

export function previousWizardPhase(phase: FormulationPhase): FormulationPhase | null {
  const idx = WIZARD_PHASES.indexOf(phase);
  if (idx <= 0) return null;
  return WIZARD_PHASES[idx - 1] ?? null;
}

export function wizardPhaseNumber(phase: FormulationPhase): number {
  const idx = WIZARD_PHASES.indexOf(phase);
  return idx >= 0 ? idx + 1 : 1;
}
