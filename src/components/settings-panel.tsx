'use client';

import {useTranslations} from 'next-intl';
import {type FormEvent, useEffect, useRef, useState} from 'react';
import {Link} from '@/i18n/navigation';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {
  isParticipantGender,
  normalizeParticipantAge,
  PARTICIPANT_GENDERS,
  type ParticipantGender,
} from '@/lib/formulation/participant-profile';
import {LifeContextChip} from '@/components/life-context-chip';
import {formulationApi, lifeCoachApi} from '@/lib/life-coach/api-client';
import {useLocale} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {LIFE_CONTEXT_STATUSES, type LifeContextStatus} from '@/lib/life-coach/types';
import {
  COACHING_STYLES,
  FAMILY_STATUSES,
  PHYSICAL_CONSIDERATIONS,
  defaultUserPreferences,
  loadUserPreferences,
  saveUserPreferences,
  type FamilyStatus,
  type PhysicalConsideration,
} from '@/lib/user-preferences';
import {syncUserPreferencesToServer} from '@/lib/sync-schedule-to-server';
import {resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import type {UserPreferences} from '@/lib/user-preferences';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {LanguageSwitcher} from './language-switcher';
import {ThemeToggle} from './theme-toggle';
import {ScheduleReminderSettings} from './schedule-reminder-settings';
import {LocalAuthTokenSettings} from './settings/local-auth-token-settings';

export function SettingsPanel() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const displayNameRef = useRef<HTMLInputElement>(null);
  const wakeTimeRef = useRef<HTMLInputElement>(null);
  const sleepTimeRef = useRef<HTMLInputElement>(null);
  const behavioralAnalyticsRef = useRef<HTMLInputElement>(null);
  const [coachingStyle, setCoachingStyle] = useState<string>('supportive');
  const [lifeContexts, setLifeContexts] = useState<LifeContextStatus[]>([]);
  const [lifeContextNote, setLifeContextNote] = useState('');
  const [gender, setGender] = useState<ParticipantGender | null>(null);
  const [age, setAge] = useState('');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus | ''>('');
  const [physical, setPhysical] = useState<PhysicalConsideration[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [lifeContextChanged, setLifeContextChanged] = useState(false);
  const [regeneratingSteps, setRegeneratingSteps] = useState(false);
  const [hasPendingSyncPrefs, setHasPendingSyncPrefs] = useState(false);
  const saveResetTimeoutRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingSyncPrefsRef = useRef<UserPreferences | null>(null);
  const pendingLifeContextImpactRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const prefs = loadUserPreferences();
      if (cancelled) return;
      if (displayNameRef.current) displayNameRef.current.value = prefs.display_name;
      if (wakeTimeRef.current) wakeTimeRef.current.value = prefs.wake_time;
      if (sleepTimeRef.current) sleepTimeRef.current.value = prefs.sleep_time;
      setWakeTime(prefs.wake_time);
      setSleepTime(prefs.sleep_time);
      setFamilyStatus(prefs.family_status ?? '');
      setPhysical(prefs.physical_considerations ?? []);
      if (behavioralAnalyticsRef.current) behavioralAnalyticsRef.current.checked = prefs.behavioral_analytics_enabled;
      setCoachingStyle(prefs.coaching_style);
      setLifeContexts(prefs.life_context_statuses ?? []);
      setLifeContextNote(prefs.life_context_note ?? '');
      setGender(prefs.gender ?? null);
      setAge(prefs.age != null ? String(prefs.age) : '');
      void formulationApi.getParticipantProfile().then((profile) => {
        if (cancelled) return;
        const latest = loadUserPreferences();
        if ((latest.life_context_statuses?.length ?? 0) === 0 && profile.life_context_statuses.length > 0) {
          setLifeContexts(profile.life_context_statuses);
        }
        if (!latest.life_context_note && profile.life_context_note) {
          setLifeContextNote(profile.life_context_note);
        }
        if (!latest.gender && profile.gender && isParticipantGender(profile.gender)) {
          setGender(profile.gender);
        }
        if (latest.age == null && profile.age != null) {
          setAge(String(profile.age));
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (saveResetTimeoutRef.current) {
        window.clearTimeout(saveResetTimeoutRef.current);
      }
    };
  }, []);

  function scheduleSaveReset() {
    if (saveResetTimeoutRef.current) {
      window.clearTimeout(saveResetTimeoutRef.current);
    }
    saveResetTimeoutRef.current = window.setTimeout(() => {
      setSaveState('idle');
      saveResetTimeoutRef.current = null;
    }, 2800);
  }

  async function syncSavedPreferences(
    saved: UserPreferences,
    contextChanged: boolean
  ): Promise<void> {
    pendingSyncPrefsRef.current = saved;
    setHasPendingSyncPrefs(true);
    pendingLifeContextImpactRef.current = contextChanged;
    try {
      await syncUserPreferencesToServer(saved);
      pendingSyncPrefsRef.current = null;
      setHasPendingSyncPrefs(false);
      setLifeContextChanged(contextChanged);
      setSaveMessage(
        contextChanged
          ? t('lifeContext.settings.savedWithImpact')
          : t('settings.savedSynced')
      );
      setSaveState('saved');
      scheduleSaveReset();
    } catch (error) {
      setSaveMessage(
        t('settings.syncFailed', {detail: resolveLifeCoachErrorMessage(error, t)})
      );
      setSaveState('error');
      setLifeContextChanged(false);
    }
  }

  async function retryServerSync() {
    if (savingRef.current) return;
    const prefs = pendingSyncPrefsRef.current ?? loadUserPreferences();
    savingRef.current = true;
    setSaveMessage('');
    setSaveState('saving');
    try {
      await syncUserPreferencesToServer(prefs);
      pendingSyncPrefsRef.current = null;
      setHasPendingSyncPrefs(false);
      setLifeContextChanged(pendingLifeContextImpactRef.current);
      setSaveMessage(
        pendingLifeContextImpactRef.current
          ? t('lifeContext.settings.savedWithImpact')
          : t('settings.savedSynced')
      );
      setSaveState('saved');
      scheduleSaveReset();
    } catch (error) {
      setSaveMessage(
        t('settings.syncFailed', {detail: resolveLifeCoachErrorMessage(error, t)})
      );
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }

  async function savePreferences(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (savingRef.current) return;
    const prevContexts = normalizeLifeContextSelection(
      loadUserPreferences().life_context_statuses ?? []
    );
    const contexts = normalizeLifeContextSelection(lifeContexts);
    const contextChanged =
      JSON.stringify(prevContexts) !== JSON.stringify(contexts);
    const parsedAge = normalizeParticipantAge(age);
    const nextWake = wakeTimeRef.current?.value ?? wakeTime;
    const nextSleep = sleepTimeRef.current?.value ?? sleepTime;
    savingRef.current = true;
    setSaveState('saving');
    const saved = saveUserPreferences({
      display_name: displayNameRef.current?.value ?? '',
      wake_time: nextWake,
      sleep_time: nextSleep,
      preferred_action_window: defaultUserPreferences.preferred_action_window,
      available_time_per_day: defaultUserPreferences.available_time_per_day,
      intensity_preference: defaultUserPreferences.intensity_preference,
      family_status: familyStatus || undefined,
      physical_considerations: physical.length ? physical : undefined,
      coaching_style: coachingStyle as 'supportive' | 'direct' | 'motivational',
      behavioral_analytics_enabled: behavioralAnalyticsRef.current?.checked ?? true,
      gender: gender ?? undefined,
      age: parsedAge ?? undefined,
      life_context_statuses: contexts.length > 0 ? contexts : undefined,
      life_context_note: lifeContextNote.trim() || undefined,
    });
    try {
      await syncSavedPreferences(saved, contextChanged && contexts.length > 0);
    } finally {
      savingRef.current = false;
    }
  }

  async function regenerateTodaySteps() {
    setRegeneratingSteps(true);
    try {
      const prefs = loadUserPreferences();
      await lifeCoachApi.generateDailySteps({
        locale,
        wake_time: prefs.wake_time,
        sleep_time: prefs.sleep_time,
        coaching_style: prefs.coaching_style,
        force: true,
      });
      setSaveMessage(t('lifeContext.settings.stepsRegenerated'));
      setSaveState('saved');
      setLifeContextChanged(false);
      scheduleSaveReset();
    } catch {
      setSaveMessage(t('lifeContext.settings.stepsRegenerateError'));
      setSaveState('error');
    } finally {
      setRegeneratingSteps(false);
    }
  }

  const isSaving = saveState === 'saving';

  return (
    <>
      {saveState === 'saved' ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[80] flex max-w-md -translate-x-1/2 flex-col items-center gap-2 animate-[fadeIn_0.2s_ease-out]"
        >
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-300 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            {saveMessage || t('settings.savedSynced')}
          </div>
          {lifeContextChanged ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="focus-ring rounded-full border border-[var(--blue)]/35 bg-[var(--blue)]/15 px-4 py-2 text-xs font-bold txt-strong"
                disabled={regeneratingSteps}
                aria-busy={regeneratingSteps}
                onClick={() => void regenerateTodaySteps()}
              >
                {regeneratingSteps
                  ? t('lifeContext.settings.regeneratingSteps')
                  : t('lifeContext.settings.regenerateSteps')}
              </button>
              <AiActionHelpMicrocopy kind="lifeContextRegenerate" className="text-center" />
            </div>
          ) : null}
        </div>
      ) : saveState === 'error' ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 left-1/2 z-[80] flex max-w-md -translate-x-1/2 flex-col items-center gap-2 animate-[fadeIn_0.2s_ease-out]"
        >
          <div className="rounded-2xl border border-red-500/30 bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-200 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            {saveMessage}
          </div>
          {hasPendingSyncPrefs ? (
            <button
              type="button"
              className="focus-ring rounded-full border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-100"
              disabled={isSaving}
              aria-busy={isSaving}
              onClick={() => void retryServerSync()}
            >
              {isSaving ? t('settings.saving') : t('settings.retrySync')}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Header */}
      <section className="panel-surface-strong px-6 py-8 sm:px-8 sm:py-10" aria-label={t('settings.title')}>
        <p className="eyebrow">{t('settings.eyebrow')}</p>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t('settings.title')}</h1>
        <p className="mt-4 max-w-2xl leading-8 text-[var(--muted)]">{t('settings.subtitle')}</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <LocalAuthTokenSettings />

          {/* Section: Profile */}
          <section className="panel-surface p-6 sm:p-8" aria-labelledby="settings-profile-heading">
            <SectionHeader title={t('settings.sectionProfile')} id="settings-profile-heading" />
            <form className="mt-5 grid gap-5" onSubmit={savePreferences}>
              <label className="grid gap-2">
                <span className="field-label mb-0">{t('settings.displayName')}</span>
                <input
                  ref={displayNameRef}
                  className="focus-ring input-base"
                  maxLength={60}
                  placeholder={t('settings.displayNamePlaceholder')}
                />
              </label>
              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.gender')}</span>
                <p className="text-xs txt-muted">{t('settings.genderHelp')}</p>
                <div className="flex flex-wrap gap-2">
                  {PARTICIPANT_GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={gender === g}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        gender === g
                          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                          : 'border-[color:var(--color-border)] txt-soft'
                      }`}
                      onClick={() => setGender(g)}
                    >
                      {t(`formulation.consent.genderOptions.${g}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.age')}</span>
                <p className="text-xs txt-muted">{t('settings.ageHelp')}</p>
                <input
                  className="focus-ring input-base w-32"
                  type="number"
                  inputMode="numeric"
                  min={16}
                  max={120}
                  value={age}
                  aria-label={t('settings.age')}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={t('settings.agePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.lifeContext')}</span>
                <p className="text-xs txt-muted">{t('settings.lifeContextHelp')}</p>
                <p className="text-xs txt-muted">{t('lifeContext.settings.impactHelp')}</p>
                <p className="text-xs txt-muted">{t('formulation.consent.lifeContextMulti')}</p>
                <LifeContextChip statuses={lifeContexts} className="mt-1" />
                <div className="flex flex-wrap gap-2">
                  {LIFE_CONTEXT_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={lifeContexts.includes(status)}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        lifeContexts.includes(status)
                          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                          : 'border-[color:var(--color-border)] txt-soft'
                      }`}
                      onClick={() => {
                        setLifeContexts((current) => {
                          if (status === 'prefer_not') {
                            return current.includes('prefer_not') ? [] : ['prefer_not'];
                          }
                          return normalizeLifeContextSelection(
                            current.includes(status)
                              ? current.filter((s) => s !== status)
                              : [...current.filter((s) => s !== 'prefer_not'), status]
                          );
                        });
                      }}
                    >
                      {t(`formulation.consent.contexts.${status}`)}
                    </button>
                  ))}
                </div>
                {lifeContexts.some((c) => c !== 'prefer_not') && (
                  <label className="mt-2 grid gap-2">
                    <span className="text-xs txt-muted">{t('lifeContext.noteLabel')}</span>
                    <textarea
                      className="focus-ring textarea-base min-h-20"
                      value={lifeContextNote}
                      maxLength={200}
                      placeholder={t('lifeContext.notePlaceholder')}
                      onChange={(e) => setLifeContextNote(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="focus-ring btn-primary" type="submit" disabled={isSaving} aria-busy={isSaving}>
                  {isSaving ? t('settings.saving') : t('settings.save')}
                </button>
                <span className="text-sm font-semibold txt-muted">
                  {t('settings.localOnly')}
                </span>
              </div>
            </form>
          </section>

          {/* Section: AI Coaching */}
          <section className="panel-surface p-6 sm:p-8" aria-labelledby="settings-coaching-heading">
            <SectionHeader title={t('settings.coachingTitle')} id="settings-coaching-heading" />
            <div
              className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/6 px-4 py-3"
              role="note"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-sky-200/90">
                {t('settings.coachingImpactTitle')}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-sky-100/85">{t('settings.coachingImpactBody')}</p>
            </div>
            <form className="mt-5 grid gap-6" onSubmit={savePreferences}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="field-label mb-0">{t('settings.wakeTime')}</span>
                  <p className="text-xs leading-5 txt-muted">{t('settings.wakeTimeHelp')}</p>
                  <input
                    ref={wakeTimeRef}
                    type="time"
                    className="focus-ring input-base w-36"
                    defaultValue="07:00"
                    onChange={(e) => setWakeTime(e.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="field-label mb-0">{t('settings.sleepTime')}</span>
                  <p className="text-xs leading-5 txt-muted">{t('settings.sleepTimeHelp')}</p>
                  <input
                    ref={sleepTimeRef}
                    type="time"
                    className="focus-ring input-base w-36"
                    defaultValue="22:30"
                    onChange={(e) => setSleepTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.familyStatus')}</span>
                <div className="flex flex-wrap gap-2">
                  {FAMILY_STATUSES.map((fs) => (
                    <button
                      key={fs}
                      type="button"
                      aria-pressed={familyStatus === fs}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        familyStatus === fs ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong' : 'border-[color:var(--color-border)] txt-soft'
                      }`}
                      onClick={() => setFamilyStatus(familyStatus === fs ? '' : fs)}
                    >
                      {t(`onboarding.family.${fs}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.physicalConsiderations')}</span>
                <p className="text-xs txt-muted">{t('settings.physicalConsiderationsHelp')}</p>
                <div className="flex flex-wrap gap-2">
                  {PHYSICAL_CONSIDERATIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={physical.includes(item)}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        physical.includes(item) ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong' : 'border-[color:var(--color-border)] txt-soft'
                      }`}
                      onClick={() => setPhysical((cur) => cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item])}
                    >
                      {t(`onboarding.physical.${item}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <span className="field-label mb-0">{t('settings.coachingStyle')}</span>
                <p className="text-xs leading-5 txt-muted">{t('settings.coachingStyleHelp')}</p>
                <div className="mt-1 grid gap-2 sm:grid-cols-3">
                  {COACHING_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={`focus-ring rounded-2xl border px-4 py-3 text-sm font-semibold text-start transition ${
                        coachingStyle === style
                          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.14)] txt-strong'
                          : 'border-[color:var(--color-border-strong)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
                      }`}
                      onClick={() => setCoachingStyle(style)}
                      aria-pressed={coachingStyle === style}
                    >
                      <span className="block">{t(`settings.coachingStyleOption.${style}`)}</span>
                      <span className="mt-1 block text-xs font-normal txt-muted">
                        {t(`settings.coachingStyleDesc.${style}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <button className="focus-ring btn-primary" type="submit" disabled={isSaving} aria-busy={isSaving}>
                  {isSaving ? t('settings.saving') : t('settings.save')}
                </button>
              </div>
            </form>
          </section>

          <section className="panel-surface p-6 sm:p-8" aria-labelledby="settings-privacy-heading">
            <SectionHeader title={t('settings.privacyControlsTitle')} id="settings-privacy-heading" />
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[color:var(--color-border)] fill-1 p-4">
              <input
                ref={behavioralAnalyticsRef}
                type="checkbox"
                defaultChecked
                className="focus-ring mt-1 h-4 w-4 accent-[var(--blue)]"
              />
              <span>
                <span className="block text-sm font-bold txt-strong">{t('settings.behavioralAnalytics')}</span>
                <span className="mt-1 block text-xs leading-6 txt-muted">{t('settings.behavioralAnalyticsHelp')}</span>
              </span>
            </label>
            <button
              className="focus-ring btn-primary mt-4"
              type="button"
              disabled={isSaving}
              aria-busy={isSaving}
              onClick={() => void savePreferences()}
            >
              {isSaving ? t('settings.saving') : t('settings.save')}
            </button>
          </section>

          {/* Section: Reminder (#17 — moved from check-in) */}
          <section className="panel-surface p-6 sm:p-8" aria-label={t('schedule.reminders.title')}>
            <ScheduleReminderSettings />
          </section>
        </div>

        <div className="grid gap-6 self-start">
          {/* Section: Appearance */}
          <section className="panel-surface p-6" aria-labelledby="settings-theme-heading">
            <SectionHeader title={t('settings.themeTitle')} id="settings-theme-heading" />
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('settings.themeHelp')}</p>
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </section>

          {/* Section: Language */}
          <section className="panel-surface p-6" aria-labelledby="settings-language-heading">
            <SectionHeader title={t('settings.languageTitle')} id="settings-language-heading" />
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('settings.languageHelp')}</p>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </section>

          {/* Section: Support */}
          <section className="panel-surface p-6" aria-labelledby="settings-support-heading">
            <SectionHeader title={t('settings.secondaryTitle')} id="settings-support-heading" />
            <div className="mt-4 grid gap-2">
              <Link href="/help" className="focus-ring btn-ghost justify-start">
                {t('nav.help')}
              </Link>
              <Link href="/privacy" className="focus-ring btn-ghost justify-start">
                {t('nav.privacy')}
              </Link>
              <Link href="/terms" className="focus-ring btn-ghost justify-start">
                {t('nav.terms')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function SectionHeader({title, id}: {title: string; id?: string}) {
  return (
    <div className="flex items-center gap-3">
      <h2 id={id} className="text-base font-bold txt-strong">{title}</h2>
    </div>
  );
}
