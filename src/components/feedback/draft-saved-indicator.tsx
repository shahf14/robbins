'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

/** Brief “auto-saved” pill after draft persistence. */
export function DraftSavedIndicator({savedAt}: {savedAt: number | null}) {
  const t = useTranslations('feedback');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    const showId = window.setTimeout(() => setVisible(true), 0);
    const hideId = window.setTimeout(() => setVisible(false), 2400);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(hideId);
    };
  }, [savedAt]);

  if (!visible) return null;

  return (
    <span
      className="animate-fade-in inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] fill-1 px-3 py-1 text-xs font-semibold txt-muted"
      role="status"
    >
      <span aria-hidden>✓</span>
      {t('draftAutoSaved')}
    </span>
  );
}
