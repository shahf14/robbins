import type {AppLocale} from '@/i18n/config';

/** Free-text LLM replies (expand-text, goal inspiration, etc.) */
export const TEXT_RESPONSE_LANGUAGE_INSTRUCTION: Record<AppLocale, string> = {
  en: 'Respond in English.',
  he: 'Respond in native, natural Hebrew.',
};

/** Structured JSON outputs from life-coach AI (daily steps, weekly review, goal bundles, etc.) */
export const JSON_OUTPUT_LANGUAGE_INSTRUCTION: Record<AppLocale, string> = {
  en: 'CRITICAL: Write EVERY string value in the JSON output (titles, descriptions, metrics, summaries, recommendations) in English only. Do not mix in any other language.',
  he: 'קריטי: כל ערך טקסטואלי בפלט ה-JSON (כותרות, תיאורים, מדדים, סיכומים, המלצות) חייב להיכתב בעברית בלבד, בניסוח טבעי ומודרני. אסור לערבב אנגלית או כל שפה אחרת — גם לא מילה בודדת. אם מצוטט טקסט של המשתמש, תרגם אותו לעברית.',
};
