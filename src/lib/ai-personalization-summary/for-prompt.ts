import type {AiPersonalizationSummary} from './types';

export function aiPersonalizationSummaryForPrompt(
  summary: AiPersonalizationSummary | null | undefined
): Record<string, unknown> | null {
  if (!summary) return null;
  return {
    motivators: summary.motivators,
    likely_blockers: summary.likely_blockers,
    preferred_action_size: summary.preferred_action_size,
    emotional_risk: summary.emotional_risk,
    tone: summary.tone,
    identity_goal: summary.identity_goal,
    primary_domain: summary.primary_domain,
    source: summary.source,
    generated_at: summary.generated_at,
  };
}

export const AI_PERSONALIZATION_PROMPT_BLOCK = [
  '## Onboarding personalization summary (mandatory when present):',
  'Use ai_personalization_summary as stable user context from onboarding — not generic coaching.',
  'Fields: motivators, likely_blockers, preferred_action_size, emotional_risk, tone, identity_goal.',
  'Honor preferred_action_size: micro → 3-8 min easy steps; small → 5-12 min; standard → up to 20 min.',
  'If emotional_risk includes fear_of_failure or shame, or tone.shame_sensitivity is high:',
  '- NEVER use guilt, shame, failure framing, or "you must/should".',
  '- Prefer experiments, permission to stop early, and validating language.',
  '- Merge tone.preferred_tone and tone.avoid_tone with coaching_style tone hints.',
  'Frame steps and goals toward identity_goal — who the user is becoming, not only what they do.',
].join('\n');

export function mergeToneWithPersonalization(
  base: {preferred_tone?: string; avoid_tone?: string},
  summary: AiPersonalizationSummary | null | undefined
): {preferred_tone?: string; avoid_tone?: string} {
  if (!summary) return base;

  const preferred = [base.preferred_tone, summary.tone.preferred_tone]
    .filter(Boolean)
    .join('; ');
  const avoid = [base.avoid_tone, summary.tone.avoid_tone].filter(Boolean).join('; ');

  return {
    preferred_tone: preferred || undefined,
    avoid_tone: avoid || undefined,
  };
}

export function parseAiPersonalizationSummary(raw: unknown): AiPersonalizationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.motivators) || !Array.isArray(o.likely_blockers)) return null;
  if (typeof o.identity_goal !== 'string') return null;
  if (!o.tone || typeof o.tone !== 'object') return null;
  const tone = o.tone as Record<string, unknown>;
  if (typeof tone.preferred_tone !== 'string' || typeof tone.avoid_tone !== 'string') {
    return null;
  }
  return raw as AiPersonalizationSummary;
}
