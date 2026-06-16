'use client';

import {useTranslations} from 'next-intl';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';
import type {LifeDomain} from '@/lib/life-coach/types';

type Props = {
  domain: LifeDomain;
  /** Use short domain label (better on step cards). */
  short?: boolean;
  className?: string;
};

export function DomainStepBadge({domain, short = true, className = ''}: Props) {
  const t = useTranslations();
  const labelKey = short ? 'short' : 'label';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-white/70 ${className}`}
    >
      <span aria-hidden>{DOMAIN_ICONS[domain]}</span>
      {t(`lifeCoach.domains.${domain}.${labelKey}`)}
    </span>
  );
}
