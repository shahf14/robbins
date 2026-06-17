'use client';

import {useTranslations} from 'next-intl';
import {dayModeLabelKey, type DayMode} from '@/lib/day-mode';

const MODE_STYLES: Record<DayMode, string> = {
  light: 'fill-2 txt-soft',
  execution: 'bg-[var(--blue)]/12 text-blue-200',
  recovery: 'fill-2 txt-soft',
};

export function DayModeBadge({mode}: {mode: DayMode}) {
  const t = useTranslations();

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${MODE_STYLES[mode]}`}
    >
      {t(dayModeLabelKey(mode))}
    </span>
  );
}
