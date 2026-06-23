'use client';

import {useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {weeklyReviewEmptyKey} from '@/lib/life-context-content';
import type {AiCoachingInsight, WeeklyReview} from '@/lib/life-coach/types';
import {loadUserPreferences} from '@/lib/user-preferences';
import {WeeklyReviewEmotionalLayer} from '@/components/life-coach/shared/weekly-review-emotional-layer';
import {WeeklyReviewProgressEvidenceCard} from '@/components/life-coach/shared/weekly-review-progress-evidence';
import {WeeklyReviewRecurringPatternSection} from '@/components/life-coach/shared/weekly-review-recurring-pattern';
import {WeeklyReviewExplainer} from '@/components/life-coach/shared/weekly-review-explainer';
import {WeeklyReviewLockedExplainer} from '@/components/life-coach/shared/weekly-review-locked-explainer';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';
import {computeWeeklyReviewReadiness} from '@/lib/life-coach/weekly-review-readiness';
import type {DailyBabyStep} from '@/lib/life-coach/types';

function useWeekendSignal() {
  // 0=Sun, 5=Fri, 6=Sat — ideal review days
  const day = new Date().getDay();
  return {isGoodTime: day === 0 || day === 5 || day === 6, day};
}

export function WeeklyReviewCard({
  insight,
  recentSteps = [],
}: {
  insight: AiCoachingInsight | null;
  recentSteps?: DailyBabyStep[];
}) {
  const t = useTranslations();
  const lifeContexts = loadUserPreferences().life_context_statuses;
  const metadata = (insight?.metadata ?? null) as WeeklyReview | null;
  const {isGoodTime} = useWeekendSignal();
  const readiness = useMemo(() => computeWeeklyReviewReadiness(recentSteps), [recentSteps]);

  if (!insight) {
    return (
      <article className="panel-surface p-5" aria-label={t('lifeCoach.weeklyReview')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="field-label mb-0 txt-muted" aria-hidden="true">{t('lifeCoach.weeklyReview')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {isGoodTime ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                {t('lifeCoach.weeklyReviewGoodTime')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] fill-1 px-2.5 py-1 text-[11px] font-semibold txt-muted">
                {t('lifeCoach.weeklyReviewBestOnWeekend')}
              </span>
            )}
            {readiness.isReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                {t('lifeCoach.weeklyReviewReadyLabel')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                {t('lifeCoach.weeklyReviewLocked')}
              </span>
            )}
          </div>
        </div>
        <WeeklyReviewExplainer className="mt-4" />
        <WeeklyReviewLockedExplainer readiness={readiness} className="mt-3" />
        {readiness.isReady ? (
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t(weeklyReviewEmptyKey(lifeContexts))}</p>
        ) : null}

        {/* Preview mockup of what the review will look like */}
        <div className="relative mt-4 overflow-hidden rounded-[18px] border border-dashed border-[color:var(--color-border)] fill-1 p-4">
          <div className="select-none blur-[2px]" aria-hidden>
            <div className="h-3 w-3/4 rounded-full fill-3" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-[color:var(--color-border)] fill-1 p-3">
                <div className="h-2.5 w-12 rounded-full fill-3" />
                <div className="mt-3 h-5 w-8 rounded-full fill-2" />
              </div>
              <div className="rounded-[14px] border border-[color:var(--color-border)] fill-1 p-3">
                <div className="h-2.5 w-12 rounded-full fill-3" />
                <div className="mt-3 h-5 w-16 rounded-full fill-2" />
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full fill-2" />
            <div className="mt-2 h-2.5 w-5/6 rounded-full fill-2" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm">
              {t('lifeCoach.weeklyReviewPreviewLabel')}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="panel-surface p-5" aria-label={t('lifeCoach.weeklyReview')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{t('lifeCoach.weeklyReview')}</p>
        {isGoodTime && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
            {t('lifeCoach.weeklyReviewGoodTime')}
          </span>
        )}
      </div>
      <WeeklyReviewExplainer className="mt-4" />
      <p className="mt-3 text-lg font-bold txt-strong">{insight.content}</p>
      {metadata ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
              <p className="field-label mb-0 txt-muted">{t('lifeCoach.completedSteps')}</p>
              <p className="mt-2 text-2xl font-black txt-strong">{metadata.completed_steps_count}</p>
            </div>
            <div className="rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
              <p className="field-label mb-0 txt-muted">{t('lifeCoach.mainBlocker')}</p>
              <p className="mt-2 text-base font-semibold txt-strong">{metadata.main_blocker}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{metadata.recommended_adjustment}</p>
          {metadata.progress_evidence ? (
            <WeeklyReviewProgressEvidenceCard evidence={metadata.progress_evidence} />
          ) : null}
          {metadata.recurring_pattern ? (
            <WeeklyReviewRecurringPatternSection pattern={metadata.recurring_pattern} />
          ) : null}
          {metadata.emotional_reflection ? (
            <WeeklyReviewEmotionalLayer reflection={metadata.emotional_reflection} />
          ) : null}
          {metadata.next_best_action ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <NextBestActionCta action={metadata.next_best_action} />
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
