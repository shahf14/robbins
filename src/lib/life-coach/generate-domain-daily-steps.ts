import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {loadUserPreferences} from '@/lib/user-preferences';

export async function generateDomainDailySteps(locale: AppLocale, force = false): Promise<void> {
  const {wake_time, sleep_time, coaching_style, physical_considerations, preferred_action_window} =
    loadUserPreferences();
  await lifeCoachApi.generateDailySteps({
    locale,
    wake_time,
    sleep_time,
    coaching_style,
    physical_considerations,
    preferred_action_window,
    force,
  });
}
