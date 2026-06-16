import type {AppLocale} from '@/i18n/config';
import {dbAll} from '@/lib/db/sqlite';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';
import {
  COACHING_STYLES,
  type CoachingStyle,
} from '@/lib/user-preferences';
import type {
  DynamicCoachTone,
  ToneEffectiveness,
  ToneVersionStats,
} from './types';
import {getToneEffectiveness, saveToneEffectiveness} from './repository';

const CHALLENGING_STYLES: CoachingStyle[] = ['motivational', 'direct'];

function emptyToneStats(): ToneVersionStats {
  return {
    impressions: 0,
    completions: 0,
    skips: 0,
    skips_after_copy: 0,
    completion_rate: 0,
  };
}

function isCoachingStyle(value: string | null | undefined): value is CoachingStyle {
  return typeof value === 'string' && (COACHING_STYLES as readonly string[]).includes(value);
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function hadCoachCopyExposure(step: DailyBabyStep): boolean {
  return !!(step.coach_message_impression_at || step.primary_cta_clicked_at || step.first_viewed_at);
}

function tonePromptHints(
  style: CoachingStyle,
  locale: AppLocale,
  softened: boolean,
  strengthened: boolean
): {preferred_tone: string; avoid_tone: string} {
  const he = locale === 'he';

  if (softened) {
    return he
      ? {
          preferred_tone: 'רך, מעודד, אישור לקצב אישי, צעד קטן אחד',
          avoid_tone: 'לחץ, אינטנסיבי, אשמה, "חייב", דחיפות גבוהה',
        }
      : {
          preferred_tone: 'gentle, validating, permission-giving, one small step',
          avoid_tone: 'pushy, intense, guilt, "you must", high pressure',
        };
  }

  if (strengthened) {
    return he
      ? {
          preferred_tone: 'אנרגטי, תבנית פעולה, מומנטום, אתגר מדוד',
          avoid_tone: 'ריכוך מוגזם, היסוס, פתיחות ארוכה',
        }
      : {
          preferred_tone: 'energetic, action-forward, momentum, measured challenge',
          avoid_tone: 'over-softening, hesitation, long preamble',
        };
  }

  const table: Record<CoachingStyle, {preferred_tone: string; avoid_tone: string}> = {
    supportive: he
      ? {
          preferred_tone: 'חם, מעודד, אמפתי, חגיגת ניצחונות קטנים',
          avoid_tone: 'פקודות קשות, ביקורת, לחץ',
        }
      : {
          preferred_tone: 'warm, encouraging, empathetic, celebrate small wins',
          avoid_tone: 'harsh commands, criticism, pressure',
        },
    direct: he
      ? {
          preferred_tone: 'תמציתי, ישיר, פעולה ראשונה — בלי הקדמות',
          avoid_tone: 'מוטיבציה כללית, פתיח ארוך, ריכוך מיותר',
        }
      : {
          preferred_tone: 'concise, direct, action-first — skip preamble',
          avoid_tone: 'generic motivation, long opener, unnecessary softening',
        },
    motivational: he
      ? {
          preferred_tone: 'מעורר, מניע לפעולה, שפה חזקה וממוקדת',
          avoid_tone: 'היסוס, טון שטוח, הסברים ארוכים',
        }
      : {
          preferred_tone: 'energetic, inspiring, strong action-oriented language',
          avoid_tone: 'hesitation, flat tone, long explanations',
        },
  };

  return table[style];
}

function softenStyle(style: CoachingStyle): CoachingStyle {
  if (style === 'motivational') return 'direct';
  if (style === 'direct') return 'supportive';
  return 'supportive';
}

function strengthenStyle(style: CoachingStyle): CoachingStyle {
  if (style === 'supportive') return 'direct';
  if (style === 'direct') return 'motivational';
  return 'motivational';
}

function computeToneEffectivenessFromSteps(
  steps: DailyBabyStep[],
  baseStyle: CoachingStyle,
  locale: AppLocale = 'he'
): ToneEffectiveness {
  const by_tone = Object.fromEntries(
    COACHING_STYLES.map((tone) => [tone, emptyToneStats()])
  ) as Record<CoachingStyle, ToneVersionStats>;

  for (const step of steps) {
    if (!isCoachingStyle(step.coach_tone)) continue;
    if (step.status === 'pending') continue;

    const stats = by_tone[step.coach_tone];
    const exposed = hadCoachCopyExposure(step);

    if (exposed) stats.impressions += 1;

    if (step.status === 'completed' || step.status === 'partial') {
      stats.completions += 1;
    } else if (step.status === 'skipped') {
      stats.skips += 1;
      if (exposed) stats.skips_after_copy += 1;
    }
  }

  for (const tone of COACHING_STYLES) {
    const stats = by_tone[tone];
    const actionable = stats.completions + stats.skips;
    stats.completion_rate =
      actionable > 0 ? Math.round((stats.completions / actionable) * 100) / 100 : 0;
  }

  const completion_by_tone = Object.fromEntries(
    COACHING_STYLES.map((tone) => [tone, by_tone[tone].completion_rate])
  ) as Record<CoachingStyle, number>;

  let effective_style = baseStyle;
  let softened = false;
  let strengthened = false;

  const motivational = by_tone.motivational;
  const direct = by_tone.direct;
  const supportive = by_tone.supportive;

  const intensiveSkipRate =
    motivational.impressions > 0
      ? motivational.skips_after_copy / motivational.impressions
      : 0;

  if (
    motivational.impressions >= 3 &&
    intensiveSkipRate >= 0.45
  ) {
    effective_style = 'supportive';
    softened = true;
  } else if (
    direct.impressions >= 3 &&
    direct.skips_after_copy / Math.max(1, direct.impressions) >= 0.4
  ) {
    effective_style = softenStyle(baseStyle);
    softened = true;
  } else if (
    CHALLENGING_STYLES.includes(baseStyle) &&
    motivational.impressions >= 3 &&
    intensiveSkipRate >= 0.35
  ) {
    effective_style = softenStyle(effective_style);
    softened = true;
  } else if (
    supportive.impressions >= 5 &&
    supportive.completion_rate >= 0.7
  ) {
    effective_style = strengthenStyle(baseStyle);
    strengthened = true;
  } else if (
    direct.impressions >= 4 &&
    direct.completion_rate >= 0.65 &&
    baseStyle !== 'supportive'
  ) {
    effective_style = 'motivational';
    strengthened = true;
  } else if (
    motivational.impressions >= 3 &&
    motivational.completion_rate >= 0.6
  ) {
    effective_style = 'motivational';
    strengthened = true;
  }

  const hints = tonePromptHints(effective_style, locale, softened, strengthened);

  return {
    base_style: baseStyle,
    effective_style,
    preferred_tone: hints.preferred_tone,
    avoid_tone: hints.avoid_tone,
    by_tone,
    completion_by_tone,
    updated_at: new Date().toISOString(),
  };
}

function computeToneEffectiveness(
  userId: string,
  baseStyle: CoachingStyle,
  locale: AppLocale = 'he',
  windowDays = 14
): ToneEffectiveness {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM daily_steps
     WHERE user_id = ? AND scheduled_date >= ? AND coach_tone IS NOT NULL`,
    [userId, since]
  );

  const steps = rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    goal_id: (row.goal_id as string) ?? null,
    domain: row.domain as DailyBabyStep['domain'],
    title: row.title as string,
    description: (row.description as string) ?? '',
    estimated_minutes: (row.estimated_minutes as number) ?? 15,
    difficulty: row.difficulty as DailyBabyStep['difficulty'],
    scheduled_date: row.scheduled_date as string,
    status: row.status as DailyBabyStep['status'],
    generated_by_ai: !!row.generated_by_ai,
    coach_tone: (row.coach_tone as CoachingStyle) ?? null,
    coach_message_impression_at: (row.coach_message_impression_at as string) ?? null,
    primary_cta_clicked_at: (row.primary_cta_clicked_at as string) ?? null,
    first_viewed_at: (row.first_viewed_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  })) as DailyBabyStep[];

  return computeToneEffectivenessFromSteps(steps, baseStyle, locale);
}

export function resolveDynamicCoachTone(
  userId: string,
  baseStyle: CoachingStyle,
  locale: AppLocale = 'he'
): DynamicCoachTone {
  const stored = getToneEffectiveness(userId);
  const tone_effectiveness =
    stored && stored.base_style === baseStyle
      ? stored
      : computeToneEffectiveness(userId, baseStyle, locale);

  return {
    base_style: baseStyle,
    effective_style: tone_effectiveness.effective_style,
    preferred_tone: tone_effectiveness.preferred_tone,
    avoid_tone: tone_effectiveness.avoid_tone,
    tone_effectiveness,
  };
}

export function refreshToneEffectiveness(
  userId: string,
  baseStyle: CoachingStyle,
  locale: AppLocale = 'he'
): ToneEffectiveness {
  const computed = computeToneEffectiveness(userId, baseStyle, locale);
  saveToneEffectiveness(userId, computed);
  return computed;
}

export function tonePersonalizationForPrompt(tone: DynamicCoachTone | null | undefined) {
  if (!tone) return null;
  return {
    base_coaching_style: tone.base_style,
    effective_coaching_style: tone.effective_style,
    preferred_tone: tone.preferred_tone,
    avoid_tone: tone.avoid_tone,
    completion_by_tone: tone.tone_effectiveness.completion_by_tone,
    tone_stats: tone.tone_effectiveness.by_tone,
  };
}
