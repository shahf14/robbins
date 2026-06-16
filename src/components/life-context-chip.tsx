'use client';

import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {lifeContextChipLabel} from '@/lib/life-context-content';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import {loadUserPreferences} from '@/lib/user-preferences';

type Props = {
  statuses?: LifeContextStatus[] | null;
  className?: string;
};

export function LifeContextChip({statuses, className = ''}: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  const note = loadUserPreferences().life_context_note;
  const label = lifeContextChipLabel(statuses ?? [], locale, note);

  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--blue)]/25 bg-[var(--blue)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--blue)] ${className}`}
      aria-label={`${t('lifeContext.chipLabel', {context: label})} — ${t('lifeContext.chipTooltip')}`}
    >
      <span aria-hidden="true">✦</span>
      <span aria-hidden="true">{t('lifeContext.chipLabel', {context: label})}</span>
    </span>
  );
}
