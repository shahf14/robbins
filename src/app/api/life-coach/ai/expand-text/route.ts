import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {jsonError, jsonOk, parseLifeCoachJsonBody, resolveLocale} from '@/lib/life-coach/server';
import {getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {callOpenAiResponses} from '@/lib/llm/client';
import type {AppLocale} from '@/i18n/config';

const languageInstruction: Record<AppLocale, string> = {
  en: 'Respond in English.',
  he: 'Respond in native, natural Hebrew.',
};

async function expandText(text: string, context: string, locale: AppLocale): Promise<string> {
  const modelConfig = getLifeCoachModelConfig();

  const systemPrompt = [
    'You are a compassionate life coach helping someone articulate their inner motivation.',
    languageInstruction[locale],
    'Your job: take what the user wrote and expand it into 2-4 clear, emotionally honest sentences.',
    'Preserve the user\'s original meaning completely — do not add ideas they did not express.',
    'Make it more specific, vivid, and self-aware. Help them say what they meant but could not quite put into words.',
    'Write in first person ("I..." / "אני...").',
    'Do not add motivational clichés or coaching jargon.',
    'Return only the expanded text — no labels, no explanation.',
  ].join(' ');

  const userPrompt = `Context: ${context}\n\nWhat I wrote: ${text}`;

  const result = await callOpenAiResponses({
    model: modelConfig.structuring,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens: 300,
  });

  return result?.text || fallbackExpand(text, locale);
}

function fallbackExpand(text: string, locale: AppLocale): string {
  if (locale === 'he') {
    return `${text} זה חשוב לי כי זה משפיע על האיכות של החיים שלי ועל הדרך שבה אני מרגיש לגבי עצמי מדי יום.`;
  }
  return `${text} This matters to me because it directly affects the quality of my daily life and how I feel about myself.`;
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const bodyResult = await parseLifeCoachJsonBody<Record<string, unknown>>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = (bodyResult.data ?? {}) as Record<string, unknown>;

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const context = typeof body.context === 'string' ? body.context : '';
  const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : null);

  if (!text) {
    return jsonError('text is required.', 400);
  }

  if (text.length > 2000 || context.length > 2000) {
    return jsonError('text and context must be 2000 characters or fewer.', 400);
  }

  const limited = enforceAiRateLimit({
    action: 'life-coach:expand-text',
    userId: current.user.id,
    limit: 30,
  });
  if (limited) return limited;

  try {
    const expanded = await expandText(text, context, locale);
    return jsonOk({expanded});
  } catch (error) {
    return jsonError('Could not expand text.', 500, String(error));
  }
}
