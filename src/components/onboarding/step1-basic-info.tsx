'use client';

import {NavArrow} from '@/components/directional-arrow';
import {useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {LIFE_CONTEXT_STATUSES, LIFE_DOMAINS} from '@/lib/life-coach/types';
import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';

type Step1ProfileState = {
  locale: AppLocale;
  lifeContextStatuses: LifeContextStatus[];
  lifeContextNote: string;
  selectedDomain: LifeDomain | null;
  saving: boolean;
};

type Props = {
  s: Step1ProfileState;
  set: (p: Partial<Step1ProfileState>) => void;
  onNext: () => void;
};

function ZoneHeading({title}: {title: string}) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] txt-muted">{title}</p>
  );
}

function SmallChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`focus-ring inline-flex min-h-9 items-center rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-[var(--blue)] text-white shadow-[0_0_0_1px_rgba(26,109,255,0.35)]'
          : 'border border-[color:var(--color-border)]/60 fill-2 txt-muted hover:border-[color:var(--color-border)] hover:txt-soft'
      }`}
    >
      {children}
    </button>
  );
}

export function Step1BasicInfo({s, set, onNext}: Props) {
  const t = useTranslations();
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const domainValid = s.selectedDomain !== null;

  function handleNext() {
    setSubmitAttempted(true);
    if (!domainValid || s.saving) return;
    onNext();
  }

  function toggleLifeContext(status: LifeContextStatus) {
    set({
      lifeContextStatuses: normalizeLifeContextSelection(
        status === 'prefer_not'
          ? s.lifeContextStatuses.includes('prefer_not')
            ? []
            : ['prefer_not']
          : s.lifeContextStatuses.includes(status)
            ? s.lifeContextStatuses.filter((x) => x !== status)
            : [...s.lifeContextStatuses.filter((x) => x !== 'prefer_not'), status]
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[clamp(1.65rem,4vw,2rem)] font-bold leading-tight txt-strong">
          {t('onboarding.step1Title')}
        </h1>
        <p className="mt-2 text-sm leading-6 txt-soft">{t('onboarding.step1Body')}</p>
      </header>

      <section className="grid gap-3">
        <ZoneHeading title={t('onboarding.step2Eyebrow')} />
        <div className="grid gap-2 sm:grid-cols-2">
          {LIFE_DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              aria-pressed={s.selectedDomain === domain}
              className={`focus-ring rounded-[14px] border px-4 py-3 text-start text-sm font-bold transition ${
                s.selectedDomain === domain
                  ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.14)] txt-strong'
                  : 'border-[color:var(--color-border)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
              }`}
              onClick={() => set({selectedDomain: domain})}
            >
              {t(`lifeCoach.domains.${domain}.short`)}
            </button>
          ))}
        </div>
        {submitAttempted && !domainValid ? (
          <p className="text-xs text-red-400/80" role="alert">
            {t('onboarding.quickStartDomainRequired')}
          </p>
        ) : null}
      </section>

      <section className="grid gap-2.5">
        <ZoneHeading title={t('onboarding.step1ZoneNow')} />
        <div className="rounded-xl border border-[var(--blue)]/18 bg-[var(--blue)]/[0.06] p-3.5 sm:p-4">
          <p className="text-base font-semibold leading-snug txt-strong">
            {t('onboarding.lifeContextQuestion')}
          </p>
          <p className="mt-1 text-xs leading-5 txt-muted">{t('onboarding.step1LifeContextHint')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LIFE_CONTEXT_STATUSES.map((status) => (
              <SmallChip
                key={status}
                active={s.lifeContextStatuses.includes(status)}
                onClick={() => toggleLifeContext(status)}
              >
                {t(`formulation.consent.contexts.${status}`)}
              </SmallChip>
            ))}
          </div>
          {s.lifeContextStatuses.some((c) => c !== 'prefer_not') ? (
            <textarea
              className="focus-ring textarea-base mt-3 min-h-14 w-full rounded-lg border border-[color:var(--color-border)]/70 fill-2 px-3 py-2 text-sm"
              value={s.lifeContextNote}
              maxLength={200}
              aria-label={t('lifeContext.noteLabel')}
              placeholder={t('onboarding.lifeContextNotePlaceholder')}
              onChange={(e) => set({lifeContextNote: e.target.value})}
            />
          ) : null}
        </div>
      </section>

      <button
        type="button"
        className="focus-ring mt-1 flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--blue)] px-6 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={s.saving}
        onClick={handleNext}
      >
        {s.saving ? t('onboarding.saving') : t('onboarding.next')} {!s.saving && <NavArrow className="ms-1" />}
      </button>
    </div>
  );
}
