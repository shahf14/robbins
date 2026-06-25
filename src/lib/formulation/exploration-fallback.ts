import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {humanThemePhraseFromInsights} from '@/lib/formulation/theme-phrases';
import {resolveGenderedHebrewText, resolveParticipantGender} from '@/lib/gendered-copy';
import type {FormulationSession, LlmExplorationQuestion} from '@/lib/life-coach/types';

/** First-person Likert statements — not interrogative questions. */
const TEMPLATES_HE = [
  'חוסר הבהירות סביב {theme} מקשה עליי לבחור את הצעד הבא',
  'שאלות על העתיד תופסות לי מקום ומקשות עליי להתמקד ביום הנוכחי',
  'יש רגעים שאני מרגיש/ה שהגוף נשאר במתח גם כשאין משהו דחוף עכשיו',
  'אני מתקשה/ה לבקש עזרה גם כשאני יודע/ת שזה היה מקל',
  'אני מרגיש/ה אשמה כשאני לוקח/ת רגע לעצמי',
  'קשה לי לסמוך שהדברים הקטנים שאני עושה באמת משנים משהו',
  'אני משווה את עצמי לאחרים יותר ממה שמרגיש לי בריא לאחרונה',
  'אני מוותר/ת על דברים שחשובים לי בגלל עומס או עייפות',
  'יש משהו שאני נמנע/ת מלהתמודד איתו כי זה מרגיש מסוכן או מעמיס',
  'אני מרגיש/ה בודד/ה בזה גם כשיש אנשים סביבי',
  'כשמשהו לא מצליח, הביקורת הפנימית שלי מתגברת',
  'קשה לי לשמור על גבול בין מה שדחוף למה שחשוב',
  'אני חושש/ת שאם אשחרר שליטה, משהו חשוב יתפספס',
  'אני מזהה/ה גם רגעים שבהם יש לי כוח — גם אם הם קצרים',
  'חשוב לי שלא אאבד את מה שמחזיק אותי כשאני מנסה להשתפר',
];

const TEMPLATES_EN = [
  'Unclear parts around {theme} make it harder for me to choose the next step',
  'Future questions take up space and make it harder to focus on the current day',
  'Sometimes my body stays tense even when nothing urgent is happening right now',
  'I struggle to ask for help even when I know it would ease the load',
  'I feel guilty when I take a moment for myself',
  'It is hard to trust that small steps I take really change anything',
  'I compare myself to others more than feels healthy lately',
  'I give up things that matter to me because of overload or fatigue',
  'There is something I avoid facing because it feels risky or overwhelming',
  'I feel alone in this even when people are around me',
  'When something does not work out, my inner criticism gets louder',
  'It is hard to keep a boundary between urgent and important',
  'I worry that if I loosen control, something important will get missed',
  'I also notice moments when I have some strength — even if brief',
  'It matters to me not to lose what holds me together while I try to improve',
];

function themeFromSession(session: FormulationSession, locale: AppLocale): string {
  const insights = buildFormulationInsights(session, locale);
  return humanThemePhraseFromInsights(
    insights.burning_now_themes,
    session.life_context_statuses,
    locale
  );
}

export function buildFallbackExplorationQuestions(
  session: FormulationSession,
  locale: AppLocale
): LlmExplorationQuestion[] {
  const theme = themeFromSession(session, locale);
  const templates = locale === 'he' ? TEMPLATES_HE : TEMPLATES_EN;

  return templates.map((tpl, i) => {
    const n = String(i + 1).padStart(2, '0');
    const text =
      locale === 'he'
        ? resolveGenderedHebrewText(
            tpl.replace(/\{theme\}/g, theme.slice(0, 80)),
            resolveParticipantGender(session.participant_gender)
          )
        : tpl.replace(/\{theme\}/g, theme.slice(0, 80));
    return {
      id: `q${n}`,
      text,
      focus_area: i < 5 ? 'angle' : i < 10 ? 'impact' : 'resources',
    };
  });
}
