import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';
import {loadUserPreferences} from '@/lib/user-preferences';

export async function generateDomainDailySteps(
  locale: AppLocale,
  domain: LifeDomain,
  force = false
): Promise<DailyBabyStep[]> {
  const {wake_time, sleep_time, coaching_style, physical_considerations, preferred_action_window} =
    loadUserPreferences();
  const {steps} = await lifeCoachApi.generateDailySteps({
    locale,
    domain,
    wake_time,
    sleep_time,
    coaching_style,
    physical_considerations,
    preferred_action_window,
    force,
  });
  return steps;
}
