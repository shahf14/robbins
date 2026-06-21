'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ChevronDown, FlowArrow} from '@/components/directional-arrow';
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
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-[16px] fill-1 px-4 py-3 text-left transition hover:fill-2"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
      >
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium txt-soft">
          <span>{t('collapsedPrefix')}</span>
          <FlowArrow className="txt-faint" />
          <span>{t('steps.checkin.title')}</span>
          <FlowArrow className="txt-faint" />
          <span>{t('steps.steps.title')}</span>
          <FlowArrow className="txt-faint" />
          <span>{t('steps.learn.title')}</span>
        </span>
        <ChevronDown className="txt-faint" />
      </button>
    );
  }

  return (
    <section
      className="rounded-[20px] fill-1 px-5 py-4 sm:px-6"
      aria-label={t('title')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] txt-muted">
            {t('eyebrow')}
          </p>
          <p className="mt-1 text-sm font-bold txt-strong" aria-hidden="true">{t('title')}</p>
        </div>
        <button
          type="button"
          className="focus-ring shrink-0 text-[10px] font-bold uppercase tracking-wide txt-faint hover:txt-soft"
          onClick={handleCollapse}
          aria-expanded
        >
          {t('collapse')}
        </button>
      </div>

      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
        {STEP_KEYS.flatMap((key, index) => {
          const card = (
            <li
              key={key}
              className="flex flex-1 items-start gap-3 rounded-xl fill-1 px-3 py-3 sm:flex-col sm:items-stretch sm:gap-2 sm:px-3 sm:py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 text-xs font-black text-[var(--blue)]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold txt-strong">{t(`steps.${key}.title`)}</p>
                <p className="mt-1 text-sm leading-5 txt-soft">{t(`steps.${key}.body`)}</p>
              </div>
            </li>
          );

          if (index >= STEP_KEYS.length - 1) return [card];

          return [
            card,
            <li
              key={`${key}-arrow`}
              aria-hidden
              className="hidden list-none sm:flex sm:w-5 sm:shrink-0 sm:items-center sm:justify-center sm:self-center"
            >
              <FlowArrow className="txt-faint" />
            </li>,
          ];
        })}
      </ol>
    </section>
  );
}
