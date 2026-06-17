'use client';

import {useMemo, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {PARTICIPANT_GENDERS, type ParticipantGender} from '@/lib/formulation/participant-profile';
import {AVAILABLE_TIME_OPTIONS, INTENSITY_PREFERENCES, LIFE_CONTEXT_STATUSES} from '@/lib/life-coach/types';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {AvailableTimePerDay, IntensityPreference} from '@/lib/life-coach/types';
import {
  COACHING_STYLES,
  FAMILY_STATUSES,
  PHYSICAL_CONSIDERATIONS,
  PREFERRED_ACTION_WINDOWS,
  type CoachingStyle,
  type FamilyStatus,
  type PhysicalConsideration,
  type PreferredActionWindow,
} from '@/lib/user-preferences';
import {inferPreferredActionWindow, isShortAwakeDay} from '@/lib/schedule-content';

type Step1ProfileState = {
  name: string;
  locale: AppLocale;
  gender: ParticipantGender | null;
  lifeContextStatuses: LifeContextStatus[];
  lifeContextNote: string;
  wakeTime: string;
  sleepTime: string;
  preferredActionWindow: PreferredActionWindow;
  availableTime: AvailableTimePerDay;
  intensityPreference: IntensityPreference;
  coachingStyle: CoachingStyle;
  familyStatus: FamilyStatus | '';
  age: string;
  agePreferNot: boolean;
  physicalConsiderations: PhysicalConsideration[];
};

type Props = {
  s: Step1ProfileState;
  set: (p: Partial<Step1ProfileState>) => void;
  onNext: () => void;
};

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-base font-semibold txt-strong">{label}</p>
        {hint && <p className="mt-1 text-sm txt-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ChipButton({
  active, onClick, children,
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
      className={`focus-ring rounded-full px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-[var(--blue)] text-white'
          : 'fill-2 txt-soft hover:fill-3 hover:txt-strong'
      }`}
    >
      {children}
    </button>
  );
}

export function Step1BasicInfo({s, set, onNext}: Props) {
  const t = useTranslations();
  const inferredWindow = useMemo(
    () => inferPreferredActionWindow(s.wakeTime, s.sleepTime),
    [s.wakeTime, s.sleepTime]
  );
  const shortDay = useMemo(
    () => isShortAwakeDay(s.wakeTime, s.sleepTime),
    [s.wakeTime, s.sleepTime]
  );
  const [showMore, setShowMore] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const nameValid = s.name.trim().length > 0;

  function handleNext() {
    setNameTouched(true);
    if (!nameValid) return;
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

  function togglePhysical(item: PhysicalConsideration) {
    set({
      physicalConsiderations: s.physicalConsiderations.includes(item)
        ? s.physicalConsiderations.filter((x) => x !== item)
        : [...s.physicalConsiderations, item],
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-[clamp(1.75rem,4.5vw,2.25rem)] font-bold leading-tight txt-strong">
          {t('onboarding.step1Title')}
        </h1>
        <p className="mt-2 text-sm leading-6 txt-soft">{t('onboarding.step1Body')}</p>
        <p className="mt-1 text-xs txt-faint">{t('onboarding.step1TimeHint')}</p>
      </header>

      <div className="flex flex-col gap-8">
        <Question label={t('onboarding.nameLabel')}>
          <input
            className="focus-ring input-base border-0 fill-2"
            autoFocus
            autoComplete="given-name"
            value={s.name}
            onChange={(e) => set({name: e.target.value})}
            onBlur={() => setNameTouched(true)}
            placeholder={t('onboarding.namePlaceholder')}
            maxLength={60}
            aria-invalid={nameTouched && !nameValid}
            aria-describedby={nameTouched && !nameValid ? 'name-error' : undefined}
          />
          {nameTouched && !nameValid && (
            <p id="name-error" className="text-sm text-red-300" role="alert">
              {t('onboarding.nameRequired')}
            </p>
          )}
        </Question>

        <Question label={t('onboarding.lifeContextQuestion')}>
          <div className="flex flex-wrap gap-2">
            {LIFE_CONTEXT_STATUSES.map((status) => (
              <ChipButton
                key={status}
                active={s.lifeContextStatuses.includes(status)}
                onClick={() => toggleLifeContext(status)}
              >
                {t(`formulation.consent.contexts.${status}`)}
              </ChipButton>
            ))}
          </div>
          {s.lifeContextStatuses.some((c) => c !== 'prefer_not') && (
            <textarea
              className="focus-ring textarea-base min-h-20 border-0 fill-2"
              value={s.lifeContextNote}
              maxLength={200}
              aria-label={t('lifeContext.notePlaceholder')}
              placeholder={t('onboarding.lifeContextNotePlaceholder')}
              onChange={(e) => set({lifeContextNote: e.target.value})}
            />
          )}
        </Question>

        <Question label={t('onboarding.availableTimeLabel')}>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TIME_OPTIONS.map((mins) => (
              <ChipButton
                key={mins}
                active={s.availableTime === mins}
                onClick={() => set({availableTime: mins})}
              >
                {t('onboarding.availableTimeOption', {mins})}
              </ChipButton>
            ))}
          </div>
        </Question>

        <Question label={t('onboarding.intensityLabel')}>
          <div className="flex flex-wrap gap-2">
            {INTENSITY_PREFERENCES.map((pref) => (
              <ChipButton
                key={pref}
                active={s.intensityPreference === pref}
                onClick={() => set({intensityPreference: pref})}
              >
                {t(`onboarding.intensity.${pref}`)}
              </ChipButton>
            ))}
          </div>
        </Question>

        <Question label={t('onboarding.scheduleQuestion')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm txt-muted">{t('onboarding.wakeLabel')}</span>
              <input
                className="focus-ring input-base border-0 fill-2"
                type="time"
                value={s.wakeTime}
                onChange={(e) => set({wakeTime: e.target.value})}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm txt-muted">{t('onboarding.sleepLabel')}</span>
              <input
                className="focus-ring input-base border-0 fill-2"
                type="time"
                value={s.sleepTime}
                onChange={(e) => set({sleepTime: e.target.value})}
              />
            </label>
          </div>
        </Question>

        <Question label={t('onboarding.actionWindowLabel')}>
          {shortDay && (
            <p className="text-sm text-amber-400/90">{t('schedule.actionWindow.shortDay')}</p>
          )}
          {inferredWindow !== 'flexible' && s.preferredActionWindow !== inferredWindow && (
            <button
              type="button"
              className="focus-ring text-start text-sm font-medium text-[var(--blue)] hover:text-[var(--blue)]/80"
              onClick={() => set({preferredActionWindow: inferredWindow})}
            >
              {t('schedule.actionWindow.applySuggested', {
                window: t(`onboarding.actionWindow.${inferredWindow}`),
              })}
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {PREFERRED_ACTION_WINDOWS.map((w) => (
              <ChipButton
                key={w}
                active={s.preferredActionWindow === w}
                onClick={() => set({preferredActionWindow: w})}
              >
                {t(`onboarding.actionWindow.${w}`)}
                {w === inferredWindow && w !== 'flexible'
                  ? ` · ${t('schedule.actionWindow.recommended')}`
                  : ''}
              </ChipButton>
            ))}
          </div>
        </Question>

        <Question label={t('onboarding.languageLabel')}>
          <div className="flex gap-2">
            {(['en', 'he'] as AppLocale[]).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={s.locale === l}
                onClick={() => set({locale: l})}
                className={`focus-ring flex-1 rounded-full py-2.5 text-sm font-medium transition ${
                  s.locale === l
                    ? 'bg-[var(--blue)] text-white'
                    : 'fill-2 txt-soft hover:fill-3'
                }`}
              >
                {l === 'en' ? 'English' : 'עברית'}
              </button>
            ))}
          </div>
        </Question>

        <button
          type="button"
          className="focus-ring self-start text-sm font-medium txt-muted hover:txt-soft"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? t('onboarding.lessOptions') : t('onboarding.moreOptions')}
        </button>

        {showMore && (
          <div className="flex flex-col gap-8 border-t border-[color:var(--color-border)] pt-8">
            <Question label={t('settings.gender')} hint={t('onboarding.genderHelpShort')}>
              <div className="flex flex-wrap gap-2">
                {PARTICIPANT_GENDERS.map((g) => (
                  <ChipButton
                    key={g}
                    active={s.gender === g}
                    onClick={() => set({gender: s.gender === g ? null : g})}
                  >
                    {t(`formulation.consent.genderOptions.${g}`)}
                  </ChipButton>
                ))}
              </div>
            </Question>

            <Question label={t('settings.coachingStyle')}>
              <div className="flex flex-wrap gap-2">
                {COACHING_STYLES.map((style) => (
                  <ChipButton
                    key={style}
                    active={s.coachingStyle === style}
                    onClick={() => set({coachingStyle: style})}
                  >
                    {t(`settings.coachingStyleOption.${style}`)}
                  </ChipButton>
                ))}
              </div>
            </Question>

            <Question
              label={`${t('onboarding.familyLabel')} (${t('onboarding.optional')})`}
            >
              <div className="flex flex-wrap gap-2">
                {FAMILY_STATUSES.map((fs) => (
                  <ChipButton
                    key={fs}
                    active={s.familyStatus === fs}
                    onClick={() => set({familyStatus: s.familyStatus === fs ? '' : fs})}
                  >
                    {t(`onboarding.family.${fs}`)}
                  </ChipButton>
                ))}
              </div>
            </Question>

            <Question label={`${t('settings.age')} (${t('onboarding.optional')})`}>
              {s.agePreferNot ? (
                <button
                  type="button"
                  className="focus-ring self-start rounded-full fill-2 px-4 py-2 text-sm txt-soft"
                  onClick={() => set({agePreferNot: false})}
                >
                  {t('settings.agePreferNot')} ✕
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="focus-ring input-base flex-1 border-0 fill-2"
                    type="number"
                    inputMode="numeric"
                    min={16}
                    max={120}
                    value={s.age}
                    aria-label={t('settings.age')}
                    onChange={(e) => set({age: e.target.value})}
                    placeholder={t('settings.agePlaceholder')}
                  />
                  <button
                    type="button"
                    className="focus-ring shrink-0 rounded-full fill-2 px-4 text-sm txt-muted"
                    onClick={() => set({agePreferNot: true, age: ''})}
                  >
                    {t('settings.agePreferNot')}
                  </button>
                </div>
              )}
            </Question>

            <Question
              label={`${t('onboarding.physicalLabel')} (${t('onboarding.optional')})`}
              hint={t('onboarding.physicalHelpShort')}
            >
              <div className="flex flex-wrap gap-2">
                {PHYSICAL_CONSIDERATIONS.map((item) => (
                  <ChipButton
                    key={item}
                    active={s.physicalConsiderations.includes(item)}
                    onClick={() => togglePhysical(item)}
                  >
                    {t(`onboarding.physical.${item}`)}
                  </ChipButton>
                ))}
              </div>
            </Question>
          </div>
        )}
      </div>

      <button
        type="button"
        className="focus-ring btn-primary mt-2 w-full justify-center disabled:opacity-50"
        onClick={handleNext}
        disabled={!nameValid}
      >
        {t('onboarding.next')} →
      </button>
    </div>
  );
}
