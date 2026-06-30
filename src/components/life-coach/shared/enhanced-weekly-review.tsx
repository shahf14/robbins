'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {weeklyReviewFramingKey} from '@/lib/life-context-content';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import {
  analyzeWeekBehaviorChange,
  type BehaviorChangeContext,
} from '@/lib/formulation/behavior-change-tracking';
import {analyzeReturningBarrierWeek} from '@/lib/formulation/skip-adaptation-routing';
import {fetchFormulationCoachContext} from '@/lib/formulation/personalized-challenge-storage';
import {BehaviorChangeInsightCard} from '@/components/behavior-science/behavior-change-insight-card';
import type {AiCoachingInsight, DailyBabyStep, LifeDomain, WeeklyReview} from '@/lib/life-coach/types';
import {loadUserPreferences} from '@/lib/user-preferences';
import {computeStreak} from '@/lib/life-coach/streak-utils';
import {WeeklyAccountabilityCheckin} from '@/components/behavior-science/weekly-accountability-checkin';
import {WeeklyReviewEmotionalLayer} from '@/components/life-coach/shared/weekly-review-emotional-layer';
import {WeeklyReviewProgressEvidenceCard} from '@/components/life-coach/shared/weekly-review-progress-evidence';
import {WeeklyReviewRecurringPatternSection} from '@/components/life-coach/shared/weekly-review-recurring-pattern';
import {InfoNote} from '@/components/life-coach/shared/info-note';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {useToast} from '@/components/feedback/toast-provider';
import {resolveWeeklyReviewErrorMessage} from '@/lib/life-coach/api-error';
import {BusyButton} from '@/components/feedback/busy-button';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';
import {computeWeeklyReviewReadiness, WEEKLY_REVIEW_MIN_ACTIVE_DAYS, WEEKLY_REVIEW_MIN_STEPS} from '@/lib/life-coach/weekly-review-readiness';

type Props = {
  domain: LifeDomain;
  insight: AiCoachingInsight | null;
  allRecentSteps: DailyBabyStep[];
  onGenerateReview: () => Promise<void>;
};

export function EnhancedWeeklyReview({domain, insight, allRecentSteps, onGenerateReview}: Props) {
  const t = useTranslations();
  const toast = useToast();
  const locale = useLocale() as import('@/i18n/config').AppLocale;
  const lifeContexts = loadUserPreferences().life_context_statuses;
  const framingKey = weeklyReviewFramingKey(lifeContexts);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generatingRef = useRef(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [accountability, setAccountability] = useState<AccountabilityContext | null>(null);
  const [behaviorChange, setBehaviorChange] = useState<BehaviorChangeContext | null>(null);
  const [skipAdaptation, setSkipAdaptation] = useState<
    import('@/lib/formulation/skip-adaptation-routing').SkipAdaptationContext | null
  >(null);
  const [reflections, setReflections] = useState({
    bestWorked: '',
    hardestStep: '',
    changeNext: '',
  });

  const metadata = (insight?.metadata ?? null) as WeeklyReview | null;
  const streak = computeStreak(allRecentSteps, domain);
  const readiness = useMemo(() => computeWeeklyReviewReadiness(allRecentSteps), [allRecentSteps]);

  useEffect(() => {
    void fetchFormulationCoachContext()
      .then((ctx) => {
        setAccountability(ctx.accountability);
        setBehaviorChange(ctx.behavior_change);
        setSkipAdaptation(ctx.skip_adaptation);
      })
      .catch(() => {
        setAccountability(null);
        setBehaviorChange(null);
        setSkipAdaptation(null);
      });
  }, []);

  const behaviorChangeAnalysis = useMemo(() => {
    if (!behaviorChange) return null;
    const analysis = analyzeWeekBehaviorChange({
      context: behaviorChange,
      steps: allRecentSteps.filter((s) => s.domain === domain),
      locale,
    });
    const returning = analyzeReturningBarrierWeek({
      context: skipAdaptation,
      steps: allRecentSteps.filter((s) => s.domain === domain),
      locale,
    });
    if (!returning) return analysis;
    return {
      ...analysis,
      returning_barrier_headline: returning.headline,
      returning_barrier_detail: returning.detail,
      detail_lines: [returning.detail, ...analysis.detail_lines],
    };
  }, [behaviorChange, skipAdaptation, allRecentSteps, domain, locale]);

  // Always show review section, even with minimal data
  const domainSteps = allRecentSteps.filter((s) => s.domain === domain);
  const completedSteps = domainSteps.filter((s) => s.status === 'completed');
  const skippedSteps = domainSteps.filter((s) => s.status === 'skipped');
  const hasAnyData = domainSteps.length > 0;

  // Gap analysis: intention vs execution
  const gapPercent = domainSteps.length > 0
    ? Math.round(((domainSteps.length - completedSteps.length) / domainSteps.length) * 100)
    : 0;

  async function handleGenerate() {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenerateError(null);
    try {
      await onGenerateReview();
    } catch (error) {
      const message = resolveWeeklyReviewErrorMessage(error, t);
      setGenerateError(message);
      toast.error(message);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  return (
    <section className="panel-surface p-6" aria-label={t('enhancedReview.eyebrow')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{t('enhancedReview.eyebrow')}</p>
          <h2 className="mt-3 text-xl font-black txt-strong">{t(framingKey)}</h2>
        </div>
        <BusyButton
          className="focus-ring btn-small"
          type="button"
          busy={generating}
          busyLabel={t('lifeCoach.generatingInsight')}
          disabled={!readiness.isReady}
          aria-describedby={!readiness.isReady ? 'weekly-review-locked-hint' : undefined}
          onClick={() => void handleGenerate()}
        >
          {t('enhancedReview.generateBtn')}
        </BusyButton>
      </div>

      {generateError ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {generateError}
        </p>
      ) : null}

      <AiActionHelpMicrocopy kind="weeklyReview" className="mt-3" />

      <InfoNote
        variant="info"
        titleKey="lifeCoach.weeklyReviewWhenWhyTitle"
        bodyKey="lifeCoach.weeklyReviewWhenWhyExplainer"
        className="mt-4"
      />
      {!insight && !readiness.isReady ? (
        <InfoNote
          id="weekly-review-locked-hint"
          variant="warning"
          titleKey="lifeCoach.weeklyReviewLockedWhyTitle"
          bodyKey="lifeCoach.weeklyReviewLockedExplainer"
          bodyValues={{minSteps: WEEKLY_REVIEW_MIN_STEPS, minDays: WEEKLY_REVIEW_MIN_ACTIVE_DAYS}}
          detailKey="lifeCoach.weeklyReviewLockedProgress"
          detailValues={{
            steps: readiness.loggedSteps,
            minSteps: WEEKLY_REVIEW_MIN_STEPS,
            days: readiness.activeDays,
            minDays: WEEKLY_REVIEW_MIN_ACTIVE_DAYS,
          }}
          className="mt-3"
        />
      ) : null}

      {/* AI Review Summary */}
      {insight && metadata && (
        <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] fill-1 p-4" aria-live="polite">
          <p className="text-base font-bold txt-strong">{insight.content}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label={t('lifeCoach.completedSteps')} value={String(metadata.completed_steps_count)} />
            <MiniStat label={t('lifeCoach.mainBlocker')} value={metadata.main_blocker} />
          </div>
          {metadata.recommended_adjustment && (
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{metadata.recommended_adjustment}</p>
          )}
          {metadata.progress_evidence ? (
            <WeeklyReviewProgressEvidenceCard evidence={metadata.progress_evidence} />
          ) : null}
          {metadata.recurring_pattern ? (
            <WeeklyReviewRecurringPatternSection pattern={metadata.recurring_pattern} />
          ) : null}
          {metadata.pattern_insights && metadata.pattern_insights.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm leading-6 txt-soft">
              {metadata.pattern_insights.map((insight) => (
                <li key={insight} className="rounded-lg border border-[color:var(--color-border)] fill-1 px-3 py-2">
                  {insight}
                </li>
              ))}
            </ul>
          )}
          {(metadata.plan_adjustments_applied_at || insight?.plan_adjustments_applied_at) && (
            <p className="mt-3 text-xs text-emerald-400">
              {t('enhancedReview.planApplied')}
            </p>
          )}
          {metadata.emotional_reflection ? (
            <WeeklyReviewEmotionalLayer reflection={metadata.emotional_reflection} />
          ) : null}
          {metadata.next_best_action ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <NextBestActionCta
                action={metadata.next_best_action}
                disabled={generating}
                onCustomAction={() => void handleGenerate()}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Quick Stats (always visible) */}
      {hasAnyData && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label={t('enhancedReview.tasksPlanned')}
            value={String(domainSteps.length)}
          />
          <MiniStat
            label={t('enhancedReview.tasksCompleted')}
            value={String(completedSteps.length)}
          />
          {behaviorChangeAnalysis ? (
            <>
              <MiniStat
                label={t('enhancedReview.goalAlignedSteps')}
                value={`${behaviorChangeAnalysis.goal_aligned_count}/${Math.max(behaviorChangeAnalysis.show_up_count, 1)}`}
                valueColor={behaviorChangeAnalysis.goal_aligned_count > 0 ? 'green' : 'yellow'}
              />
              <MiniStat
                label={t('enhancedReview.barrierTouchedSteps')}
                value={String(behaviorChangeAnalysis.barrier_touched_count)}
                valueColor={behaviorChangeAnalysis.barrier_touched_count > 0 ? 'green' : undefined}
              />
            </>
          ) : (
            <>
              <MiniStat
                label={t('enhancedReview.tasksSkipped')}
                value={String(skippedSteps.length)}
              />
              <MiniStat
                label={t('enhancedReview.gapPercent')}
                value={`${gapPercent}%`}
                valueColor={gapPercent > 50 ? 'red' : gapPercent > 25 ? 'yellow' : 'green'}
              />
            </>
          )}
        </div>
      )}

      {behaviorChangeAnalysis?.returning_barrier_headline && (
        <BehaviorChangeInsightCard
          className="border-amber-400/20 bg-amber-500/6"
          headline={behaviorChangeAnalysis.returning_barrier_headline}
          detailLines={
            behaviorChangeAnalysis.returning_barrier_detail
              ? [behaviorChangeAnalysis.returning_barrier_detail]
              : []
          }
        />
      )}

      {behaviorChangeAnalysis?.headline && (
        <BehaviorChangeInsightCard
          className="mt-5"
          headline={behaviorChangeAnalysis.headline}
          detailLines={behaviorChangeAnalysis.detail_lines}
        />
      )}

      {!checkinDone && (
        <WeeklyAccountabilityCheckin
          accountability={accountability}
          onComplete={(answers) => {
            setCheckinDone(true);
            setReflections((r) => ({
              bestWorked: answers.committed || r.bestWorked,
              hardestStep: answers.happened || r.hardestStep,
              changeNext: answers.changeNext || r.changeNext,
            }));
          }}
        />
      )}

      {/* Reflection Questions */}
      <div className="mt-6 grid gap-4">
        <p className="text-sm font-bold txt-strong">{t('enhancedReview.reflectTitle')}</p>

        <label className="grid gap-2">
          <span className="text-xs font-semibold txt-muted">
            1. {t('enhancedReview.q1')}
          </span>
          {completedSteps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {completedSteps.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="focus-ring rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  onClick={() => setReflections((r) => ({...r, bestWorked: r.bestWorked ? `${r.bestWorked}, ${s.title}` : s.title}))}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
          <input
            className="focus-ring input-base"
            value={reflections.bestWorked}
            onChange={(e) => setReflections((r) => ({...r, bestWorked: e.target.value}))}
            placeholder={t('enhancedReview.q1Placeholder')}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold txt-muted">
            2. {t('enhancedReview.q2')}
          </span>
          {skippedSteps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skippedSteps.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="focus-ring rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
                  onClick={() => setReflections((r) => ({...r, hardestStep: r.hardestStep ? `${r.hardestStep}, ${s.title}` : s.title}))}
                >
                  ↩ {s.title}
                </button>
              ))}
            </div>
          )}
          <input
            className="focus-ring input-base"
            value={reflections.hardestStep}
            onChange={(e) => setReflections((r) => ({...r, hardestStep: e.target.value}))}
            placeholder={t('enhancedReview.q2Placeholder')}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold txt-muted">
            3. {t('enhancedReview.q3')}
          </span>
          <input
            className="focus-ring input-base"
            value={reflections.changeNext}
            onChange={(e) => setReflections((r) => ({...r, changeNext: e.target.value}))}
            placeholder={t('enhancedReview.q3Placeholder')}
          />
        </label>

        {streak.consistency_rate > 0 && (
          <div className="rounded-xl border border-[color:var(--color-border)] fill-1 p-3 text-xs leading-5 txt-muted">
            {t('enhancedReview.energyNote', {rate: String(streak.consistency_rate)})}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: 'red' | 'yellow' | 'green';
}) {
  const colorClass =
    valueColor === 'red'
      ? 'text-red-400'
      : valueColor === 'yellow'
        ? 'text-yellow-400'
        : valueColor === 'green'
          ? 'text-green-400'
          : 'txt-strong';

  return (
    <div className="rounded-[14px] border border-[color:var(--color-border)] fill-1 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider txt-muted">{label}</p>
      <p className={`mt-1 text-lg font-black ${colorClass}`}>{value}</p>
    </div>
  );
}
