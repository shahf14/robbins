import type {AppLocale} from '@/i18n/config';
import {resolveGenderedHebrewText, resolveParticipantGender} from '@/lib/gendered-copy';
import {loadUserPreferences} from '@/lib/user-preferences';import type {LifeContextStatus} from '@/lib/life-coach/types';
import {LIFE_CONTEXT_STATUSES} from '@/lib/life-coach/types';

const LIFE_CONTEXT_HE: Record<LifeContextStatus, string> = {
  student: 'סטודנט/ית',
  new_parent: 'הורה לתינוק/וקטן',
  manager: 'מנהל/ת / עומס בעבודה',
  caregiver: 'מטפל/ת',
  between_jobs: 'בין עבודות / מעבר',
  other: 'אחר',
  prefer_not: 'מעדיף/ה לא לציין',
};

const LIFE_CONTEXT_EN: Record<LifeContextStatus, string> = {
  student: 'Student',
  new_parent: 'New parent',
  manager: 'Manager / work overload',
  caregiver: 'Caregiver',
  between_jobs: 'Between jobs / transition',
  other: 'Other',
  prefer_not: 'Prefer not to say',
};

const ADAPTATION_HE: Partial<Record<LifeContextStatus, string>> = {
  student:
    'זמן מוגבל ולו"ז לימודים — צעדים קצרים (3–10 דק׳), גמישים סביב מבחנים ושעות לימוד.',
  new_parent:
    'שינה מקוטעת וזמן מוגבל — צעדים קטנים מאוד (2–5 דק׳), ניתנים לביצוע בבית, בלי לצאת מהבית.',
  manager:
    'עומס עבודה ומעברים רבים — צעדים שמתאימים לפסקות קצרות, עם גבולות זמן ברורים.',
  caregiver:
    'עומס טיפולי — אל תציע צעדים שדורשים להיעדר מהבית לזמן ארוך; העדף מה שניתן לעשות לצד הטיפול.',
  between_jobs:
    'מעבר תעסוקתי — הימנע מלחץ ביצועים; התמקד בצעדים קטנים שבונים יציבות וזהות, לא "הישגים גדולים".',
  other: 'התאם את הצעדים למציאות היומיומית של המשתמש/ת, לא לתבנית גנרית.',
};

const ADAPTATION_EN: Partial<Record<LifeContextStatus, string>> = {
  student:
    'Limited time and study schedule — short steps (3–10 min), flexible around exams and class hours.',
  new_parent:
    'Fragmented sleep and scarce time — very small steps (2–5 min), doable at home without leaving.',
  manager:
    'Work overload and context switching — steps that fit short breaks with clear time boundaries.',
  caregiver:
    'Care load — do not suggest long absences from home; prefer actions alongside caregiving duties.',
  between_jobs:
    'Job transition — avoid performance pressure; focus on small stability-building steps, not big wins.',
  other: 'Adapt steps to the user\'s daily reality, not a generic template.',
};

function isLifeContextStatus(value: string): value is LifeContextStatus {
  return (LIFE_CONTEXT_STATUSES as readonly string[]).includes(value);
}

function lifeContextLabel(
  status: LifeContextStatus,
  locale: AppLocale,
  gender?: string | null
): string {
  if (locale !== 'he') return LIFE_CONTEXT_EN[status];
  return resolveGenderedHebrewText(
    LIFE_CONTEXT_HE[status],
    resolveParticipantGender(gender ?? loadUserPreferences().gender ?? null)
  );
}
export function normalizeLifeContextStatuses(
  raw: string[] | LifeContextStatus[] | null | undefined
): LifeContextStatus[] {
  if (!raw?.length) return [];
  const out: LifeContextStatus[] = [];
  for (const s of raw) {
    if (isLifeContextStatus(s)) out.push(s);
  }
  return out;
}

export function formatLifeContextLabels(
  statuses: LifeContextStatus[] | string[] | null | undefined,
  locale: AppLocale,
  gender?: string | null
): string[] {
  return normalizeLifeContextStatuses(statuses)
    .filter((s) => s !== 'prefer_not')
    .map((s) => lifeContextLabel(s, locale, gender));
}
export function lifeContextForPrompt(
  statuses: LifeContextStatus[] | null | undefined,
  locale: AppLocale,
  gender?: string | null
): {statuses: LifeContextStatus[]; labels: string[]} {
  const filtered = (statuses ?? []).filter((s) => s !== 'prefer_not');
  return {
    statuses: filtered,
    labels: filtered.map((s) => lifeContextLabel(s, locale, gender)),
  };
}
export function buildLifeContextAdaptationHint(
  statuses: LifeContextStatus[] | null | undefined,
  locale: AppLocale
): string {
  const filtered = (statuses ?? []).filter((s) => s !== 'prefer_not');
  if (filtered.length === 0) return '';

  const map = locale === 'he' ? ADAPTATION_HE : ADAPTATION_EN;
  const hints = filtered.map((s) => map[s]).filter(Boolean) as string[];

  if (hints.length === 0) return '';

  const header =
    locale === 'he'
      ? '## התאמה להקשר חיים (חובה):'
      : '## Life context adaptation (required):';

  return [header, ...hints.map((h) => `- ${h}`)].join('\n');
}

/** Theme phrase fallback when step-3 ratings are weak or absent. */
export function lifeContextThemeFallback(
  statuses: LifeContextStatus[] | null | undefined,
  locale: AppLocale,
  gender?: string | null
): string | null {
  const primary = (statuses ?? []).find((s) => s !== 'prefer_not' && s !== 'other');
  if (!primary) return null;

  const themeHe: Partial<Record<LifeContextStatus, string>> = {
    student: 'לימודים והלחץ סביבם',
    new_parent: 'הורות ושינה מקוטעת',
    manager: 'עומס בעבודה וגבולות',
    caregiver: 'עומס הטיפול והאחריות',
    between_jobs: 'מעבר תעסוקתי ויציבות',
  };

  const themeEn: Partial<Record<LifeContextStatus, string>> = {
    student: 'studies and academic pressure',
    new_parent: 'parenting and fragmented sleep',
    manager: 'work overload and boundaries',
    caregiver: 'caregiving load and responsibility',
    between_jobs: 'job transition and stability',
  };

  const map = locale === 'he' ? themeHe : themeEn;
  return map[primary] ?? lifeContextLabel(primary, locale, gender);
}