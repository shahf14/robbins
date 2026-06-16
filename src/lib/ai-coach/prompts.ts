import type {AppLocale} from '@/i18n/config';
import {buildLifeContextAdaptationHint, lifeContextForPrompt} from '@/lib/life-context-labels';
import {
  coachPromptBlockForEmotionalStage,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {NEXT_BEST_ACTION_PROMPT_BLOCK} from '@/lib/next-best-action';
import type {LifeContextStatus} from '@/lib/life-coach/types';

type CoachTone = 'tony_coach';

export type CoachPromptInput = {
  language: AppLocale;
  tone: CoachTone;
  emotionalState: string;
  escape: number;
  energy: number;
  userText: string;
  life_context_statuses?: LifeContextStatus[];
  personal_context?: Record<string, unknown> | null;
  emotional_stage?: EmotionalStageRouting | null;
};

const COACH_PERSONAL_CONTEXT_RULE = [
  '## Personal history (mandatory):',
  'Use personal_context from the payload — NEVER give generic coaching without it.',
  'You MUST reference at least ONE concrete personal detail:',
  'daily_focus.morning_mission, daily_focus.suggested_action, active goal title, today step title, last_mood.primary_tag, blocker_pattern, last_reflection, or priority_action.',
  'If daily_focus exists, treat it as the main story of today and connect the intervention to it.',
  'Echo effective_tone.preferred_tone and avoid effective_tone.avoid_tone.',
  'If personal_context is sparse, reference user_text directly — still no generic platitudes.',
].join('\n');

const languageInstruction: Record<AppLocale, string> = {
  en: 'Respond in native English.',
  he: 'Respond in native Hebrew with natural RTL-friendly phrasing. Keep mixed English terms readable when needed.'
};

const toneInstruction: Record<CoachTone, string> = {
  tony_coach:
    'Be direct, energetic, emotionally sharp, compassionate, and action-oriented. Do not sound translated or generic.'
};

export function buildCoachSystemPrompt({
  language,
  tone,
  life_context_statuses = [],
  emotional_stage = null,
}: Pick<CoachPromptInput, 'language' | 'tone' | 'life_context_statuses' | 'emotional_stage'>) {
  const lifeHint = buildLifeContextAdaptationHint(life_context_statuses, language);
  const emotionalHint = coachPromptBlockForEmotionalStage(emotional_stage, language);
  return [
    'You are an AI transformation coach.',
    languageInstruction[language],
    toneInstruction[tone],
    'Generate natively in the target language. Never translate from another language as an intermediate step.',
    lifeHint,
    emotionalHint,
    'Tailor the practical intervention to the user\'s life context when provided — not a generic wellness tip.',
    COACH_PERSONAL_CONTEXT_RULE,
    'Return concise coaching with one emotional insight and one practical intervention.',
    NEXT_BEST_ACTION_PROMPT_BLOCK,
    'Return only valid JSON: { "response": "...", "next_best_action": { ... } }.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCoachUserPrompt(input: CoachPromptInput) {
  const lifeContext = lifeContextForPrompt(input.life_context_statuses, input.language);
  return JSON.stringify(
    {
      language: input.language,
      tone: input.tone,
      emotional_state: input.emotionalState,
      escape: input.escape,
      energy: input.energy,
      user_text: input.userText,
      life_context_statuses: lifeContext.statuses,
      life_context_labels: lifeContext.labels,
      personal_context: input.personal_context ?? null,
      emotional_stage: input.emotional_stage ?? null,
    },
    null,
    2
  );
}
