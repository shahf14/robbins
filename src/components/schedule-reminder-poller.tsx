'use client';

import {useTranslations} from 'next-intl';
import {useEffect} from 'react';
import {pollScheduleReminders} from '@/lib/schedule-reminders';

export function ScheduleReminderPoller() {
  const t = useTranslations('schedule.reminders');

  useEffect(() => {
    const tick = () => {
      pollScheduleReminders({
        morningTitle: t('morningNotificationTitle'),
        morningBody: t('morningNotificationBody'),
        eveningTitle: t('eveningNotificationTitle'),
        eveningBody: t('eveningNotificationBody'),
      });
    };

    tick();
    const interval = window.setInterval(tick, 30000);
    return () => window.clearInterval(interval);
  }, [t]);

  return null;
}
