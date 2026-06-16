import type {AppLocale} from '@/i18n/config';
import {detectCentralBlocker} from '@/lib/formulation/mindset-exercises';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import type {FormulationSession} from '@/lib/life-coach/types';

type ComebackTone = 'self_criticism' | 'avoidance' | 'overload' | 'general';

export type ComebackMessaging = {
  tone: ComebackTone;
  /** Modal header after skip */
  skip_primary: string;
  /** Modal header after partial */
  partial_primary: string;
  skip_toast: string;
  partial_toast: string;
  skip_coach_intro: string;
  skip_coach_saved: string;
  survival_done_easy: string;
  survival_done_skip: string;
  survival_done_pause: string;
};

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function ratingDistress(session: FormulationSession, key: string): number {
  const rating = session.passive_ratings.find((r) => r.key === key);
  return rating ? distressWeight(rating.key, rating.score) : 0;
}

function resolveTone(session: FormulationSession, locale: AppLocale): ComebackTone {
  const central = detectCentralBlocker(session, locale);
  if (
    central.dominant_blocker === 'self_criticism' ||
    central.dominant_blocker === 'guilt'
  ) {
    return 'self_criticism';
  }
  if (central.dominant_blocker === 'avoidance') {
    return 'avoidance';
  }

  const blob = [
    session.coach_handoff?.anticipated_barrier,
    session.formulation_approved?.presenting_concern_user_words,
    ...(session.formulation_approved?.maintaining_factors ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  if (/overload|overwhelm|עומס|היעלמ|disappear|too much|הכל יחד/i.test(blob)) {
    return 'overload';
  }
  if (ratingDistress(session, 'self_criticism') >= 4) return 'self_criticism';
  if (ratingDistress(session, 'avoidance') >= 4) return 'avoidance';

  return 'general';
}

function pickStrength(session: FormulationSession): string | null {
  const strengths = session.formulation_approved?.existing_strengths ?? [];
  const first = strengths.find((s) => s.trim().length >= 6);
  return first?.trim() ?? null;
}

function buildMessages(input: {
  locale: AppLocale;
  tone: ComebackTone;
  concern: string | null;
  barrier: string | null;
  value: string | null;
  planB: string | null;
  strength: string | null;
}): ComebackMessaging {
  const he = input.locale === 'he';
  const concern = input.concern ? clip(input.concern, 55) : null;
  const barrier = input.barrier ? clip(input.barrier, 55) : null;
  const value = input.value ? clip(input.value, 45) : null;
  const planB = input.planB ? clip(input.planB, 70) : null;
  const strength = input.strength ? clip(input.strength, 45) : null;

  if (input.tone === 'overload') {
    const anchor = concern
      ? he
        ? `אמרת ש${concern}`
        : `you said ${concern}`
      : barrier
        ? he
          ? barrier
          : barrier
        : he
          ? 'העומס מצטבר'
          : 'the load builds up';

    return {
      tone: input.tone,
      skip_primary: he
        ? `זה בדיוק המקום שבו ${anchor}. היום לא צריך להוכיח הכול — רק לחזור בצעד קטן.`
        : `This is exactly where ${anchor}. You don't need to prove everything today — just one small step back.`,
      partial_primary: he
        ? `התחלת למרות ${anchor}. partial נספר — לא מסיימים הכול היום.`
        : `You started despite ${anchor}. Partial counts — you don't need to finish everything today.`,
      skip_toast: he
        ? 'יום קשה — לא שובר את הדרך. נחזור בקטן.'
        : "Hard day — it doesn't break the path. We'll return small.",
      partial_toast: he
        ? 'התחלת — זה חזרה למסלול, גם בלי סיום.'
        : 'You started — that is a return to the path, even without finishing.',
      skip_coach_intro: he
        ? `נכייל לפי ${barrier || concern || 'מה שעצר אותך'} — לא נעניש.`
        : `Let's adjust for ${barrier || concern || 'what stopped you'} — not punish.`,
      skip_coach_saved: he
        ? 'שמרנו התאמה קטנה למחר — בלי אשמה.'
        : 'Saved a small adjustment for tomorrow — no guilt.',
      survival_done_easy: he
        ? 'בחרת בגרסה קלה — זו חזרה חכמה, לא ויתור.'
        : 'You chose the easy version — smart return, not giving up.',
      survival_done_skip: he
        ? 'סימנת שהיום קשה. מחר צעד קטן — בלי להוכיח הכול.'
        : "Marked today as hard. Tomorrow a small step — no need to prove everything.",
      survival_done_pause: he
        ? 'השהית את היום. זה מותר — נחזור כשיהיה מקום.'
        : 'Paused the day. That is allowed — we return when there is room.',
    };
  }

  if (input.tone === 'self_criticism') {
    const softAnchor = strength
      ? he
        ? `${strength} עדיין כאן`
        : `${strength} is still here`
      : he
        ? 'זה לא שופט אותך'
        : 'this is not judging you';

    return {
      tone: input.tone,
      skip_primary: he
        ? `עצרת — ו${softAnchor}. היום לא בוחנים אותך, רק חוזרים ב${planB || 'צעד קטן'}.`
        : `You stopped — and ${softAnchor}. Today is not a test, just ${planB || 'one small step back'}.`,
      partial_primary: he
        ? `עשית חלק — ${softAnchor}. partial נספר, בלי אשמה.`
        : `You did part — ${softAnchor}. Partial counts, without guilt.`,
      skip_toast: he
        ? 'עצרת — לא נכשלת. נחזור בקטן.'
        : 'You stopped — you did not fail. We return small.',
      partial_toast: he
        ? 'התחלת למרות הקול הפנימי — זה נספר.'
        : 'You started despite the inner critic — that counts.',
      skip_coach_intro: he
        ? 'נכייל את מחר — בלי לשפוט את עצמך על היום.'
        : "Let's adjust tomorrow — without judging yourself for today.",
      skip_coach_saved: he
        ? 'התאמה רכה נשמרה — מחר צעד קטן יותר.'
        : 'A gentle adjustment is saved — a smaller step tomorrow.',
      survival_done_easy: he
        ? 'גרסה קלה — לא "פחות מספיק", פשוט חזרה נכונה.'
        : 'Easy version — not "less than enough", just the right return.',
      survival_done_skip: he
        ? 'היום לא הוכיח הכול — וזה בסדר. מחר צעד קטן.'
        : "Today didn't prove everything — and that's okay. Small step tomorrow.",
      survival_done_pause: he
        ? 'הפסקה — לא כישלון. נחזור ברכות.'
        : 'A pause — not failure. We return gently.',
    };
  }

  if (input.tone === 'avoidance') {
    const trigger = barrier || concern || (he ? 'קשה להתחיל' : 'hard to start');

    return {
      tone: input.tone,
      skip_primary: he
        ? `דילגת — הגיוני כש${trigger}. לא צריך לסיים: ${planB || 'רק פתיחה של 2 דקות'}.`
        : `You skipped — makes sense when ${trigger}. No need to finish: ${planB || 'just a 2-minute opening'}.`,
      partial_primary: he
        ? `התחלת למרות ${trigger}. partial = פתיחה — לא סיום מלא.`
        : `You started despite ${trigger}. Partial = opening — not a full finish.`,
      skip_toast: he
        ? 'דילגת — מחר רק התחלה, לא סיום.'
        : 'Skipped — tomorrow just a start, not a finish.',
      partial_toast: he
        ? 'פתחת — זה בדיוק מה שצריך כשיש הימנעות.'
        : 'You opened — exactly what is needed when avoidance shows up.',
      skip_coach_intro: he
        ? `מחר: ${planB || 'פתיחה קטנה בלבד'} — בלי לדרוש סיום.`
        : `Tomorrow: ${planB || 'small opening only'} — no finish required.`,
      skip_coach_saved: he
        ? 'שמרנו Plan B קטן — רק להתחיל.'
        : 'Saved a small Plan B — just to start.',
      survival_done_easy: he
        ? 'גרסה קלה — פתיחה בלבד, בלי לסיים.'
        : 'Easy version — opening only, no finish required.',
      survival_done_skip: he
        ? 'היום לא התחיל — מחר רק פתיחה קטנה.'
        : "Today didn't start — tomorrow just a small opening.",
      survival_done_pause: he
        ? 'השהיה — מחר ננסה פתיחה, לא הכל.'
        : 'Paused — tomorrow we try an opening, not everything.',
    };
  }

  const valueAnchor = value
    ? he
      ? `זה לא שובר את ${value}`
      : `this doesn't break ${value}`
    : strength
      ? he
        ? `${strength} — וזה נשאר`
        : `${strength} — and that remains`
      : he
        ? 'יום קשה לא מבטל את הדרך'
        : "a hard day doesn't cancel the path";

  return {
    tone: input.tone,
    skip_primary: he
      ? `${valueAnchor}. נחזור ב${planB || 'צעד קטן'}, בלי אשמה.`
      : `${valueAnchor}. We return with ${planB || 'one small step'}, without guilt.`,
    partial_primary: he
      ? `${valueAnchor}. partial נספר — התחלת, וזה מספיק להיום.`
      : `${valueAnchor}. Partial counts — you started, and that is enough for today.`,
    skip_toast: he
      ? 'מידע טוב — נכייל, לא נעניש.'
      : 'Good data — we adjust, not punish.',
    partial_toast: he
      ? 'partial נספר. מכוונים את התוכנית, לא אותך.'
      : 'Partial counts. We steer the plan, not you.',
    skip_coach_intro: he
      ? 'מה עצר — ואיך נחזור בקטן מחר?'
      : 'What stopped you — and how do we return small tomorrow?',
    skip_coach_saved: he
      ? 'התאמה נשמרה — מחר בקצב שמתאים לך.'
      : 'Adjustment saved — tomorrow at a pace that fits you.',
    survival_done_easy: he
      ? 'בחרת בגרסה קלה — חזרה חכמה למסלול.'
      : 'You chose the easy version — a smart return to the path.',
    survival_done_skip: he
      ? 'סימנת שהיום קשה. מחר נחזור בקטן.'
      : 'Marked today as hard. Tomorrow we return small.',
    survival_done_pause: he
      ? 'השהית — נחזור כשיהיה מקום.'
      : 'Paused — we return when there is room.',
  };
}

export function buildComebackMessaging(
  session: FormulationSession,
  locale: AppLocale
): ComebackMessaging {
  const approved = session.formulation_approved;
  const handoff = session.coach_handoff;
  const tone = resolveTone(session, locale);

  return buildMessages({
    locale,
    tone,
    concern: approved?.presenting_concern_user_words?.trim() || null,
    barrier: handoff?.anticipated_barrier?.trim() || null,
    value: handoff?.value?.trim() || null,
    planB: handoff?.plan_b?.trim() || null,
    strength: pickStrength(session),
  });
}

export function comebackMessagingForPrompt(
  messaging: ComebackMessaging | null
): Record<string, unknown> | null {
  if (!messaging) return null;
  return {
    tone: messaging.tone,
    skip_primary: messaging.skip_primary,
    partial_primary: messaging.partial_primary,
    skip_coach_intro: messaging.skip_coach_intro,
  };
}

/** Fallback when no formulation session exists. */
function defaultComebackMessaging(locale: AppLocale): ComebackMessaging {
  return buildMessages({
    locale,
    tone: 'general',
    concern: null,
    barrier: null,
    value: null,
    planB: null,
    strength: null,
  });
}

export type ComebackMessageKey = Exclude<keyof ComebackMessaging, 'tone'>;

export function resolveComebackMessage(
  messaging: ComebackMessaging | null | undefined,
  kind: ComebackMessageKey,
  locale: AppLocale
): string {
  const msg = messaging?.[kind];
  if (typeof msg === 'string' && msg.trim()) return msg;
  return defaultComebackMessaging(locale)[kind];
}
