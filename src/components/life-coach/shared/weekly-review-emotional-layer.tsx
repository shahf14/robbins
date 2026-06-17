'use client';

import {useTranslations} from 'next-intl';
import type {WeeklyReviewEmotionalReflection} from '@/lib/life-coach/types';

type Props = {
  reflection: WeeklyReviewEmotionalReflection;
};

export function WeeklyReviewEmotionalLayer({reflection}: Props) {
  const t = useTranslations('weeklyReviewEmotional');

  return (
    <section className="mt-5 rounded-2xl border border-[var(--blue)]/25 bg-[linear-gradient(135deg,rgba(26,109,255,0.12),rgba(15,23,42,0.35))] p-5 sm:p-6" aria-label={t('title')}>
      <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{t('title')}</p>
      <p className="mt-4 text-base leading-8 txt-strong sm:text-lg">{reflection.meaning_statement}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ReflectionField label={t('identityProof')} text={reflection.identity_proof} />
        <ReflectionField label={t('comebackEvidence')} text={reflection.comeback_evidence} />
      </div>

      <p className="mt-4 rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 text-sm leading-7 txt-strong">
        {reflection.confidence_builder}
      </p>

      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
          {t('nextIdentityAction')}
        </p>
        <p className="mt-2 text-sm font-semibold leading-7 text-emerald-100">
          {reflection.next_identity_action}
        </p>
      </div>
    </section>
  );
}

function ReflectionField({label, text}: {label: string; text: string}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] txt-muted">{label}</p>
      <p className="mt-2 text-sm leading-7 txt-strong">{text}</p>
    </div>
  );
}
