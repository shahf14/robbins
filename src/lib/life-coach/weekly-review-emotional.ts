import type {AppLocale} from '@/i18n/config';
import {FALLBACK_WEEKLY_COPY, pickFallbackCopy} from '@/lib/life-coach/fallback-copy';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import type {
  DailyReflection,
  Goal,
  WeeklyReviewEmotionalReflection,
} from '@/lib/life-coach/types';

/** "1 step" / "3 steps" / "צעד אחד" / "3 צעדים" — keeps count and noun in agreement. */
function stepsWord(count: number, he: boolean): string {
  if (he) return count === 1 ? 'צעד אחד' : `${count} צעדים`;
  return count === 1 ? '1 step' : `${count} steps`;
}

export type WeeklyExecutionSnapshot = {
  completed: Array<{date: string; title: string; minutes: number}>;
  skipped: Array<{date: string; title: string}>;
  partial: Array<{date: string; title: string}>;
  pending: Array<{date: string; title: string}>;
  totals: {completed: number; skipped: number; partial: number; pending: number; planned: number};
};

export function filterStepsInPeriod(
  steps: DailyBabyStepResponse[],
  periodStart: string,
  periodEnd: string
): DailyBabyStepResponse[] {
  return steps.filter(
    (step) => step.scheduled_date >= periodStart && step.scheduled_date <= periodEnd
  );
}

export function buildWeeklyExecutionSnapshot(
  steps: DailyBabyStepResponse[],
  periodStart: string,
  periodEnd: string
): WeeklyExecutionSnapshot {
  const periodSteps = filterStepsInPeriod(steps, periodStart, periodEnd);
  const completed = periodSteps
    .filter((step) => step.status === 'completed')
    .map((step) => ({
      date: step.scheduled_date,
      title: step.title,
      minutes: step.estimated_minutes,
    }));
  const skipped = periodSteps
    .filter((step) => step.status === 'skipped')
    .map((step) => ({date: step.scheduled_date, title: step.title}));
  const partial = periodSteps
    .filter((step) => step.status === 'partial')
    .map((step) => ({date: step.scheduled_date, title: step.title}));
  const pending = periodSteps
    .filter((step) => step.status === 'pending')
    .map((step) => ({date: step.scheduled_date, title: step.title}));

  return {
    completed,
    skipped,
    partial,
    pending,
    totals: {
      completed: completed.length,
      skipped: skipped.length,
      partial: partial.length,
      pending: pending.length,
      planned: periodSteps.length,
    },
  };
}

export function collectIdentityPhrases(goals: Goal[]): string[] {
  const phrases: string[] = [];

  for (const goal of goals) {
    if (goal.description?.trim()) phrases.push(goal.description.trim());
    if (goal.success_metric?.trim()) phrases.push(goal.success_metric.trim());
  }

  return [...new Set(phrases)].slice(0, 8);
}

function blockerLabel(blocker: string | null | undefined, he: boolean): string | null {
  if (!blocker) return null;
  const mapHe: Record<string, string> = {
    low_energy: 'אין לי אנרגיה',
    no_time: 'אין זמן',
    forgot: 'שכחתי',
    unclear_task: 'משימה לא ברורה',
    emotional_resistance: 'התנגדות רגשית',
    family_chaos: 'כאוס משפחתי',
    too_hard: 'קשה מדי',
    other: 'משהו אחר',
  };
  if (he) return mapHe[blocker] ?? blocker;
  return blocker.replaceAll('_', ' ');
}

function findComebackMoment(
  steps: DailyBabyStepResponse[],
  reflections: DailyReflection[],
  periodStart: string,
  periodEnd: string,
  he: boolean
): {hardDate: string; hardSignal: string; returnDate: string; returnTitle: string} | null {
  const periodSteps = filterStepsInPeriod(steps, periodStart, periodEnd);
  const byDate = new Map<string, DailyBabyStepResponse[]>();
  for (const step of periodSteps) {
    const list = byDate.get(step.scheduled_date) ?? [];
    list.push(step);
    byDate.set(step.scheduled_date, list);
  }

  const dates = [...byDate.keys()].sort();
  const reflectionByDate = new Map(reflections.map((r) => [r.date, r]));

  for (let i = 0; i < dates.length - 1; i++) {
    const hardDate = dates[i];
    const returnDate = dates[i + 1];
    const hardSteps = byDate.get(hardDate) ?? [];
    const returnSteps = byDate.get(returnDate) ?? [];
    const hardDayFailed =
      hardSteps.length > 0 &&
      hardSteps.every((step) => step.status === 'skipped' || step.status === 'partial');
    const reflection = reflectionByDate.get(hardDate);
    const hardSignal =
      reflection?.reflection_text?.trim() ||
      blockerLabel(reflection?.blocker_reason, he) ||
      (hardDayFailed ? (he ? 'יום קשה' : 'a hard day') : '');
    const comebackStep = returnSteps.find((step) => step.status === 'completed');

    if ((hardDayFailed || reflection?.blocker_reason) && comebackStep) {
      return {
        hardDate,
        hardSignal,
        returnDate,
        returnTitle: comebackStep.title,
      };
    }
  }

  return null;
}

export const PROGRESS_EVIDENCE_PROMPT_BLOCK = [
  '## Progress evidence (required):',
  'Add progress_evidence: one concrete proof sentence that the user is becoming more consistent or resilient.',
  'Find ONE behavior from week_execution — return after skip, partial completion, or showing up after a hard day.',
  'Even imperfect weeks MUST include progress_evidence when there was any comeback after a skip.',
  'Cite a specific step title or date when possible. Never generic motivation talk.',
  'Hebrew locale: prefer opening with "הוכחה השבוע:".',
].join('\n');

export function buildProgressEvidenceFallback(input: {
  locale: AppLocale;
  recentSteps: DailyBabyStepResponse[];
  recentReflections: DailyReflection[];
  period_start: string;
  period_end: string;
}): string {
  const he = input.locale === 'he';
  const snapshot = buildWeeklyExecutionSnapshot(
    input.recentSteps,
    input.period_start,
    input.period_end
  );
  const comeback = findComebackMoment(
    input.recentSteps,
    input.recentReflections,
    input.period_start,
    input.period_end,
    he
  );

  if (comeback) {
    return he
      ? `הוכחה השבוע: חזרת ל"${comeback.returnTitle}" ב-${comeback.returnDate} אחרי קושי ב-${comeback.hardDate} — זו עקביות אמיתית, לא מושלמות.`
      : `Proof this week: you returned to "${comeback.returnTitle}" on ${comeback.returnDate} after difficulty on ${comeback.hardDate} — that is real consistency, not perfection.`;
  }

  if (snapshot.completed.length > 0) {
    const win = snapshot.completed[0];
    return he
      ? `הוכחה השבוע: השלמת "${win.title}" ב-${win.date} — גם בשבוע לא מושלם, אתה מתקדם.`
      : `Proof this week: you completed "${win.title}" on ${win.date} — even in an imperfect week, you are moving forward.`;
  }

  if (snapshot.partial.length > 0) {
    const partial = snapshot.partial[0];
    return he
      ? `הוכחה השבוע: התחלת "${partial.title}" ב-${partial.date} גם כשלא סיימת — זו חוסן, לא כישלון.`
      : `Proof this week: you started "${partial.title}" on ${partial.date} even without finishing — that is resilience, not failure.`;
  }

  if (snapshot.totals.skipped > 0) {
    return he
      ? 'הוכחה השבוע: לא ויתרת על השבוע אחרי דילוגים — נוכחות חוזרת היא התחלה של עקביות.'
      : 'Proof this week: you did not abandon the week after skips — showing up again is the start of consistency.';
  }

  return he
    ? 'הוכחה השבוע: הופעת לבדוק ולנסות — זה כבר צעד של מישהו שמתקדם.'
    : 'Proof this week: you showed up to check in and try — that is already someone who is moving forward.';
}

export function buildEmotionalReflectionFallback(input: {
  locale: AppLocale;
  recentSteps: DailyBabyStepResponse[];
  recentReflections: DailyReflection[];
  activeGoals: Goal[];
  period_start: string;
  period_end: string;
}): WeeklyReviewEmotionalReflection {
  const he = input.locale === 'he';
  const snapshot = buildWeeklyExecutionSnapshot(
    input.recentSteps,
    input.period_start,
    input.period_end
  );
  const identityPhrases = collectIdentityPhrases(input.activeGoals);
  const primaryWhy = identityPhrases[0] ?? null;
  const comeback = findComebackMoment(
    input.recentSteps,
    input.recentReflections,
    input.period_start,
    input.period_end,
    he
  );

  if (comeback) {
    return {
      identity_proof: he
        ? `השלמת ${stepsWord(snapshot.totals.completed, true)} השבוע — כולל "${comeback.returnTitle}" אחרי יום קשה.`
        : `You completed ${stepsWord(snapshot.totals.completed, false)} this week — including "${comeback.returnTitle}" after a hard day.`,
      comeback_evidence: he
        ? `ביום ${comeback.hardDate} הופיע ${comeback.hardSignal || 'קושי'}, וב-${comeback.returnDate} בכל זאת חזרת לפעולה.`
        : `On ${comeback.hardDate} you faced ${comeback.hardSignal || 'a struggle'}, and on ${comeback.returnDate} you still took action.`,
      meaning_statement: he
        ? snapshot.totals.planned > 0 && snapshot.totals.completed < snapshot.totals.planned
          ? `השלמת ${snapshot.totals.completed} מתוך ${snapshot.totals.planned} צעדים, אבל זה לא הסיפור החשוב. הסיפור הוא שאחרי קושי חזרת למסלול בעדינות — לא דרך כוח, אלא דרך חזרה. זו התקדמות אמיתית.`
          : `השבוע הוכחת שאתה יכול לחזור למסלול אחרי קושי. זה בונה זהות של מישהו שלא נשבר מיום אחד קשה.`
        : snapshot.totals.planned > 0 && snapshot.totals.completed < snapshot.totals.planned
          ? `You completed ${snapshot.totals.completed} of ${snapshot.totals.planned} steps, but that is not the whole story. You returned gently after difficulty — not through force, but through comeback. That is real progress.`
          : `This week you showed you can return after difficulty. That builds an identity of someone who does not break from one hard day.`,
      confidence_builder: he
        ? primaryWhy
          ? `המשפט "${primaryWhy.slice(0, 80)}${primaryWhy.length > 80 ? '…' : ''}" מקבל עכשיו הוכחה מההתנהגות שלך — לא רק כוונה.`
          : 'יש לך הוכחה השבוע שהתקדמות לא מושלמת עדיין שווה משמעות.'
        : primaryWhy
          ? `"${primaryWhy.slice(0, 80)}${primaryWhy.length > 80 ? '…' : ''}" now has behavioral proof — not just intention.`
          : 'You have proof this week that imperfect progress still matters.',
      next_identity_action: he
        ? comeback.returnTitle
          ? `מחר, חזור על צעד קצר דמוי "${comeback.returnTitle}" — 5 דקות שמחזקות את הזהות של מי שחוזר למסלול.`
          : 'מחר, בחר צעד אחד של 5 דקות שמוכיח שאתה ממשיך — גם אם השבוע לא היה מושלם.'
        : comeback.returnTitle
          ? `Tomorrow, repeat a short step like "${comeback.returnTitle}" — 5 minutes that reinforce your comeback identity.`
          : 'Tomorrow, pick one 5-minute step that proves you continue — even if the week was not perfect.',
    };
  }

  const completedTitles = snapshot.completed.slice(0, 2).map((step) => step.title);
  return {
    identity_proof: he
      ? completedTitles.length > 0
        ? `השלמת צעדים אמיתיים השבוע — כולל ${completedTitles.join(' ו-')}.`
        : 'הופעת השבוע, גם כשלא היה קל — וזה כבר הוכחה של מחויבות.'
      : completedTitles.length > 0
        ? `You completed real steps this week — including ${completedTitles.join(' and ')}.`
        : 'You showed up this week even when it was not easy — that is already proof of commitment.',
    comeback_evidence: he
      ? snapshot.totals.skipped > 0
        ? `גם כשדילגת על ${stepsWord(snapshot.totals.skipped, true)}, לא ויתרת על השבוע כולו.`
        : 'כל יום שבו ניסית — גם חלקית — הוא חזרה למסלול.'
      : snapshot.totals.skipped > 0
        ? `Even when you skipped ${stepsWord(snapshot.totals.skipped, false)}, you did not abandon the whole week.`
        : 'Every day you tried — even partially — is a return to the path.',
    meaning_statement: he
      ? snapshot.totals.completed > 0
        ? `גם בשבוע לא מושלם, יש הוכחה שאתה נהיה אדם שממשיך לזוז קדימה. המספרים הם רק רקע — הסיפור הוא המשכיות.`
        : 'השבוע עדיין בנה משהו חשוב: נוכחות. זה הבסיס לזהות של מישהו שלא מוותר על עצמו.'
      : snapshot.totals.completed > 0
        ? `Even in an imperfect week, there is proof you are becoming someone who keeps moving forward. Numbers are background — continuity is the story.`
        : 'This week still built something important: presence. That is the base identity of someone who does not give up on themselves.',
    confidence_builder: he
      ? primaryWhy
        ? `מה שחשוב לך — "${primaryWhy.slice(0, 80)}${primaryWhy.length > 80 ? '…' : ''}" — מתחיל להתחבר לפעולות קטנות שכבר עשית.`
        : 'הפעולות הקטנות שלך מתחילות להיראות כמו בחירה בזהות, לא רק כמו משימות.'
      : primaryWhy
        ? `What matters to you — "${primaryWhy.slice(0, 80)}${primaryWhy.length > 80 ? '…' : ''}" — is starting to connect to small actions you already took.`
        : 'Your small actions are starting to look like identity choices, not just tasks.',
    next_identity_action: pickFallbackCopy(
      FALLBACK_WEEKLY_COPY.nextIdentityFiveMinuteStep,
      input.locale
    ),
  };
}
