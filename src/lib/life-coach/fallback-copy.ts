import type {AppLocale} from '@/i18n/config';

/** Bilingual fallback micro-copy shared across AI and coach surfaces. */
export type BilingualCopy = Readonly<{en: string; he: string}>;

export function pickFallbackCopy(copy: BilingualCopy, locale: AppLocale): string {
  return locale === 'he' ? copy.he : copy.en;
}

/** Daily-step fallback descriptions — the "one small visible move" voice. */
export const FALLBACK_STEP_COPY = {
  busyDayDescription: {
    en: 'Keep it small enough to finish even on a busy day.',
    he: 'שומרים על צעד קטן מספיק כדי לסיים אותו גם ביום עמוס.',
  },
  morningMissionDescription: {
    en: 'This is connected to your morning mission — keep it small and doable today.',
    he: 'זה מחובר למשימת הבוקר שלך — נשאיר את זה קטן ובר ביצוע היום.',
  },
  oneVisibleMoveToday: {
    en: 'Stay with one small, visible move today.',
    he: 'נשארים עם צעד אחד קטן ונראה לעין היום.',
  },
  concreteEasyStart: {
    en: 'Keep it concrete and easy to start.',
    he: 'שומרים על זה מוחשי וקל להתחלה.',
  },
  finishToday: {
    en: 'Keep it small enough to finish today.',
    he: 'שומרים על זה קטן מספיק כדי לסיים היום.',
  },
} as const satisfies Record<string, BilingualCopy>;

/** Weekly-review and identity fallback phrasing. */
export const FALLBACK_WEEKLY_COPY = {
  nextWeekSmallerPlan: {
    en: 'Keep next week smaller, more scheduled, and easier to start.',
    he: 'בשבוע הבא נשמור על תוכנית קטנה, מתוזמנת וקלה יותר להתחלה.',
  },
  nextIdentityFiveMinuteStep: {
    en: 'Tomorrow, one small 5-minute step — to reinforce the identity of someone who continues, not someone who is perfect.',
    he: 'מחר, צעד אחד קטן של 5 דקות — כדי לחזק את הזהות של מי שממשיך, לא של מי שמושלם.',
  },
  oneVisibleStepTomorrow: {
    en: 'one small visible step tomorrow',
    he: 'צעד קטן ונראה אחד מחר',
  },
} as const satisfies Record<string, BilingualCopy>;
