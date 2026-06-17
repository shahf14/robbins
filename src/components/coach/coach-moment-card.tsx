'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';

type Props = {
  text?: string | null;
  loading?: boolean;
  titleKey?: 'checkin.supportTitle' | 'coach.title';
  onOpen?: () => void;
  onRead?: () => void;
  onDismiss?: () => void;
  defaultOpen?: boolean;
};

export function CoachMomentCard({
  text,
  loading = false,
  titleKey = 'coach.title',
  onOpen,
  onRead,
  onDismiss,
  defaultOpen = false,
}: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(defaultOpen);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readReportedRef = useRef(false);

  function handleOpen() {
    if (!open) {
      setOpen(true);
      onOpen?.();
      if (!readReportedRef.current) {
        readTimerRef.current = setTimeout(() => {
          readReportedRef.current = true;
          onRead?.();
        }, 5000);
      }
    } else {
      setOpen(false);
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    }
  }

  useEffect(
    () => () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    },
    []
  );

  if (!loading && !text) {
    return null;
  }

  return (
    <div className="mb-3 rounded-[20px] border border-[color:var(--color-border)] fill-1">
      <div className="flex items-center justify-between gap-3 p-5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={handleOpen}
          aria-expanded={open}
          aria-controls="coach-moment-body"
        >
          <p className="field-label mb-0 txt-muted">{t(titleKey)}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {onDismiss ? (
            <button
              type="button"
              className="focus-ring text-[10px] font-bold uppercase tracking-wide txt-faint hover:txt-soft"
              onClick={onDismiss}
            >
              {t('gamification.reflectionLoot.dismiss')}
            </button>
          ) : null}
          <button
            type="button"
            className="focus-ring p-1 text-sm txt-muted hover:txt-soft"
            onClick={handleOpen}
            aria-expanded={open}
            aria-label={open ? t('coach.collapseLabel') : t('coach.expandLabel')}
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {open ? (
        <div id="coach-moment-body" className="px-5 pb-5" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="text-sm leading-7 txt-muted">{t('coach.loading')}</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{text}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
