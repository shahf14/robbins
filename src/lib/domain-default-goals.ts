import type {AppLocale} from '@/i18n/config';
import {LIFE_DOMAINS, type LifeDomain} from '@/lib/life-coach/types';

export type DomainDefaultGoalStatus = 'draft' | 'needs_review' | 'published' | 'archived';

export type DomainDefaultGoal = {
  id: string;
  domain: LifeDomain;
  category: string;
  status: DomainDefaultGoalStatus;
  riskLevel: 'low' | 'medium' | 'high';
  active: boolean;
  locale: AppLocale;
  title: string;
  description: string;
  successMetric: string;
  milestone30: string;
  milestone60: string;
  milestone90: string;
  babySteps: string[];
  tags: string[];
  version: number;
  changeNote?: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
};

export type DomainDefaultGoalIssue =
  | 'missing_title'
  | 'missing_description'
  | 'missing_success_metric'
  | 'missing_milestones'
  | 'missing_baby_steps'
  | 'too_many_baby_steps'
  | 'missing_tags';

const STORAGE_KEY = 'robbins-domain-default-goals-v1';

const now = '2026-01-01T00:00:00.000Z';

const domainSeed: Record<LifeDomain, {category: string; titleHe: string; titleEn: string; metricHe: string; metricEn: string}> = {
  health: {
    category: 'energy',
    titleHe: 'לבנות שגרת אנרגיה יומית',
    titleEn: 'Build a daily energy routine',
    metricHe: 'להשלים פעולה בריאותית קטנה לפחות 5 ימים בשבוע',
    metricEn: 'Complete one small health action at least 5 days per week',
  },
  time: {
    category: 'priorities',
    titleHe: 'להחזיר שליטה על השבוע',
    titleEn: 'Regain control of the week',
    metricHe: 'לתכנן 3 פעולות חשובות בתחילת כל יום',
    metricEn: 'Plan 3 important actions at the start of each day',
  },
  wealth: {
    category: 'spending_habits',
    titleHe: 'לבנות בהירות פיננסית',
    titleEn: 'Build financial clarity',
    metricHe: 'לעקוב אחרי הוצאה יומית אחת ולסכם פעם בשבוע',
    metricEn: 'Track one daily expense and review once a week',
  },
  career: {
    category: 'skill_development',
    titleHe: 'להתקדם במיומנות מקצועית אחת',
    titleEn: 'Advance one professional skill',
    metricHe: 'להשקיע 20 דקות בימי עבודה בפיתוח מיומנות',
    metricEn: 'Spend 20 workday minutes developing one skill',
  },
  relationships: {
    category: 'communication',
    titleHe: 'לחזק קשר משמעותי',
    titleEn: 'Strengthen one meaningful relationship',
    metricHe: 'ליזום רגע קשר מכוון 3 פעמים בשבוע',
    metricEn: 'Initiate one intentional connection moment 3 times per week',
  },
  mind: {
    category: 'focus',
    titleHe: 'ליצור שגרת פוקוס רגועה',
    titleEn: 'Create a calm focus routine',
    metricHe: 'לבצע בלוק פוקוס אחד של 15 דקות ביום',
    metricEn: 'Complete one 15-minute focus block per day',
  },
  spirit: {
    category: 'values',
    titleHe: 'לחיות יותר קרוב לערכים שלי',
    titleEn: 'Live closer to my values',
    metricHe: 'לבחור פעולה ערכית אחת בכל בוקר ולבצע אותה',
    metricEn: 'Choose one values-based action each morning and do it',
  },
  house_family: {
    category: 'home_order',
    titleHe: 'להפוך את הבית לקל יותר לניהול',
    titleEn: 'Make home life easier to manage',
    metricHe: 'לסיים פעולת בית קטנה אחת ביום',
    metricEn: 'Complete one small home action per day',
  },
};

function seedFor(domain: LifeDomain, locale: AppLocale): DomainDefaultGoal {
  const seed = domainSeed[domain];
  const he = locale === 'he';
  return {
    id: `default-${domain}-${locale}`,
    domain,
    category: seed.category,
    status: 'published',
    riskLevel: domain === 'health' ? 'high' : 'medium',
    active: true,
    locale,
    title: he ? seed.titleHe : seed.titleEn,
    description: he
      ? 'יעד פתיחה דיפולטיבי שאפשר להתאים לפרופיל המשתמש לפני יצירת תוכנית.'
      : 'A default starter goal that can be adapted to the user profile before plan creation.',
    successMetric: he ? seed.metricHe : seed.metricEn,
    milestone30: he ? 'לבנות עקביות בסיסית בלי עומס.' : 'Build basic consistency without overwhelm.',
    milestone60: he ? 'להעלות בהדרגה את האיכות או התדירות.' : 'Gradually improve quality or frequency.',
    milestone90: he ? 'להפוך את ההרגל לחלק טבעי מהשגרה.' : 'Make the habit a natural part of the routine.',
    babySteps: he
      ? ['בחר פעולה אחת קטנה למחר', 'קבע זמן ביצוע ברור', 'סמן בסוף היום מה עבד']
      : ['Choose one small action for tomorrow', 'Set a clear action time', 'Mark what worked at day end'],
    tags: ['default', domain, seed.category],
    version: 1,
    createdAt: now,
    updatedAt: now,
    isDefault: true,
  };
}

export function createDefaultDomainGoals(): DomainDefaultGoal[] {
  return LIFE_DOMAINS.flatMap((domain) => [seedFor(domain, 'he'), seedFor(domain, 'en')]);
}

function parseGoals(raw: string | null): DomainDefaultGoal[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DomainDefaultGoal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadDomainDefaultGoals(): DomainDefaultGoal[] {
  if (typeof window === 'undefined') return createDefaultDomainGoals();
  const stored = parseGoals(window.localStorage.getItem(STORAGE_KEY));
  const byId = new Map(createDefaultDomainGoals().map((goal) => [goal.id, goal]));
  for (const goal of stored) byId.set(goal.id, goal);
  return [...byId.values()];
}

export function saveDomainDefaultGoals(goals: DomainDefaultGoal[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function duplicateDomainDefaultGoal(goal: DomainDefaultGoal): DomainDefaultGoal {
  const timestamp = new Date().toISOString();
  return {
    ...goal,
    id: crypto.randomUUID(),
    title: `${goal.title} Copy`,
    status: 'draft',
    active: false,
    version: 1,
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateDomainDefaultGoal(goal: DomainDefaultGoal): DomainDefaultGoalIssue[] {
  const issues: DomainDefaultGoalIssue[] = [];
  if (!goal.title.trim()) issues.push('missing_title');
  if (!goal.description.trim()) issues.push('missing_description');
  if (!goal.successMetric.trim()) issues.push('missing_success_metric');
  if (!goal.milestone30.trim() || !goal.milestone60.trim()) issues.push('missing_milestones');
  if (goal.babySteps.filter((step) => step.trim()).length === 0) issues.push('missing_baby_steps');
  if (goal.babySteps.length > 6) issues.push('too_many_baby_steps');
  if (goal.tags.length === 0) issues.push('missing_tags');
  return issues;
}
