'use client';

import {useTranslations} from 'next-intl';

type Props = {
  evidence: string;
};

export function WeeklyReviewProgressEvidenceCard({evidence}: Props) {
  const t = useTranslations('weeklyReviewProgressEvidence');

  return (
    <figure className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-5 py-4 sm:px-6 sm:py-5">
      <figcaption className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">
        {t('title')}
      </figcaption>
      <blockquote className="mt-3 border-s-2 border-emerald-400/50 ps-4">
        <p className="text-base font-medium leading-8 text-emerald-50/95 sm:text-lg">
          &ldquo;{evidence}&rdquo;
        </p>
      </blockquote>
    </figure>
  );
}
