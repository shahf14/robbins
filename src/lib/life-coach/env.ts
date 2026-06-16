function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getLifeCoachCronSecret() {
  return requireEnv('LIFE_COACH_CRON_SECRET');
}

export function getLifeCoachModelConfig() {
  return {
    structuring: process.env.OPENAI_LIFE_COACH_STRUCTURING_MODEL || 'gpt-4.1-mini',
    /** Exploration questions — structured JSON, moderate complexity. */
    exploration: process.env.OPENAI_FORMULATION_EXPLORATION_MODEL || 'gpt-4.1-mini',
    /** Draft formulation — complex synthesis, many rules. */
    formulation: process.env.OPENAI_FORMULATION_DRAFT_MODEL || 'gpt-4.1-mini',
    /** Micro-goal generation — most critical, needs deep understanding. */
    microGoal: process.env.OPENAI_FORMULATION_GOAL_MODEL || 'gpt-4.1',
    dailySteps: process.env.OPENAI_LIFE_COACH_DAILY_STEPS_MODEL || 'gpt-4.1-mini',
    review: process.env.OPENAI_LIFE_COACH_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1',
  };
}

/** Feature flags for formulation LLM pipeline. */
export function getFormulationFlags() {
  return {
    /** When true, exploration questions use deterministic fallback instead of LLM. */
    deterministicExploration: process.env.FORMULATION_DETERMINISTIC_EXPLORATION === 'true',
    /** Provider: 'openai' | 'anthropic'. Default: 'openai'. */
    llmProvider: (process.env.FORMULATION_LLM_PROVIDER || 'openai') as 'openai' | 'anthropic',
  };
}
