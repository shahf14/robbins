import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {jsonError, jsonMutation, parseLifeCoachJsonBody, resolveLocale} from '@/lib/life-coach/server';
import {expandTextRequestSchema} from '@/lib/life-coach/schemas';
import {getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {requestLlmText} from '@/lib/llm/request-structured-json';
import {TEXT_RESPONSE_LANGUAGE_INSTRUCTION} from '@/lib/llm/language-instruction';
import type {AppLocale} from '@/i18n/config';

async function expandText(text: string, context: string, locale: AppLocale): Promise<string> {
  const modelConfig = getLifeCoachModelConfig();

  const systemPrompt = [
    'You are a compassionate life coach helping someone articulate their inner motivation.',
    TEXT_RESPONSE_LANGUAGE_INSTRUCTION[locale],
    'Your job: take what the user wrote and expand it into 2-4 clear, emotionally honest sentences.',
    'Preserve the user\'s original meaning completely — do not add ideas they did not express.',
    'Make it more specific, vivid, and self-aware. Help them say what they meant but could not quite put into words.',
    'Write in first person ("I..." / "אני...").',
    'Do not add motivational clichés or coaching jargon.',
    'Return only the expanded text — no labels, no explanation.',
  ].join(' ');

  const userPrompt = `Context: ${context}\n\nWhat I wrote: ${text}`;

  const {text: expanded} = await requestLlmText({
    model: modelConfig.structuring,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 300,
    fallback: fallbackExpand(text, locale),
  });

  return expanded;
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

  const parsed = await parseLifeCoachJsonBody(request, expandTextRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {text, context} = parsed.data;
  const locale = resolveLocale(parsed.data.locale ?? null);

  const limited = enforceAiRateLimit({
    action: 'life-coach:expand-text',
    userId: current.user.id,
    limit: 30,
  });
  if (limited) return limited;

  try {
    const expanded = await expandText(text, context, locale);
    return jsonMutation({expanded});
  } catch (error) {
    return jsonError('Could not expand text.', 500, String(error));
  }
}
