'use client';

import {useTranslations} from 'next-intl';
import {
  dismissFeatureHint,
  shouldShowFeatureHint,
  type DiscoverableFeature,
} from '@/lib/feature-discovery';
import {useEffect, useState} from 'react';

type Props = {
  feature: DiscoverableFeature;
  className?: string;
};

/** One-line dismissible hint shown once per feature. */
export function FeatureHint({feature, className = ''}: Props) {
  const t = useTranslations('featureHints');
  const [visible, setVisible] = useState(() => shouldShowFeatureHint(feature));

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(shouldShowFeatureHint(feature)), 0);
    return () => window.clearTimeout(id);
  }, [feature]);

  if (!visible) return null;

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 ${className}`}
      role="note"
    >
      <p className="text-xs leading-6 txt-soft">{t(feature)}</p>
      <button
        type="button"
        className="focus-ring shrink-0 text-[10px] font-bold uppercase tracking-wide txt-faint hover:txt-soft"
        aria-label={t('dismiss')}
        onClick={() => {
          dismissFeatureHint(feature);
          setVisible(false);
        }}
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
