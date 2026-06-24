import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import {FALLBACK_WEEKLY_COPY} from '@/lib/life-coach/fallback-copy';

type ReflectionRiskSignal = 'low' | 'medium' | 'high';

type ReflectionNextDayAdjustments = {
  max_tasks: number;
  max_minutes_per_task: number;
  easy_only: boolean;
};

type NextBestAction = import('@/lib/next-best-action').NextBestAction;

export type ReflectionAnalysis = {
  patterns: string[];
  recommendations: string[];
  primary_emotion: string;
  trigger: string;
  blocker: string;
  need: string;
  recommended_adjustment: string;
  risk_signal: ReflectionRiskSignal;
  next_day_adjustments: ReflectionNextDayAdjustments;
  next_best_action?: NextBestAction | null;
};

export type ReflectionAdjustmentMetrics = {
  analyzed_reflections: number;
  adjustments_applied: number;
  adjustment_rate: number;
};

export type ReflectionPlanAdjustments = ReflectionNextDayAdjustments & {
  recommended_adjustment: string;
  risk_signal: ReflectionRiskSignal;
  reflection_date: string;
};

export type BlockerReflectionHints = {
  primary_emotion: string;
  trigger: string;
  blocker: string;
  need: string;
  recommended_adjustment: string;
  risk_signal: ReflectionRiskSignal;
};

export const BLOCKER_REFLECTION_HINTS: Record<
  ReflectionBlockerReason,
  {en: BlockerReflectionHints; he: BlockerReflectionHints}
> = {
  family_chaos: {
    en: {
      primary_emotion: 'overwhelmed',
      trigger: 'family chaos',
      blocker: 'interruptions and competing demands',
      need: 'smaller plan',
      recommended_adjustment: 'one 2-minute step tomorrow',
      risk_signal: 'high',
    },
    he: {
      primary_emotion: 'מוצף',
      trigger: 'כאוס משפחתי',
      blocker: 'הפרעות ועומס מול דרישות',
      need: 'תוכנית קטנה יותר',
      recommended_adjustment: 'צעד אחד של 2 דקות מחר',
      risk_signal: 'high',
    },
  },
  low_energy: {
    en: {
      primary_emotion: 'depleted',
      trigger: 'low energy',
      blocker: 'fatigue',
      need: 'restorative micro-step',
      recommended_adjustment: 'one easy 5-minute step tomorrow',
      risk_signal: 'medium',
    },
    he: {
      primary_emotion: 'מותש',
      trigger: 'אנרגיה נמוכה',
      blocker: 'עייפות',
      need: 'צעד מיקרו מחדש',
      recommended_adjustment: 'צעד קל אחד של 5 דקות מחר',
      risk_signal: 'medium',
    },
  },
  no_time: {
    en: {
      primary_emotion: 'pressured',
      trigger: 'schedule overload',
      blocker: 'no time',
      need: 'shorter step',
      recommended_adjustment: 'one 5-minute step tomorrow',
      risk_signal: 'medium',
    },
    he: {
      primary_emotion: 'לחוץ',
      trigger: 'עומס בלו"ז',
      blocker: 'חוסר זמן',
      need: 'צעד קצר יותר',
      recommended_adjustment: 'צעד אחד של 5 דקות מחר',
      risk_signal: 'medium',
    },
  },
  unclear_task: {
    en: {
      primary_emotion: 'confused',
      trigger: 'unclear task',
      blocker: 'vague next action',
      need: 'concrete first move',
      recommended_adjustment: 'one physical 2-minute step tomorrow',
      risk_signal: 'medium',
    },
    he: {
      primary_emotion: 'מבולבל',
      trigger: 'משימה לא ברורה',
      blocker: 'חוסר פעולה ראשונה ברורה',
      need: 'צעד פיזי קונקרטי',
      recommended_adjustment: 'צעד פיזי אחד של 2 דקות מחר',
      risk_signal: 'medium',
    },
  },
  emotional_resistance: {
    en: {
      primary_emotion: 'resistant',
      trigger: 'emotional avoidance',
      blocker: 'internal resistance',
      need: 'gentler entry',
      recommended_adjustment: 'one 2-minute Plan B step tomorrow',
      risk_signal: 'high',
    },
    he: {
      primary_emotion: 'מתנגד',
      trigger: 'הימנעות רגשית',
      blocker: 'התנגדות פנימית',
      need: 'כניסה עדינה יותר',
      recommended_adjustment: 'צעד Plan B אחד של 2 דקות מחר',
      risk_signal: 'high',
    },
  },
  forgot: {
    en: {
      primary_emotion: 'scattered',
      trigger: 'forgot to start',
      blocker: 'no anchor',
      need: 'visible cue',
      recommended_adjustment: 'attach one 5-minute step to a daily anchor',
      risk_signal: 'low',
    },
    he: {
      primary_emotion: 'מפוזר',
      trigger: 'שכחתי להתחיל',
      blocker: 'אין עוגן',
      need: 'סימן נראה לעין',
      recommended_adjustment: 'לצמיד צעד אחד של 5 דקות להרגל קיים',
      risk_signal: 'low',
    },
  },
  other: {
    en: {
      primary_emotion: 'stuck',
      trigger: 'unclear friction',
      blocker: 'mixed friction',
      need: 'simpler plan',
      recommended_adjustment: FALLBACK_WEEKLY_COPY.oneVisibleStepTomorrow.en,
      risk_signal: 'medium',
    },
    he: {
      primary_emotion: 'תקוע',
      trigger: 'חיכוך לא ברור',
      blocker: 'חיכוך מעורב',
      need: 'תוכנית פשוטה יותר',
      recommended_adjustment: FALLBACK_WEEKLY_COPY.oneVisibleStepTomorrow.he,
      risk_signal: 'medium',
    },
  },
};
