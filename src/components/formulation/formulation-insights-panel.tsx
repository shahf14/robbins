'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import type {FormulationSession} from '@/lib/life-coach/types';

type Props = {
  session: FormulationSession;
};

export function FormulationInsightsPanel({session}: Props) {
  const t = useTranslations('formulation');
  const locale = useLocale() as AppLocale;
  const insights = useMemo(
    () => buildFormulationInsights(session, locale),
    [session, locale]
  );

  if (
    insights.burning_now_themes.length === 0 &&
    insights.suppressed_by_chips.length === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.06)] p-4" role="region" aria-labelledby="formulation-insights-title">
      <p id="formulation-insights-title" className="text-sm font-bold text-white">{t('synthesis.title')}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{insights.cross_cutting_narrative}</p>

      {insights.burning_now_themes.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/40">
            {t('synthesis.burningNow')}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {insights.burning_now_themes.slice(0, 6).map((theme) => (
              <li key={theme.id} className="text-xs text-white/80">
                {theme.label}{' '}
                <span className="text-white/45">
                  ({t('synthesis.score', {score: theme.score})})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {insights.suppressed_by_chips.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/40">
            {t('synthesis.suppressedByChips')}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {insights.suppressed_by_chips.map((s) => (
              <li key={s.id} className="text-xs text-white/50 line-through decoration-white/25">
                {s.label}{' '}
                <span className="text-white/40 no-underline">
                  ({t('synthesis.chipNotNow', {chip: s.chip_answer})})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/40">
        {t('synthesis.goalFocus')}
      </p>
      <p className="mt-1 text-sm text-white/90">{insights.primary_goal_focus}</p>

      {insights.deprioritize_for_goals.length > 0 && (
        <p className="mt-3 text-[10px] leading-relaxed text-white/40">
          {t('synthesis.notPrimary')}: {insights.deprioritize_for_goals.slice(0, 2).join(' · ')}
        </p>
      )}
    </div>
  );
}
