'use client';

import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {
  type ScheduleReminderPrefs,
  loadScheduleReminderPrefs,
  requestScheduleReminderPermission,
  saveScheduleReminderPrefs,
} from '@/lib/schedule-reminders';

export function ScheduleReminderSettings({compact = false}: {compact?: boolean}) {
  const t = useTranslations('schedule.reminders');
  const [prefs, setPrefs] = useState<ScheduleReminderPrefs>(() => loadScheduleReminderPrefs());
  const [morningEnabled, setMorningEnabled] = useState(() => prefs.morningEnabled);
  const [eveningEnabled, setEveningEnabled] = useState(() => prefs.eveningEnabled);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => {
      const nextPrefs = loadScheduleReminderPrefs();
      setPrefs(nextPrefs);
      setMorningEnabled(nextPrefs.morningEnabled);
      setEveningEnabled(nextPrefs.eveningEnabled);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function enableReminders() {
    const permission = await requestScheduleReminderPermission();
    if (permission === 'unsupported') {
      setStatus(t('unsupported'));
      return;
    }
    saveScheduleReminderPrefs({morningEnabled, eveningEnabled});
    setStatus(permission === 'granted' ? t('enabled') : t('denied'));
  }

  const wrapperClass = compact
    ? 'mt-8 rounded-[20px] border border-white/10 bg-white/3 p-5'
    : '';

  return (
    <div className={wrapperClass}>
      {!compact && (
        <>
          <p className="field-label mb-0">{t('title')}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('help')}</p>
        </>
      )}
      {compact && <p className="field-label mb-0 text-white/52">{t('title')}</p>}

      <div className="mt-4 space-y-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={morningEnabled}
            onChange={(e) => setMorningEnabled(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-white">{t('morningLabel')}</span>
            <span className="mt-1 block text-xs text-white/45">{t('morningTime', {time: prefs.morningTime})}</span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={eveningEnabled}
            onChange={(e) => setEveningEnabled(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-white">{t('eveningLabel')}</span>
            <span className="mt-1 block text-xs text-white/45">{t('eveningTime', {time: prefs.eveningTime})}</span>
          </span>
        </label>
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${compact ? 'mt-4' : 'mt-5'}`}>
        <button className="focus-ring btn-ghost" type="button" onClick={() => void enableReminders()}>
          {t('enable')}
        </button>
      </div>

      <div aria-live="polite">
        {status && <p className="mt-3 text-sm font-semibold text-[var(--blue)]">{status}</p>}
      </div>
      <p className={`text-xs leading-6 text-white/35 ${compact ? 'mt-4' : 'mt-4'}`}>{t('note')}</p>
    </div>
  );
}
