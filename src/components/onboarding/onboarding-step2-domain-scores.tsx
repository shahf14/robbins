'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {LifeDomain} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {DomainDeepDiveSheet} from '@/components/onboarding/domain-deep-dive-sheet';
import {LifeWheelSlider} from '@/components/onboarding/life-wheel-slider';
import {LifeWheelMiniChart} from '@/components/onboarding/life-wheel-mini-chart';
import {getLifeWheelBandColor, getLifeWheelRatingKeys} from '@/lib/life-wheel';
import {onboardingStep2Hint} from '@/lib/life-context-content';
import {DOMAIN_ICONS} from '@/lib/onboarding-domain-icons';
import type {WizardState} from '@/lib/onboarding-wizard-state';
// ── Step 2: Domain scores + selection ─────────────────────────────────────────

export function Step2DomainScores({
  s, set, onBack, onNext,
}: {
  s: WizardState;
  set: (p: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t    = useTranslations();
  const busy = s.insightLoading;
  const [activeDomain, setActiveDomain] = useState<LifeDomain>('health');
  const [touchedDomains, setTouchedDomains] = useState<Set<LifeDomain>>(() => new Set());
  const [selectionFirst, setSelectionFirst] = useState(false);
  const [deepDiveDomain, setDeepDiveDomain] = useState<LifeDomain | null>(null);

  const rankedDomains = (Object.entries(s.domainScores) as [LifeDomain, number][])
    .sort(([, a], [, b]) => a - b);
  const lowestDomain = rankedDomains[0]?.[0] ?? null;
  const strongestEntry = rankedDomains[rankedDomains.length - 1] ?? null;
  const strongestDomain = strongestEntry?.[0] ?? null;
  const strongestScore = strongestEntry?.[1] ?? 0;
  const lowestScore = rankedDomains[0]?.[1] ?? 0;
  const averageScore = Math.round(
    (rankedDomains.reduce((sum, [, score]) => sum + score, 0) / LIFE_DOMAINS.length) * 10
  ) / 10;
  const scoreGap = strongestScore - lowestScore;
  const activeRating = getLifeWheelRatingKeys(activeDomain, s.domainScores[activeDomain]);
  const activeColor = getLifeWheelBandColor(s.domainScores[activeDomain]);
  const ratedCount = touchedDomains.size;
  const lowestDomainLabel = lowestDomain
    ? t(`lifeCoach.domains.${lowestDomain}.label`)
    : '';
  const lowestDomainShortLabel = lowestDomain
    ? t(`lifeCoach.domains.${lowestDomain}.short`)
    : '';
  const strongestDomainLabel = strongestDomain
    ? t(`lifeCoach.domains.${strongestDomain}.label`)
    : '';
  const strongestDomainShortLabel = strongestDomain
    ? t(`lifeCoach.domains.${strongestDomain}.short`)
    : '';
  const selectedDomainLabel = s.selectedDomain
    ? t(`lifeCoach.domains.${s.selectedDomain}.label`)
    : '';
  const domainRadarLabels = Object.fromEntries(
    LIFE_DOMAINS.map((domain) => [domain, t(`lifeCoach.domains.${domain}.short`)])
  ) as Record<LifeDomain, string>;

  const step2Hint = onboardingStep2Hint({
    statuses: s.lifeContextStatuses,
    lowestDomain,
    domainScores: s.domainScores,
  });

  const canContinue = s.selectedDomain !== null;

  function setScore(domain: LifeDomain, val: number) {
    set({domainScores: {...s.domainScores, [domain]: val}});
    setTouchedDomains((current) => new Set(current).add(domain));
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="eyebrow text-[var(--blue)]">{t('onboarding.step2Eyebrow')}</p>
        <h1 className="text-[clamp(1.75rem,4.5vw,2.25rem)] font-bold leading-tight txt-strong">
          {t('onboarding.step2Title')}
        </h1>
      </header>

      <div className="rounded-[20px] border border-[color:var(--color-border)] fill-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest txt-faint">
              {t('onboarding.step2InnerProgress', {rated: ratedCount, total: LIFE_DOMAINS.length})}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 txt-soft">
              {t('onboarding.step2GutHint')}
            </p>
          </div>
          <button
            type="button"
            className="focus-ring rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-bold txt-soft transition hover:border-[color:var(--color-border-strong)] hover:txt-soft"
            onClick={() => setSelectionFirst((value) => !value)}
          >
            {selectionFirst ? t('onboarding.step2ShowRatings') : t('onboarding.step2SkipRatings')}
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {!selectionFirst && (
            <div className="rounded-[22px] border border-[color:var(--color-border)] fill-1 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest txt-faint">
                    {t('onboarding.step2CurrentDomain')}
                  </p>
                  <p className="mt-1 text-xl font-black txt-strong">
                    {DOMAIN_ICONS[activeDomain]} {t(`lifeCoach.domains.${activeDomain}.label`)}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 txt-soft">
                    {t(`lifeCoach.domains.${activeDomain}.wheelIntro`)}
                  </p>
                  <button
                    type="button"
                    className="focus-ring mt-3 text-sm font-semibold text-[var(--blue)] underline decoration-[var(--blue)]/35 underline-offset-4 transition hover:txt-strong hover:decoration-white/40"
                    onClick={() => setDeepDiveDomain(activeDomain)}
                  >
                    {t('onboarding.domainDeepDive.button')}
                  </button>
                </div>
                <div className="rounded-2xl border px-3 py-2 text-end" style={{borderColor: `${activeColor}35`, backgroundColor: `${activeColor}10`}}>
                  <p className="text-lg font-black tabular-nums" style={{color: activeColor}}>
                    {activeRating.score}/10
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest txt-muted">
                    {t(activeRating.bandLabelKey)}
                  </p>
                </div>
              </div>
              <LifeWheelSlider
                domain={activeDomain}
                icon={DOMAIN_ICONS[activeDomain]}
                label={t(`lifeCoach.domains.${activeDomain}.label`)}
                score={s.domainScores[activeDomain]}
                onChange={(val) => setScore(activeDomain, val)}
                hideLabel
              />
            </div>
          )}

          <div className="rounded-[28px] border border-[var(--blue)]/20 bg-[linear-gradient(145deg,rgba(26,109,255,0.1),rgba(255,255,255,0.018)_48%,rgba(0,0,0,0.12))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_300px] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]/80">
                    {t('onboarding.step2MapEyebrow')}
                  </p>
                </div>
                <p className="mt-3 text-2xl font-black leading-tight txt-strong sm:text-3xl">
                  {lowestDomain
                    ? t('onboarding.step2MapInsightTitle', {domain: lowestDomainLabel})
                    : t('onboarding.step2MapTitle')}
                </p>
                <p className="mt-2 max-w-2xl text-base font-semibold leading-7 txt-soft">
                  {lowestDomain
                    ? t('onboarding.step2MapInsightBody', {
                        low: lowestDomainLabel,
                        strong: strongestDomainLabel,
                      })
                    : t('onboarding.step2MapBody')}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[0.9fr_0.9fr_1.25fr]">
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-black/18 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest txt-muted">
                      {t('onboarding.step2MapStats.average')}
                    </p>
                    <p className="mt-1 text-xl font-black txt-strong tabular-nums">{averageScore}/10</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-black/18 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest txt-muted">
                      {t('onboarding.step2MapStats.gap')}
                    </p>
                    <p className="mt-1 text-xl font-black txt-strong tabular-nums">{scoreGap}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-black/18 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest txt-muted">
                      {t('onboarding.step2MapStats.strongest')}
                    </p>
                    <p className="mt-1 break-words text-lg font-black leading-snug txt-strong">
                      {strongestDomain ? (
                        <>
                          <span aria-hidden="true">{DOMAIN_ICONS[strongestDomain]}</span>{' '}
                          {strongestDomainLabel}
                        </>
                      ) : '-'}
                    </p>
                  </div>
                </div>

                {lowestDomain && strongestDomain && scoreGap > 0 && (
                  <p className="mt-4 rounded-2xl border border-amber-400/22 bg-amber-500/8 px-4 py-3 text-base font-black leading-7 txt-strong">
                    {t('onboarding.step2GapInsight', {
                      gap: scoreGap,
                      low: lowestDomainShortLabel,
                      high: strongestDomainShortLabel,
                    })}
                  </p>
                )}

                <div className="mt-5 rounded-[22px] border border-[color:var(--color-border)] bg-black/18 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black txt-strong">
                      {t('onboarding.step2BarTitle')}
                    </p>
                    <p className="text-xs font-bold txt-muted">
                      {t('onboarding.step2ScaleHint')}
                    </p>
                  </div>
                  <div className="mb-5 rounded-2xl border border-[color:var(--color-border)] fill-1 px-3 py-3">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-[11px] font-black txt-soft">
                      <span className="whitespace-nowrap text-red-200/90">
                        1 · {t('onboarding.step2Scale.low')}
                      </span>
                      <div className="relative h-px fill-3">
                        <span className="absolute start-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-red-300/50 bg-red-400/80" />
                        <span className="absolute start-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/50 bg-amber-300/85" />
                        <span className="absolute end-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-emerald-300/50 bg-emerald-400/80" />
                      </div>
                      <span className="whitespace-nowrap text-emerald-200/90">
                        10 · {t('onboarding.step2Scale.high')}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3.5">
                    {rankedDomains.map(([domain, score], index) => {
                      const color = getLifeWheelBandColor(score);
                      const ratingKeys = getLifeWheelRatingKeys(domain, score);
                      const isLowest = domain === lowestDomain;
                      const isActive = domain === activeDomain && !selectionFirst;
                      const isSelected = domain === s.selectedDomain;
                      const width = `${Math.max(8, score * 10)}%`;
                      return (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => {
                            setSelectionFirst(false);
                            setActiveDomain(domain);
                          }}
                          className={`focus-ring rounded-2xl border px-3.5 py-4 text-start transition ${
                            isActive
                              ? 'border-[var(--blue)] bg-[var(--blue)]/10'
                              : isSelected
                                ? 'border-emerald-400/32 bg-emerald-500/8'
                            : isLowest
                              ? 'border-amber-400/24 bg-amber-500/7'
                              : 'border-[color:var(--color-border)] fill-1 hover:border-[color:var(--color-border-strong)] hover:fill-1'
                          }`}
                        >
                          <div className="grid gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black leading-6 txt-strong">
                                <span className="text-[10px] font-black txt-faint tabular-nums">{index + 1}</span>
                                <span className="shrink-0" aria-hidden="true">{DOMAIN_ICONS[domain]}</span>
                                <span className="min-w-0 break-words">
                                  {t(`lifeCoach.domains.${domain}.label`)}
                                </span>
                              </span>
                              <span className="shrink-0 text-sm font-black leading-6 tabular-nums txt-strong">
                                {score}/10
                                <span className="txt-faint"> · </span>
                                <span style={{color}}>{t(ratingKeys.bandLabelKey)}</span>
                              </span>
                              {isLowest && (
                                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold leading-5 text-amber-300/90">
                                  {t('onboarding.step2LeverageBadge')}
                                </span>
                              )}
                            </div>
                            <span className="h-2.5 w-full overflow-hidden rounded-full fill-2">
                              <span
                                className="block h-full rounded-full transition-all duration-300"
                                style={{width, backgroundColor: color}}
                              />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--color-border)] bg-black/18 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-widest txt-muted">
                    {t('onboarding.step2RadarTitle')}
                  </p>
                  <span className="text-[11px] font-bold txt-muted">
                    {t('onboarding.step2RadarHint')}
                  </span>
                </div>
                <LifeWheelMiniChart
                  scores={s.domainScores}
                  focusDomain={activeDomain}
                  selectedDomain={s.selectedDomain}
                  domainLabels={domainRadarLabels}
                  onScoreChange={(domain, val) => setScore(domain, val)}
                />
                <div className="mt-3 grid gap-2">
                  <div className="rounded-2xl border border-[color:var(--color-border)] fill-1 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest txt-faint">
                      {t('onboarding.step2RadarActive')}
                    </p>
                    <p className="mt-1 truncate text-sm font-black txt-strong">
                      {DOMAIN_ICONS[activeDomain]} {t(`lifeCoach.domains.${activeDomain}.label`)}
                    </p>
                  </div>
                </div>
                {lowestDomain && (
                  <p className="mt-3 rounded-2xl border border-[var(--blue)]/18 bg-[var(--blue)]/[0.07] px-4 py-3 text-center text-base font-bold leading-7 txt-strong">
                    {t('onboarding.step2MapConclusion', {domain: lowestDomainLabel})}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lowestDomain && (
        <div className="rounded-[20px] border border-amber-400/24 bg-amber-500/7 p-4 shadow-[0_18px_40px_rgba(245,158,11,0.08)]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-amber-300/15 px-2 py-1 text-sm" aria-hidden="true">💡</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                {t('onboarding.step2LeverageTitle')}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 txt-soft">
                {t('onboarding.step2LeverageBody', {
                  domain: t(`lifeCoach.domains.${lowestDomain}.label`),
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Domain selection question */}
      <div className="rounded-[24px] border border-[var(--blue)]/24 bg-[var(--blue)]/[0.055] p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
          {t('onboarding.step2DecisionEyebrow')}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xl font-black leading-snug txt-strong">{t('onboarding.step2SelectTitle')}</p>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label={t('onboarding.step2WhyOneTitle')}
              className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--color-border)] fill-2 text-xs font-black txt-soft transition hover:border-[color:var(--color-border-strong)] hover:txt-strong"
            >
              ?
            </button>
            <span className="pointer-events-none absolute end-0 top-8 z-10 w-64 rounded-2xl border border-white/12 bg-[#111318] p-3 text-start text-xs font-semibold leading-5 text-white/72 opacity-0 shadow-[0_18px_45px_rgba(0,0,0,0.36)] transition group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="block font-black text-white">{t('onboarding.step2WhyOneTitle')}</span>
              <span className="mt-1 block">{t('onboarding.step2WhyOneBody')}</span>
            </span>
          </span>
        </div>
        {lowestDomain && step2Hint && (
          <p className="mt-2 text-sm leading-6 txt-soft">
            {t(step2Hint.key, {
              ...step2Hint.values,
              domain: t(step2Hint.values.domain),
            })}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LIFE_DOMAINS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={s.selectedDomain === d}
              onClick={() => set({selectedDomain: d})}
              className={`focus-ring flex flex-col items-center gap-1.5 rounded-2xl border py-4 text-sm font-medium transition ${
                s.selectedDomain === d
                  ? 'border-[var(--blue)] bg-[var(--blue)] text-white shadow-[0_12px_30px_rgba(26,109,255,0.2)]'
                  : 'border-[color:var(--color-border)] fill-2 txt-soft hover:border-[color:var(--color-border-strong)] hover:fill-3'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{DOMAIN_ICONS[d]}</span>
              <span className="text-xs leading-tight">{t(`lifeCoach.domains.${d}.short`)}</span>
            </button>
          ))}
        </div>
        {s.selectedDomain && (
          <div className="mt-4 rounded-[20px] border border-emerald-400/20 bg-emerald-500/6 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
              {t('onboarding.domainPreview.eyebrow')}
            </p>
            <p className="mt-2 text-base font-black leading-snug txt-strong">
              {t('onboarding.step2SelectedConfirm', {domain: selectedDomainLabel})}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 txt-soft">
              {t('onboarding.domainPreview.body', {
                domain: selectedDomainLabel,
                mins: s.availableTime,
              })}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" className="focus-ring btn-ghost" onClick={onBack} disabled={busy} aria-busy={busy}>
          {t('onboarding.back')}
        </button>
        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            className="focus-ring btn-primary w-full justify-center disabled:opacity-50"
            disabled={!canContinue || busy}
            aria-busy={busy}
            onClick={onNext}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
                {t('onboarding.analyzing')}
              </span>
            ) : s.selectedDomain
              ? t('onboarding.step2DynamicCta', {domain: selectedDomainLabel}) + ' →'
              : t('onboarding.next') + ' →'}
          </button>
          {!s.selectedDomain && (
            <p className="text-center text-xs font-semibold txt-faint">
              {t('onboarding.step2ChooseToContinue')}
            </p>
          )}
        </div>
      </div>

      <DomainDeepDiveSheet domain={deepDiveDomain} onClose={() => setDeepDiveDomain(null)} />
    </div>
  );
}
