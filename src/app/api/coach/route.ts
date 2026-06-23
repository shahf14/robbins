import {NextResponse} from 'next/server';
import {badRequest} from '@/lib/api-response';
import {isLocale, type AppLocale} from '@/i18n/config';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {buildCoachSystemPrompt, buildCoachUserPrompt} from '@/lib/ai-coach/prompts';
import enMessages from '../../../../messages/en.json';
import heMessages from '../../../../messages/he.json';
import {readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';
import {getUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {
  buildPersonalizedCoachFallback,
  coachHistoryForPrompt,
  coachLocalDateStr,
  coachResponseReferencesPersonalDetail,
  gatherCoachHistoryContext,
} from '@/lib/coach/history-context';
import {getLatestMorningRitualForUser} from '@/lib/db/repositories/morning-rituals';
import {detectRecurringBlockers} from '@/lib/blocker-patterns/detect-recurring-blockers';
import {parseJsonOr} from '@/lib/safe-json';
import {
  getUserParticipantProfile,
  listGoals,
  listRecentDailyBabySteps,
  listRecentReflections,
} from '@/lib/life-coach/repository';
import type {CoachingStyle} from '@/lib/user-preferences';
import {callOpenAiResponses} from '@/lib/llm/client';
import {
  buildCoachNextBestAction,
  coachResponseWithActionSchema,
  ensureNextBestAction,
} from '@/lib/next-best-action';
import {buildEmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import {getLatestCompletedFormulation} from '@/lib/life-coach/repository';
import {resolveDailyFocusContext} from '@/lib/daily-focus-context';

type Emotion =
  | 'driven'
  | 'flat'
  | 'anxious'
  | 'avoidant'
  | 'disappointed'
  | 'excited'
  | 'overwhelmed'
  | 'confused'
  | 'angry'
  | 'grateful';

type CoachRequest = {
  language?: string;
  tone?: 'tony_coach';
  emotionalState?: string;
  escape?: number;
  energy?: number;
  userText?: string;
};

const emotions: Emotion[] = [
  'driven',
  'flat',
  'anxious',
  'avoidant',
  'disappointed',
  'excited',
  'overwhelmed',
  'confused',
  'angry',
  'grateful',
];

const messages = {
  en: enMessages,
  he: heMessages,
};

export async function POST(request: Request) {
  const bodyResult = await readAuthenticatedJsonBody<CoachRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const validation = validateCoachRequest(bodyResult.data as CoachRequest);

  if (!validation.ok) {
    return badRequest(validation.error);
  }

  const input = validation.value;
  const userId = bodyResult.user.id;
  const limited = enforceAiRateLimit({action: 'coach', userId, limit: 30});
  if (limited) return limited;

  const today = coachLocalDateStr();

  const [profile, goals, recentSteps, reflections, formulation, dailyFocus] = await Promise.all([
    getUserParticipantProfile(userId),
    listGoals({status: 'active', userId}),
    listRecentDailyBabySteps(21, userId),
    listRecentReflections(3, userId),
    getLatestCompletedFormulation(userId).catch(() => null),
    resolveDailyFocusContext(userId, today).catch(() => null),
  ]);

  const todaySteps = recentSteps.filter((step) => step.scheduled_date === today);
  const morningRitual = getLatestMorningRitualForUser(userId, today);
  const reflection = reflections[0] ?? null;
  const behaviorProfile = getUserBehaviorProfile(
    userId,
    profile.preferred_action_window ?? 'flexible'
  );
  const recurringBlockers = detectRecurringBlockers(userId, 14);

  const historyContext = gatherCoachHistoryContext({
    userId,
    locale: input.language,
    goals,
    todaySteps,
    morningRitual,
    reflection,
    behaviorProfile,
    recurringBlockers,
    coachingStyle: (profile.coaching_style ?? 'supportive') as CoachingStyle,
    dailyFocus,
  });
  const personalContext = coachHistoryForPrompt(historyContext);
  const emotionalStage = formulation
    ? buildEmotionalStageRouting(formulation, input.language)
    : null;

  const systemPrompt = buildCoachSystemPrompt({
    language: input.language,
    tone: input.tone,
    life_context_statuses: profile.life_context_statuses,
    emotional_stage: emotionalStage,
  });
  const userPrompt = buildCoachUserPrompt({
    language: input.language,
    tone: input.tone,
    emotionalState: input.emotionalState,
    escape: input.escape,
    energy: input.energy,
    userText: input.userText,
    life_context_statuses: profile.life_context_statuses,
    personal_context: personalContext,
    emotional_stage: emotionalStage,
  });

  const actionFallback = buildCoachNextBestAction({
    locale: input.language,
    emotionalState: input.emotionalState,
    escape: input.escape,
    energy: input.energy,
    context: historyContext,
    emotional_stage: emotionalStage,
  });

  const aiResponse = await buildOpenAiCoachResponse({
    systemPrompt,
    userPrompt,
  });

  let response =
    aiResponse.response ??
    buildPersonalizedCoachFallback({
      locale: input.language,
      emotionalState: input.emotionalState,
      escape: input.escape,
      energy: input.energy,
      userText: input.userText,
      context: historyContext,
    });

  let next_best_action = ensureNextBestAction(aiResponse.next_best_action, actionFallback);

  let source: 'openai' | 'local_fallback' | 'personalized_fallback' = aiResponse.response
    ? 'openai'
    : 'local_fallback';

  if (
    historyContext.anchors.length > 0 &&
    !coachResponseReferencesPersonalDetail(response, historyContext.anchors)
  ) {
    response = buildPersonalizedCoachFallback({
      locale: input.language,
      emotionalState: input.emotionalState,
      escape: input.escape,
      energy: input.energy,
      userText: input.userText,
      context: historyContext,
    });
    next_best_action = actionFallback;
    source = 'personalized_fallback';
  }

  return NextResponse.json({
    response,
    source,
    next_best_action,
  });
}

async function buildOpenAiCoachResponse({
  systemPrompt,
  userPrompt,
}: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<{response?: string; next_best_action?: import('@/lib/next-best-action').NextBestAction}> {
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    return {};
  }

  const result = await callOpenAiResponses({
    model,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens: 420,
  });

  if (!result || !result.text) {
    return {};
  }

  try {
    const parsed = coachResponseWithActionSchema.safeParse(parseJsonOr<unknown>(result.text, null));
    if (parsed.success) {
      return {
        response: parsed.data.response,
        next_best_action: parsed.data.next_best_action,
      };
    }
  } catch {
    /* plain text fallback */
  }

  return {response: result.text};
}

function validateCoachRequest(body: CoachRequest):
  | {
      ok: true;
      value: {
        language: AppLocale;
        tone: 'tony_coach';
        emotionalState: Emotion;
        escape: number;
        energy: number;
        userText: string;
      };
    }
  | {ok: false; error: string} {
  const language = body.language && isLocale(body.language) ? body.language : undefined;
  const emotionalState = emotions.includes(body.emotionalState as Emotion)
    ? (body.emotionalState as Emotion)
    : undefined;
  const escape = normalizeScore(body.escape);
  const energy = normalizeScore(body.energy);
  const userText = typeof body.userText === 'string' ? body.userText.trim() : '';

  if (!language) {
    return {ok: false, error: 'Unsupported language.'};
  }

  if (body.tone !== 'tony_coach') {
    return {ok: false, error: 'Unsupported coach tone.'};
  }

  if (!emotionalState) {
    return {ok: false, error: 'Unsupported emotional state.'};
  }

  if (!escape || !energy) {
    return {ok: false, error: 'Scores must be between 1 and 10.'};
  }

  if (!userText) {
    return {ok: false, error: 'User text is required.'};
  }

  if (userText.length > 2000) {
    return {ok: false, error: 'User text must be 2000 characters or fewer.'};
  }

  return {
    ok: true,
    value: {
      language,
      tone: body.tone,
      emotionalState,
      escape,
      energy,
      userText,
    },
  };
}

function normalizeScore(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : undefined;
}

