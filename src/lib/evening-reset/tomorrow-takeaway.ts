import type {AppLocale} from '@/i18n/config';
import {openAiRequestSignal} from '@/lib/life-coach/server';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import type {EveningBriefingFields} from './briefing';

const ACTION_HE =
  /(?:תתחיל|תעשה|סגור|בחר|הגדר|חסום|הקדש|רק|דקות|\bדק\b|לפני|בבוקר|הצעד|פעולה|מחר)/i;
const ACTION_EN =
  /(?:start|do|block|choose|set|dedicate|only|minutes?|before|morning|step|action|tomorrow)/i;
const GENERIC_HE = /^(?:אתה יכול|הכל יהיה|תאמין|העולם|השראה)/i;
const GENERIC_EN = /^(?:you can|believe in|the universe|inspiration|anything is possible)/i;

function isActionableTakeaway(text: string, locale: AppLocale): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12 || trimmed.length > 220) return false;

  const actionPattern = locale === 'he' ? ACTION_HE : ACTION_EN;
  const genericPattern = locale === 'he' ? GENERIC_HE : GENERIC_EN;

  if (genericPattern.test(trimmed)) return false;
  return actionPattern.test(trimmed);
}

function clipWin(win: string, max = 72): string {
  const trimmed = win.trim();
  if (!trimmed) return '';
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export function buildTomorrowTakeawayFallback(input: {
  locale: AppLocale;
  session: Pick<
    EveningResetSession,
    | 'tomorrowsWin'
    | 'blockers'
    | 'biggestWin'
    | 'successFactors'
    | 'dayMood'
    | 'tasks_too_big'
    | 'energy_forecast'
  >;
  briefing: EveningBriefingFields;
}): string {
  const he = input.locale === 'he';
  const win = clipWin(input.session.tomorrowsWin);
  const blocker = input.session.blockers.trim().slice(0, 60);

  if (input.briefing.tasks_too_big || input.session.tasks_too_big) {
    return he
      ? win
        ? `מחר: התחל בצעד של 5 דקות ל"${win}" לפני כל דבר אחר — לא את המשימה הגדולה.`
        : 'מחר: בחר צעד אחד של 5 דקות בלבד לפני 9:00 — לא את המשימה הגדולה.'
      : win
        ? `Tomorrow: start with a 5-minute step on "${win}" before anything else — not the big task.`
        : 'Tomorrow: pick one 5-minute step before 9:00 — not the big task.';
  }

  if (
    input.briefing.energy_forecast === 'low' ||
    input.session.energy_forecast === 'low' ||
    (input.session.dayMood != null && input.session.dayMood <= 2)
  ) {
    return he
      ? win
        ? `מחר בבוקר: 10 דקות בלבד על "${win}" — רק התחלה, בלי לסיים.`
        : 'מחר בבוקר: 10 דקות על הצעד הכי קטן שאפשר — רק התחלה.'
      : win
        ? `Tomorrow morning: only 10 minutes on "${win}" — start only, no finish pressure.`
        : 'Tomorrow morning: 10 minutes on the smallest possible step — start only.';
  }

  if (blocker) {
    return he
      ? win
        ? `מחר: חסום 30 דקות ראשונות ל"${win}" — לפני מיילים והסחות דעת.`
        : `מחר: חסום 30 דקות ראשונות לפני מיילים — התחל בדבר שדחית היום.`
      : win
        ? `Tomorrow: block the first 30 minutes for "${win}" — before email and distractions.`
        : 'Tomorrow: block the first 30 minutes before email — start what you avoided today.';
  }

  if (win) {
    return he
      ? `מחר בבוקר: הצעד הראשון הוא "${win}" — עשה אותו לפני 10:00.`
      : `Tomorrow morning: your first move is "${win}" — do it before 10:00.`;
  }

  const worked = (input.session.successFactors || input.session.biggestWin).trim().slice(0, 60);
  if (worked) {
    return he
      ? `מחר: חזור על מה שעבד היום — "${worked}" — ב-15 דקות ראשונות.`
      : `Tomorrow: repeat what worked today — "${worked}" — in the first 15 minutes.`;
  }

  return he
    ? 'מחר: בחר פעולה אחת של 10 דקות ועשה אותה לפני כל דבר אחר.'
    : 'Tomorrow: pick one 10-minute action and do it before anything else.';
}

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{text?: string}>;
  }>;
};

function extractOpenAiText(response: OpenAiResponse): string | null {
  if (response.output_text?.trim()) return response.output_text.trim();
  const joined = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join('\n')
    .trim();
  return joined || null;
}

export async function resolveTomorrowTakeaway(input: {
  locale: AppLocale;
  session: EveningResetSession;
  briefing: EveningBriefingFields;
}): Promise<{text: string; source: 'rules' | 'openai'}> {
  const fallback = buildTomorrowTakeawayFallback({
    locale: input.locale,
    session: input.session,
    briefing: input.briefing,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return {text: fallback, source: 'rules'};
  }

  const he = input.locale === 'he';
  const instructions = [
    he
      ? 'כתוב משפט אחד בעברית — תובנה פעולה למחר, לא השראה כללית.'
      : 'Write one sentence in English — an actionable takeaway for tomorrow, not generic inspiration.',
    'Must include a concrete action: time block, duration, or first step.',
    'Max 180 characters. No quotes around the whole sentence.',
    he
      ? 'אסור: "אתה יכול", "תאמין", "הכל יהיה בסדר".'
      : 'Forbidden: "you can", "believe", "anything is possible".',
  ].join('\n');

  const payload = {
    tomorrows_win: input.session.tomorrowsWin,
    blockers: input.session.blockers,
    biggest_win: input.session.biggestWin,
    what_worked: input.briefing.what_worked,
    what_failed: input.briefing.what_failed,
    energy_forecast: input.briefing.energy_forecast,
    tasks_too_big: input.briefing.tasks_too_big,
    day_mood: input.session.dayMood ?? null,
    tomorrow_constraint: input.briefing.tomorrow_constraint,
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: openAiRequestSignal(),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input: JSON.stringify(payload, null, 2),
        max_output_tokens: 120,
      }),
    });

    if (!response.ok) {
      return {text: fallback, source: 'rules'};
    }

    const body = (await response.json()) as OpenAiResponse;
    const text = extractOpenAiText(body);
    if (text && isActionableTakeaway(text, input.locale)) {
      return {text, source: 'openai'};
    }
  } catch {
    /* use fallback */
  }

  return {text: fallback, source: 'rules'};
}
