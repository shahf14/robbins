'use client';

import {useEffect} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';
import type {LifeDomain} from '@/lib/life-coach/types';
import {getDomainDeepDive} from '@/lib/life-wheel/domain-deep-dives';

type Props = {
  domain: LifeDomain | null;
  onClose: () => void;
};

export function DomainDeepDiveSheet({domain, onClose}: Props) {
  const t = useTranslations('onboarding.domainDeepDive');
  const tRoot = useTranslations();
  const locale = useLocale() as AppLocale;

  useEffect(() => {
    if (!domain) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [domain, onClose]);

  if (!domain) return null;

  const content = getDomainDeepDive(domain, locale);
  const label = tRoot(`lifeCoach.domains.${domain}.label`);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-4 pb-4 sm:items-center sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="domain-deep-dive-title"
      onClick={onClose}
    >
      <div
        className="panel-surface-strong max-h-[min(88vh,44rem)] w-full max-w-lg overflow-y-auto rounded-2xl p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]/80">
              {t('eyebrow')}
            </p>
            <h2 id="domain-deep-dive-title" className="mt-2 text-2xl font-black leading-tight text-white">
              <span aria-hidden="true">{DOMAIN_ICONS[domain]} </span>
              {label}
            </h2>
          </div>
          <button
            type="button"
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/4 text-xl leading-none text-white"
            aria-label={t('close')}
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-white/68">{content.opening}</p>

        <section className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">{t('whyImportant')}</h3>
          <p className="mt-2 text-sm leading-7 text-white/62">{content.whyImportant}</p>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">{t('includes')}</h3>
          <ul className="mt-3 grid gap-2">
            {content.includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-6 text-white/58">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue)]/70" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/6 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-red-300/85">{t('score1')}</h3>
          <p className="mt-2 text-sm leading-7 text-white/62">{content.score1}</p>
        </section>

        <section className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/6 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300/85">{t('score10')}</h3>
          <p className="mt-2 text-sm leading-7 text-white/62">{content.score10}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/8 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]/85">{t('selfCheck')}</h3>
          <p className="mt-2 text-sm font-semibold leading-7 text-white/78">{content.selfCheck}</p>
        </section>

        <button
          type="button"
          className="focus-ring mt-6 w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
