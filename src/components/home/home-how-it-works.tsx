'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {
  collapseHomeHowItWorks,
  isHomeHowItWorksCollapsed,
} from '@/lib/home/how-it-works-state';

type Props = {
  firstUseComplete: boolean;
};

const STEP_KEYS = ['checkin', 'steps', 'learn'] as const;

export function HomeHowItWorks({firstUseComplete}: Props) {
  const t = useTranslations('home.howItWorks');
  const [expanded, setExpanded] = useState(() => !isHomeHowItWorksCollapsed() && !firstUseComplete);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (isHomeHowItWorksCollapsed()) {
        setExpanded(false);
        return;
      }
      if (firstUseComplete) {
        collapseHomeHowItWorks();
        setExpanded(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [firstUseComplete]);

  function handleCollapse() {
    collapseHomeHowItWorks();
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-[16px] bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.05]"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
      >
        <span className="text-sm font-medium text-white/62">{t('collapsedLabel')}</span>
        <span className="text-white/35" aria-hidden>
          ◀
        </span>
      </button>
    );
  }

  return (
    <section
      className="rounded-[20px] bg-white/[0.03] px-5 py-4 sm:px-6"
      aria-label={t('title')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/48">
            {t('eyebrow')}
          </p>
          <p className="mt-1 text-sm font-bold text-white/88" aria-hidden="true">{t('title')}</p>
        </div>
        <button
          type="button"
          className="focus-ring shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/35 hover:text-white/60"
          onClick={handleCollapse}
          aria-expanded
        >
          {t('collapse')}
        </button>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-2">
        {STEP_KEYS.map((key, index) => (
          <li
            key={key}
            className="relative flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-3 sm:flex-col sm:items-stretch sm:gap-2 sm:px-3 sm:py-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 text-xs font-black text-[var(--blue)]">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white/90">{t(`steps.${key}.title`)}</p>
              <p className="mt-1 text-sm leading-5 text-white/58">{t(`steps.${key}.body`)}</p>
            </div>
            {index < STEP_KEYS.length - 1 ? (
              <span
                className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-white/20 sm:block"
                aria-hidden
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
