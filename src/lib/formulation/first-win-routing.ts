import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {buildGoalAlignmentContext} from '@/lib/formulation/goal-alignment';
import {burningFocusHeadline} from '@/lib/formulation/micro-goal-options';
import {
  buildBarrierPlanBStrategy,
  type BarrierPlanBStrategy,
  type PlanBBarrierKind,
} from '@/lib/formulation/plan-b-routing';
import type {LoadAdaptationContext} from '@/lib/formulation/load-adaptation-routing';
import {LIFE_DOMAINS, type FormulationSession, type LifeDomain, type StructuredDailyBabyStep} from '@/lib/life-coach/types';

/** Prefix in reasoning — used for step priority, stripped before UI if needed. */
const FIRST_WIN_REASONING_PREFIX = '[[first_win]]';

type FirstWinContext = {
  locale: AppLocale;
  burning_focus: string;
  value: string | null;
  micro_goal_week: string | null;
  primary_goal_focus: string;
  anticipated_barrier: string | null;
  existing_strengths: string[];
  primary_barrier: PlanBBarrierKind;
  domain: LifeDomain;
};

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function isFirstWinStep(step: {reasoning?: string | null; pain_addressed?: string | null}): boolean {
  return step.reasoning?.startsWith(FIRST_WIN_REASONING_PREFIX) === true;
}

function stripFirstWinPrefix(reasoning: string): string {
  return reasoning.startsWith(FIRST_WIN_REASONING_PREFIX)
    ? reasoning.slice(FIRST_WIN_REASONING_PREFIX.length).trimStart()
    : reasoning;
}

export function firstWinDisplayReasoning(step: {reasoning?: string | null}): string | null {
  const raw = step.reasoning?.trim();
  if (!raw) return null;
  return stripFirstWinPrefix(raw);
}

function resolveDomain(session: FormulationSession): LifeDomain {
  const raw = session.coach_handoff?.suggested_domain;
  if (raw) {
    const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
    if ((LIFE_DOMAINS as readonly string[]).includes(normalized)) {
      return normalized as LifeDomain;
    }
  }
  return 'mind';
}

function actionAnchor(ctx: FirstWinContext): string {
  return clip(
    ctx.micro_goal_week ?? ctx.value ?? ctx.burning_focus ?? ctx.primary_goal_focus,
    72
  );
}

function burningClip(ctx: FirstWinContext): string {
  return clip(ctx.burning_focus, 56);
}

function strengthHint(ctx: FirstWinContext, locale: AppLocale): string | null {
  const s = ctx.existing_strengths[0]?.trim();
  if (!s) return null;
  return clip(s, 48);
}

function minutesForBarrier(
  barrier: PlanBBarrierKind,
  loadAdaptation: LoadAdaptationContext | null
): number {
  const base =
    barrier === 'no_time' || barrier === 'avoidance' || barrier === 'fear_of_failure'
      ? 2
      : barrier === 'low_energy'
        ? 3
        : 2;
  const cap = loadAdaptation?.max_minutes_cap ?? 20;
  return Math.min(base, cap);
}

function buildTitle(
  ctx: FirstWinContext,
  barrier: PlanBBarrierKind,
  anchor: string,
  planB: string | null
): string {
  const he = ctx.locale === 'he';
  const burning = burningClip(ctx);

  if (planB && planB.length <= 72 && !/תכנן|plan the week|plan your week/i.test(planB)) {
    return clip(planB, 72);
  }

  switch (barrier) {
    case 'avoidance':
      if (/הודע|message|email|מייל|whatsapp|וואטס/i.test(`${burning} ${anchor}`)) {
        return he
          ? `שלח הודעה אחת שמורידה לחץ מ${burning}`
          : `Send one message that eases pressure around ${burning}`;
      }
      return he
        ? `2 דק׳ — רק התחלה: ${anchor}`
        : `2 min — just open: ${anchor}`;
    case 'no_time':
      return he ? `2 דק׳: צעד ראשון ל${anchor}` : `2 min: first move toward ${anchor}`;
    case 'low_energy':
      return he ? `גרסה קלה: התחלה קטנה ל${anchor}` : `Light version: tiny start on ${anchor}`;
    case 'fear_of_failure':
      return he ? `רק להתחיל: ${anchor}` : `Just start: ${anchor}`;
    case 'self_criticism':
      return he ? `2 דק׳ בעדינות: ${anchor}` : `2 min, gently: ${anchor}`;
    case 'worry':
      return he
        ? `צעד קטן אחד ל${anchor} — בלי לפתור הכל`
        : `One small step on ${anchor} — not solving everything`;
    default:
      return he ? `הניצחון הראשון: ${anchor}` : `Your first win: ${anchor}`;
  }
}

function buildDescription(ctx: FirstWinContext, barrier: PlanBBarrierKind): string {
  const he = ctx.locale === 'he';
  const anchor = actionAnchor(ctx);
  const barrierNote = ctx.anticipated_barrier
    ? he
      ? `מוריד חסם: ${clip(ctx.anticipated_barrier, 60)}. `
      : `Clears barrier: ${clip(ctx.anticipated_barrier, 60)}. `
    : '';

  const tone =
    barrier === 'avoidance'
      ? he
        ? 'רק לפתוח או לשלוח — לא חייבים להמשיך.'
        : 'Just open or send — you do not have to continue.'
      : barrier === 'no_time'
        ? he
          ? 'מספיק 2 דקות — לא הגרסה המלאה.'
          : '2 minutes is enough — not the full version.'
        : barrier === 'low_energy'
          ? he
            ? 'אפשר בישיבה/במינימום מאמץ — סיום אופציונלי.'
            : 'Can be done seated or with minimal effort — finishing is optional.'
          : he
            ? 'צעד קטן שמחזיר תחושת התחלה.'
            : 'A tiny step that brings back the feeling of starting.';

  return `${barrierNote}${tone} ${he ? 'ממוקד ב' : 'Focused on '}${anchor}.`;
}

function buildPainAddressed(ctx: FirstWinContext): string {
  const he = ctx.locale === 'he';
  const barrier = ctx.anticipated_barrier?.trim();
  if (barrier && barrier.length >= 8) return clip(barrier, 220);

  switch (ctx.primary_barrier) {
    case 'avoidance':
      return he
        ? 'מקטין התנגדות להתחלה — מספיק לפתוח או לשלוח צעד אחד'
        : 'Shrinks resistance to starting — opening or sending one move is enough';
    case 'no_time':
      return he
        ? 'מקטין חסם זמן — גרסה של 2 דקות במקום משימה גדולה'
        : 'Shrinks time barrier — a 2-minute version instead of a big task';
    case 'low_energy':
      return he
        ? 'מקטין עומס אנרגיה — התחלה קלה בלי דרישה לסיים'
        : 'Shrinks energy load — a light start with no finish requirement';
    case 'fear_of_failure':
      return he
        ? 'מקטין פחד מכישלון — רק התחלה, לא שלמות'
        : 'Shrinks fear of failure — just a start, not perfection';
    case 'self_criticism':
      return he
        ? 'מקטין ביקורת עצמית — צעד קטן בלי אשמה'
        : 'Shrinks self-criticism — a small step without guilt';
    case 'worry':
      return he
        ? 'מקטין עומס דאגה — חתיכה אחת קטנה, לא הכל היום'
        : 'Shrinks worry load — one tiny piece, not everything today';
    default:
      return he
        ? 'מקטין חיכוך ומחזיר תחושת "התחלתי" לפני תכנון מלא'
        : 'Shrinks friction and brings back an "I\'ve started" feeling before full planning';
  }
}

function buildReasoning(ctx: FirstWinContext): string {
  const he = ctx.locale === 'he';
  const burning = burningClip(ctx);
  const strength = strengthHint(ctx, ctx.locale);

  let body: string;
  if (he) {
    const strengthLine = strength ? `יש לך כבר ${strength} — ` : '';
    body = `${strengthLine}זה הניצחון הראשון: קצר, קשור ל${burning}, ומוריד חסם אחד. מספיק שתרגיש "התחלתי".`;
  } else {
    const strengthLine = strength ? `You already have ${strength} — ` : '';
    body = `${strengthLine}This is your first win: short, tied to ${burning}, clears one barrier. Feeling "I've started" is enough.`;
  }

  return `${FIRST_WIN_REASONING_PREFIX} ${body}`;
}

function buildFirstWinContext(
  session: FormulationSession,
  locale: AppLocale,
  planBStrategy?: BarrierPlanBStrategy | null
): FirstWinContext | null {
  const handoff = session.coach_handoff;
  if (!handoff) return null;

  const insights = buildFormulationInsights(session, locale);
  const alignment = buildGoalAlignmentContext(session, locale);
  const strategy = planBStrategy ?? buildBarrierPlanBStrategy(session, locale);

  const anchor =
    handoff.micro_goal_week?.trim() ||
    handoff.value?.trim() ||
    alignment.burning_focus_anchor?.trim() ||
    insights.primary_goal_focus;

  if (!anchor) return null;

  return {
    locale,
    burning_focus: burningFocusHeadline(session, locale),
    value: handoff.value?.trim() || null,
    micro_goal_week: handoff.micro_goal_week?.trim() || null,
    primary_goal_focus: insights.primary_goal_focus,
    anticipated_barrier: handoff.anticipated_barrier?.trim() || strategy.anticipated_barrier,
    existing_strengths: session.formulation_approved?.existing_strengths ?? [],
    primary_barrier: strategy.primary_barrier,
    domain: resolveDomain(session),
  };
}

export function buildFirstWinStep(
  session: FormulationSession,
  locale: AppLocale,
  loadAdaptation?: LoadAdaptationContext | null,
  planBStrategy?: BarrierPlanBStrategy | null
): StructuredDailyBabyStep | null {
  const ctx = buildFirstWinContext(session, locale, planBStrategy);
  if (!ctx) return null;

  const strategy = planBStrategy ?? buildBarrierPlanBStrategy(session, locale);
  const anchor = actionAnchor(ctx);
  const planB = session.coach_handoff?.plan_b?.trim() || strategy.coach_plan_b;
  const minutes = minutesForBarrier(ctx.primary_barrier, loadAdaptation ?? null);

  return {
    domain: ctx.domain,
    goal_id: null,
    title: buildTitle(ctx, ctx.primary_barrier, anchor, planB),
    description: buildDescription(ctx, ctx.primary_barrier),
    estimated_minutes: minutes,
    difficulty: 'easy',
    reasoning: buildReasoning(ctx),
    pain_addressed: buildPainAddressed(ctx),
    expected_resistance: ctx.anticipated_barrier ?? undefined,
    success_signal:
      locale === 'he'
        ? 'הרגשת ש"התחלתי" — גם בלי לסיים'
        : 'You felt "I\'ve started" — even without finishing',
    fallback_title:
      locale === 'he'
        ? `2 דק׳: רק לפתוח את ${clip(anchor, 40)}`
        : `2 min: just open ${clip(anchor, 40)}`,
    fallback_description:
      locale === 'he'
        ? 'גרסת Plan B — רק התחלה, בלי שלמות.'
        : 'Plan B — just a start, not perfection.',
    fallback_estimated_minutes: Math.min(2, minutes),
  };
}

export function prependFirstWinToSteps(
  steps: StructuredDailyBabyStep[],
  firstWin: StructuredDailyBabyStep,
  maxSteps?: number
): StructuredDailyBabyStep[] {
  const withoutDup = steps.filter(
    (step) => !isFirstWinStep(step) && step.title.trim() !== firstWin.title.trim()
  );
  const merged = [firstWin, ...withoutDup];
  if (maxSteps != null && maxSteps > 0) {
    return merged.slice(0, maxSteps);
  }
  return merged;
}
