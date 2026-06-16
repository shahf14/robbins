import {Suspense} from 'react';
import {FormulationSessionWizard} from '@/components/formulation/formulation-session';

export default function ClarificationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/50">...</div>}>
      <FormulationSessionWizard />
    </Suspense>
  );
}
