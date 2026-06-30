import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import type {LifeDomain} from '@/lib/life-coach/types';
import {loadUserPreferences} from '@/lib/user-preferences';

export async function generateDomainDailySteps(
  locale: AppLocale,
  domain: LifeDomain,
  force = false
): Promise<DailyBabyStepResponse[]> {
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
