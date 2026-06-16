'use client';

import {useTranslations} from 'next-intl';

export function StepNavigation({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  backLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
}) {
  const t = useTranslations('morningRitual');

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        className="focus-ring btn-secondary"
        type="button"
        onClick={onBack}
      >
        {backLabel ?? t('common.back')}
      </button>
      <button
        className="focus-ring btn-primary disabled:opacity-60"
        disabled={nextDisabled}
        type="button"
        onClick={onNext}
      >
        {nextLabel ?? t('common.next')}
      </button>
    </div>
  );
}
