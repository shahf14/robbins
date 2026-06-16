import type {AppLocale} from '@/i18n/config';
import type {CoachingStyle} from '@/lib/user-preferences';
import type {DailyCoachMessage, DailyCoachMessageInputs} from './types';
import {applyCoachToneToMessage} from './tone-variants';

type TemplatePair = {sentence: string; action: string};

function minutesLabel(minutes: number | null, locale: AppLocale): string {
  if (minutes == null) return '';
  return locale === 'he' ? `${minutes} דק׳` : `${minutes} min`;
}

function pickTemplate(inputs: DailyCoachMessageInputs, locale: AppLocale): TemplatePair {
  const minutes = minutesLabel(inputs.primary_step_minutes, locale);
  const count = inputs.today_step_count;

  if (inputs.pending_today === 0 && inputs.today_step_count > 0) {
    return locale === 'he'
      ? {
          sentence: 'סיימת את הצעדים להיום — מצוין.',
          action: 'מחר נמשיך מאותה נקודה.',
        }
      : {
          sentence: 'You finished today\'s steps — well done.',
          action: 'Tomorrow we pick up from here.',
        };
  }

  if (inputs.yesterday_status === 'missed') {
    return locale === 'he'
      ? {
          sentence: 'אתמול לא הסתדר, וזה בסדר — היום חוזרים עם צעד אחד קטן.',
          action: minutes
            ? `בוא נתחיל ב${minutes} — רק לסמן התקדמות.`
            : 'בוא נפתח רק את הצעד הראשון.',
        }
      : {
          sentence: 'Yesterday did not land — today we come back with one small step.',
          action: minutes
            ? `Start with ${minutes} — just mark progress.`
            : 'Open only the first step.',
        };
  }

  if (
    inputs.yesterday_energy != null &&
    inputs.yesterday_energy <= 4
  ) {
    return locale === 'he'
      ? {
          sentence: 'אתמול היה יום אנרגיה נמוכה, אז היום ננצח עם צעד אחד קצר.',
          action: minutes
            ? `התחלה: ${minutes} — בלי ללחוץ על הכל.`
            : 'צעד אחד קצר — זה מספיק להיום.',
        }
      : {
          sentence: 'Yesterday was a low-energy day — today we win with one short step.',
          action: minutes
            ? `Start with ${minutes} — no need to do everything.`
            : 'One short step is enough for today.',
        };
  }

  if (inputs.latest_energy != null && inputs.latest_energy <= 4) {
    return locale === 'he'
      ? {
          sentence: 'האנרגיה נמוכה היום — נתאים צעד קצר שמתחיל בקל.',
          action: minutes
            ? `התחלה: ${minutes} — בלי ללחוץ על הכל.`
            : 'צעד אחד קצר — זה מספיק להיום.',
        }
      : {
          sentence: 'Energy is low today — we match a short step that starts easy.',
          action: minutes
            ? `Start with ${minutes} — no need to do everything.`
            : 'One short step is enough for today.',
        };
  }

  if (inputs.energy_trend === 'down' && (inputs.latest_energy ?? 6) <= 5) {
    return locale === 'he'
      ? {
          sentence: 'האנרגיה יורדת השבוע — נתאים את היום לקצב נמוך יותר.',
          action: minutes
            ? `נתמקד בצעד ראשון של ${minutes}.`
            : 'נתמקד בצעד הראשון בלבד.',
        }
      : {
          sentence: 'Energy is trending down — today matches a slower pace.',
          action: minutes
            ? `Focus on the first ${minutes} step.`
            : 'Focus on the first step only.',
        };
  }

  if (inputs.blocker_risk === 'high') {
    return locale === 'he'
      ? {
          sentence: 'הדפוסים האחרונים מראים שקשה להשלים משימות כבדות — היום נלך על גרסה קלה.',
          action: minutes
            ? `גרסה קצרה: ${minutes}, או Plan B אם צריך.`
            : 'גרסה קלה או Plan B — מה שמתחיל בקל.',
        }
      : {
          sentence: 'Recent patterns show heavy tasks stall — today we go lighter.',
          action: minutes
            ? `Short version: ${minutes}, or Plan B if needed.`
            : 'Light version or Plan B — whatever starts easiest.',
        };
  }

  if (count >= 3 && inputs.pending_today >= 2) {
    return locale === 'he'
      ? {
          sentence: `יש לך ${count} צעדים היום — ננצח עם הראשון בלבד.`,
          action: minutes
            ? `התחלה: ${minutes} על הצעד המומלץ.`
            : 'רק הצעד הראשון — השאר אחר כך.',
        }
      : {
          sentence: `You have ${count} steps today — win with the first one only.`,
          action: minutes
            ? `Start: ${minutes} on the recommended step.`
            : 'Just the first step — the rest can wait.',
        };
  }

  if (inputs.yesterday_status === 'strong' && inputs.energy_trend === 'up') {
    return locale === 'he'
      ? {
          sentence: 'יש לך מומנטום טוב — נשמור עליו עם צעד אחד ממוקד.',
          action: minutes
            ? `הצעד הראשון: ${minutes} של התקדמות.`
            : 'צעד אחד ממוקד — ואז נמשיך.',
        }
      : {
          sentence: 'Momentum is building — keep it with one focused step.',
          action: minutes
            ? `First step: ${minutes} of progress.`
            : 'One focused step — then we continue.',
        };
  }

  return locale === 'he'
    ? {
        sentence: 'היום נתחיל בצעד אחד שמתאים למצב שלך עכשיו.',
        action: minutes
          ? `התחלה: ${minutes} — רק לפתוח את הצעד.`
          : 'בוא נפתח את הצעד הראשון.',
      }
    : {
        sentence: 'Today starts with one step that fits where you are now.',
        action: minutes
          ? `Start with ${minutes} — just open the step.`
          : 'Open the first step.',
      };
}

export function composeDailyCoachMessage(
  inputs: DailyCoachMessageInputs,
  locale: AppLocale,
  coachTone: CoachingStyle = 'supportive'
): DailyCoachMessage {
  const template = applyCoachToneToMessage(pickTemplate(inputs, locale), coachTone, locale);
  return {
    sentence: template.sentence,
    action_framing: template.action,
    text: `${template.sentence} ${template.action}`,
    primary_step_id: inputs.primary_step_id,
    coach_tone: coachTone,
    inputs,
  };
}
