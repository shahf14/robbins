import {Suspense} from 'react';
import {FormulationSessionWizard} from '@/components/formulation/formulation-session';

export default function ClarificationPage() {
  return (
    <Suspense fallback={<div className="p-8 txt-muted">...</div>}>
      <FormulationSessionWizard />
    </Suspense>
  );
}
