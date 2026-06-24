import type {FormulationPhase, FormulationSession} from '@/lib/life-coach/types';

/** Wizard steps shown in progress (excludes `complete` and legacy `risk`). */
export const WIZARD_PHASES: FormulationPhase[] = [
  'consent',
  'open',
  'dimensions',
  'exploration',
  'formulation',
  'goal',
];

/** Map legacy risk step / crisis_stopped sessions onto the current wizard. */
export function normalizeWizardPhase(
  phase: FormulationPhase,
  status?: FormulationSession['status']
): FormulationPhase {
  if (phase === 'risk' || status === 'crisis_stopped') return 'open';
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
