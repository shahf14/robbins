'use client';

import {useTranslations} from 'next-intl';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';
import type {LifeDomain} from '@/lib/life-coach/types';

type Props = {
  focus: DailyFocusContext | null;
  domain: LifeDomain;
  onCreateMissionStep?: () => void;
  creating?: boolean;
};

export function DailyFocusCard({focus, domain, onCreateMissionStep, creating = false}: Props) {
  const t = useTranslations();

  if (!focus?.suggestedAction && !focus?.morningMission && !focus?.activeDomainId) return null;

  const isRelevantDomain =
    focus.suggestedAction?.domainId === domain ||
    focus.activeDomainId === domain ||
    focus.weakestDomainId === domain;
  const domainLabel = focus.activeDomainId
    ? t(`lifeCoach.domains.${focus.activeDomainId}.label`)
    : t(`lifeCoach.domains.${domain}.label`);
  const suggested = focus.suggestedAction;
  const hasCreateableMission =
    isRelevantDomain &&
    focus.morningMission &&
    suggested?.source === 'morning_ritual' &&
    !focus.linkedStepId &&
    !!onCreateMissionStep;

  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200/80">
            {t('lifeCoach.dailyFocusCard.eyebrow')}
          </p>
          <h2 className="mt-2 text-xl font-black leading-7 txt-strong">
            {focus.morningMission
              ? t('lifeCoach.dailyFocusCard.missionConnected')
              : `${DOMAIN_ICONS[focus.activeDomainId ?? domain]} ${domainLabel}`}
          </h2>
        </div>
        {focus.activeDomainScore != null && (
          <span className="rounded-full border border-[color:var(--color-border)] bg-black/20 px-3 py-1.5 text-sm font-bold txt-soft">
            {focus.activeDomainScore}/10
          </span>
        )}
      </div>

      {focus.morningMission && (
        <blockquote className="mt-4 rounded-xl border border-[color:var(--color-border)] bg-black/20 px-4 py-3 text-sm font-semibold leading-7 txt-strong">
          “{focus.morningMission}”
        </blockquote>
      )}

      {suggested && (
        <div className="mt-4 rounded-xl border border-[color:var(--color-border)] fill-2 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] txt-muted">
            {focus.linkedStepId
              ? t('lifeCoach.dailyFocusCard.linkedStep')
              : t('lifeCoach.dailyFocusCard.suggestedStep')}
          </p>
          <p className="mt-2 text-base font-bold leading-7 txt-strong">{suggested.title}</p>
          {suggested.description && (
            <p className="mt-1 text-sm leading-6 txt-soft">{suggested.description}</p>
          )}
        </div>
      )}

      {focus.weakestDomainId && focus.weakestDomainId !== domain && (
        <p className="mt-3 text-sm leading-6 text-sky-100/65">
          {t('lifeCoach.dailyFocusCard.backgroundDomain', {
            domain: t(`lifeCoach.domains.${focus.weakestDomainId}.label`),
          })}
        </p>
      )}

      {hasCreateableMission && (
        <button
          type="button"
          className="focus-ring mt-4 rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-100 transition hover:border-sky-200/50 hover:bg-sky-400/15 disabled:opacity-60"
          disabled={creating}
          onClick={onCreateMissionStep}
        >
          {creating
            ? t('lifeCoach.dailyFocusCard.creating')
            : t('lifeCoach.dailyFocusCard.turnIntoStep')}
        </button>
      )}
    </section>
  );
}
