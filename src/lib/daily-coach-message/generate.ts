import type {AppLocale} from '@/i18n/config';
import {resolveDynamicCoachTone} from '@/lib/coach-tone';
import {getUserParticipantProfile} from '@/lib/life-coach/repository';
import type {CoachingStyle} from '@/lib/user-preferences';
import {composeDailyCoachMessage} from './compose';
import {gatherDailyCoachMessageInputs} from './gather-inputs';
import type {DailyCoachMessage} from './types';

export async function generateDailyCoachMessage(
  userId: string,
  date: string,
  locale: AppLocale = 'he'
): Promise<DailyCoachMessage> {
  const profile = await getUserParticipantProfile(userId);
  const inputs = gatherDailyCoachMessageInputs(userId, date, {
    wake_time: profile.wake_time ?? '07:00',
    sleep_time: profile.sleep_time ?? '22:30',
    preferred_action_window: profile.preferred_action_window ?? 'flexible',
  });
  const baseStyle = (profile.coaching_style ?? 'supportive') as CoachingStyle;
  const dynamicTone = resolveDynamicCoachTone(userId, baseStyle, locale);
  return composeDailyCoachMessage(inputs, locale, dynamicTone.effective_style);
}
