'use client';

import {useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import {
  loadScheduleReminderPrefs,
  requestScheduleReminderPermission,
  saveScheduleReminderPrefs,
} from '@/lib/schedule-reminders';
import {addMinutesToTime} from '@/lib/schedule-content';
import {syncUserPreferencesToServer} from '@/lib/sync-schedule-to-server';
import {loadUserPreferences, saveUserPreferences} from '@/lib/user-preferences';

export function ScheduleReminderSettings({compact = false}: {compact?: boolean}) {
  const t = useTranslations('schedule.reminders');
  const tRoot = useTranslations();
  const [morningEnabled, setMorningEnabled] = useState(() => loadScheduleReminderPrefs().morningEnabled);
  const [eveningEnabled, setEveningEnabled] = useState(() => loadScheduleReminderPrefs().eveningEnabled);
  const [wakeTime, setWakeTime] = useState(() => loadUserPreferences().wake_time);
  const [sleepTime, setSleepTime] = useState(() => loadUserPreferences().sleep_time);
  const [status, setStatus] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const savingRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const nextPrefs = loadScheduleReminderPrefs();
      setMorningEnabled(nextPrefs.morningEnabled);
      setEveningEnabled(nextPrefs.eveningEnabled);
      const userPrefs = loadUserPreferences();
      setWakeTime(userPrefs.wake_time);
      setSleepTime(userPrefs.sleep_time);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function enableReminders() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSyncState('saving');
    setStatus('');
    try {
      const saved = saveUserPreferences({wake_time: wakeTime, sleep_time: sleepTime});
      await syncUserPreferencesToServer(saved);
    } catch (error) {
      setSyncState('error');
      setStatus(
        t('syncFailed', {detail: resolveLifeCoachErrorMessage(error, tRoot)})
      );
      savingRef.current = false;
      return;
    }

    const permission = await requestScheduleReminderPermission();
    if (permission === 'unsupported') {
      setSyncState('idle');
      setStatus(t('unsupported'));
      savingRef.current = false;
      return;
    }
    saveScheduleReminderPrefs({morningEnabled, eveningEnabled});
    setSyncState('success');
    setStatus(permission === 'granted' ? t('enabled') : t('denied'));
    savingRef.current = false;
  }

  const wrapperClass = compact
    ? 'mt-8 rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5'
    : '';

  const morningTime = addMinutesToTime(wakeTime, 15);
  const eveningTime = addMinutesToTime(sleepTime, -45);
  const isSaving = syncState === 'saving';

  return (
    <div className={wrapperClass}>
      {!compact && (
        <>
          <p className="field-label mb-0">{t('title')}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('help')}</p>
        </>
      )}
      {compact && <p className="field-label mb-0 txt-muted">{t('title')}</p>}

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold txt-muted">{t('wakeTimeLabel')}</span>
            <input
              type="time"
              className="focus-ring input-base"
              value={wakeTime}
              disabled={isSaving}
              onChange={(e) => setWakeTime(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold txt-muted">{t('sleepTimeLabel')}</span>
            <input
              type="time"
              className="focus-ring input-base"
              value={sleepTime}
              disabled={isSaving}
              onChange={(e) => setSleepTime(e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={morningEnabled}
            disabled={isSaving}
            onChange={(e) => setMorningEnabled(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold txt-strong">{t('morningLabel')}</span>
            <span className="mt-1 block text-xs txt-muted">{t('morningTime', {time: morningTime})}</span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={eveningEnabled}
            disabled={isSaving}
            onChange={(e) => setEveningEnabled(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold txt-strong">{t('eveningLabel')}</span>
            <span className="mt-1 block text-xs txt-muted">{t('eveningTime', {time: eveningTime})}</span>
          </span>
        </label>
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${compact ? 'mt-4' : 'mt-5'}`}>
        <button
          className="focus-ring btn-ghost"
          type="button"
          disabled={isSaving}
          aria-busy={isSaving}
          onClick={() => void enableReminders()}
        >
          {isSaving ? t('saving') : t('enable')}
        </button>
      </div>

      <div aria-live="polite">
        {status && (
          <p
            className={`mt-3 text-sm font-semibold ${
              syncState === 'error' ? 'text-red-400' : 'text-[var(--blue)]'
            }`}
            role={syncState === 'error' ? 'alert' : 'status'}
          >
            {status}
          </p>
        )}
      </div>
      <p className={`text-xs leading-6 txt-faint ${compact ? 'mt-4' : 'mt-4'}`}>{t('note')}</p>
    </div>
  );
}
