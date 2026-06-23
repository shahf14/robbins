import {NextResponse} from 'next/server';
import {badRequest, serverError} from '@/lib/api-response';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {readAuthenticatedJsonBody} from '@/lib/read-authenticated-json-body';
import {getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {callOpenAiResponses} from '@/lib/llm/client';
import type {AppLocale} from '@/i18n/config';
import {formatLifeContextLabels, normalizeLifeContextStatuses} from '@/lib/life-context-labels';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {
  onboardingAiRequestSchema,
  type OnboardingUserContext,
} from '@/lib/onboarding-ai-schemas';
import type {AvailableTimePerDay, IntensityPreference, LifeDomain} from '@/lib/life-coach/types';

type GoalTone = 'default' | 'smaller' | 'bolder';

type AnswersPayload = {
  whyThisDomain: string;
  whatBothersToday: string;
  whatIfNothingChanges: string;
  whatIfSucceeds: string;
};

type UserContext = {
  availableTime?: AvailableTimePerDay;
  intensityPreference?: IntensityPreference;
  coachingStyle?: string;
  familyStatus?: string;
  age?: number;
  gender?: 'male' | 'female';
  lifeContextStatuses?: string[];
  wakeTime?: string;
  sleepTime?: string;
  preferredActionWindow?: string;
  physicalConsiderations?: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callOpenAi(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const result = await callOpenAiResponses({
    model: getLifeCoachModelConfig().structuring,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens: maxTokens,
  });
  return result?.text || null;
}

const LANG: Record<AppLocale, string> = {
  en: 'Respond in English.',
  he: 'Respond in Hebrew. Use natural, conversational Hebrew — not translated English.',
};

const COACHING_STYLE_HINT: Record<string, {en: string; he: string}> = {
  supportive: {en: 'warm and supportive', he: 'חם ותומך'},
  direct: {en: 'direct and concise', he: 'ישיר ותמציתי'},
  motivational: {en: 'energetic and motivating', he: 'אנרגטי ומניע לפעולה'},
};

const ACTION_WINDOW_HINT: Record<string, {en: string; he: string}> = {
  morning: {en: 'morning after wake-up', he: 'בוקר אחרי הקימה'},
  midday: {en: 'midday', he: 'צהריים'},
  evening: {en: 'evening', he: 'ערב'},
  flexible: {en: 'flexible any time', he: 'גמיש — בכל זמן'},
};

function genderHint(ctx: UserContext, locale: AppLocale): string {
  if (locale !== 'he') return '';
  if (ctx.gender === 'male') {
    return 'חובה: פנה למשתמש בלשון זכר בלבד (אתה, מחפש, מתוסכל, תרגיש). אסור לשימוש בלשון נקבה.';
  }
  if (ctx.gender === 'female') {
    return 'חובה: פני למשתמשת בלשון נקבה בלבד (את, מחפשת, מתוסכלת, תרגישי). אסור לשימוש בלשון זכר.';
  }
  return '';
}

function contextHint(ctx: UserContext, locale: AppLocale): string {
  const parts: string[] = [];

  const genderLine = genderHint(ctx, locale);
  if (genderLine) parts.push(genderLine);

  if (ctx.coachingStyle && COACHING_STYLE_HINT[ctx.coachingStyle]) {
    const hint = COACHING_STYLE_HINT[ctx.coachingStyle][locale];
    parts.push(locale === 'he' ? `סגנון אימון: ${hint}` : `Coaching style: ${hint}`);
  }
  if (ctx.availableTime) {
    parts.push(
      locale === 'he'
        ? `זמן פנוי יומי: ${ctx.availableTime} דקות`
        : `Daily available time: ${ctx.availableTime} minutes`
    );
  }
  if (ctx.intensityPreference) {
    const intensity =
      locale === 'he'
        ? {gentle: 'רגוע', balanced: 'מאוזן', intense: 'אינטנסיבי'}[ctx.intensityPreference]
        : ctx.intensityPreference;
    parts.push(locale === 'he' ? `עוצמת התקדמות: ${intensity}` : `Intensity preference: ${intensity}`);
  }
  const lifeLabels = formatLifeContextLabels(
    normalizeLifeContextStatuses(ctx.lifeContextStatuses),
    locale
  );
  if (lifeLabels.length) {
    parts.push(
      locale === 'he'
        ? `הקשר חיים: ${lifeLabels.join(', ')}`
        : `Life context: ${lifeLabels.join(', ')}`
    );
  }
  if (ctx.familyStatus) {
    parts.push(locale === 'he' ? `מצב משפחתי: ${ctx.familyStatus}` : `Family status: ${ctx.familyStatus}`);
  }
  if (ctx.age) {
    parts.push(locale === 'he' ? `גיל: ${ctx.age}` : `Age: ${ctx.age}`);
  }
  if (ctx.wakeTime) {
    parts.push(locale === 'he' ? `שעת קימה: ${ctx.wakeTime}` : `Wake time: ${ctx.wakeTime}`);
  }
  if (ctx.sleepTime) {
    parts.push(locale === 'he' ? `שעת שינה: ${ctx.sleepTime}` : `Sleep time: ${ctx.sleepTime}`);
  }
  if (ctx.preferredActionWindow && ACTION_WINDOW_HINT[ctx.preferredActionWindow]) {
    const w = ACTION_WINDOW_HINT[ctx.preferredActionWindow][locale];
    parts.push(
      locale === 'he' ? `חלון זמן מועדף לפעולה: ${w}` : `Preferred action window: ${w}`
    );
  }
  if (ctx.physicalConsiderations?.length) {
    parts.push(
      locale === 'he'
        ? `התחשבות פיזית: ${ctx.physicalConsiderations.join(', ')}`
        : `Physical considerations: ${ctx.physicalConsiderations.join(', ')}`
    );
  }
  return parts.length ? parts.join('. ') + '.' : '';
}

// ── Mode: insight ──────────────────────────────────────────────────────────────

const INSIGHT_BANNED_PHRASES_HE = [
  'ליבך לוחש',
  'שלווה פנימית',
  'מסע אישי',
  'אם תצליח',
  'תוכל לחוות',
  'הפוטנציאל שלך',
  'חיבור עמוק',
  'עוגיית מזל',
  'היקום',
  'אנרגיה חיובית',
].join(', ');

async function generateInsight(
  locale: AppLocale,
  domain: LifeDomain,
  answers: AnswersPayload,
  ctx: UserContext,
  articulationHelp = false
): Promise<string> {
  const ctxLine = contextHint(ctx, locale);
  const genderLine = genderHint(ctx, locale);
  const system = [
    'You write a short coaching reflection in the voice of a world-class performance coach (Tony Robbins energy):',
    'present, direct, warm, zero fluff — like you are sitting across from them and naming what is really going on.',
    LANG[locale],
    genderLine,
    ctxLine,
    articulationHelp
      ? 'The user asked for help articulating — use their words, make them feel precisely heard.'
      : '',
    'GROUND RULES:',
    '- Use THEIR specifics (job search, rejections, anxiety, overload — only what they actually shared).',
    '- This is NOT goal-setting: no tasks, habits, metrics, or 90-day plans.',
    '- Focus on what they want to FEEL and what is weighing on them right now.',
    'VOICE:',
    '- Short, spoken sentences. Mix punchy lines with one longer truth.',
    '- Validate the struggle as real — no toxic positivity, no pity.',
    '- One sharp reframe: what looks like X is often really Y (name it concretely).',
    '- End on a grounded truth about them NOW — not "if you succeed you will..."',
    '- Sound human. Like a coach talking, not a therapist essay or AI essay.',
    locale === 'he'
      ? `BANNED in Hebrew (never use): ${INSIGHT_BANNED_PHRASES_HE}.`
      : 'BANNED: fortune-cookie lines, "your heart whispers", vague "inner peace", conditional futures ("if you succeed you could..."), generic self-help clichés.',
    'STRUCTURE (one paragraph, 3-4 sentences, no bullets):',
    '  1. Name their situation in plain language — mirror something they said.',
    '  2. Name the real pattern underneath (the gap, the weight, the loop).',
    '  3. Connect to how they want to feel — from their vision, in their words.',
    '  4. Close with one direct line of recognition (strength, truth, or "this makes sense because...").',
    locale === 'he'
      ? 'Hebrew must sound native and spoken — not translated from English self-help.'
      : 'Write in second person, conversational American English.',
    'Maximum 85 words. No lists, no headers.',
  ].filter(Boolean).join(' ');

  const user = JSON.stringify({
    domain,
    why_they_chose_this: answers.whyThisDomain,
    what_bothers_them_today: answers.whatBothersToday,
    cost_if_nothing_changes: answers.whatIfNothingChanges || '(not provided)',
    how_they_want_to_feel: answers.whatIfSucceeds,
    tone_check:
      'Would this sound natural if Tony Robbins said it out loud to this person? If not, rewrite.',
  });

  const text = await callOpenAi(system, user, 220);

  if (!text) {
    return locale === 'he'
      ? ctx.gender === 'female'
        ? `שמעי — מה שאת מתארת לא חולשה. הראש שלך עמוס, וזה עוצר אותך לפני שאת בכלל מתחילה. את לא מחפשת עוד לחץ — את מחפשת רוגע בראש וביטחון שאת עדיין שווה משהו, גם כשזה קשה עכשיו.`
        : `שמע — מה שאתה מתאר לא חולשה. הראש שלך עמוס, וזה עוצר אותך לפני שאתה בכלל מתחיל. אתה לא מחפש עוד לחץ — אתה מחפש רוגע בראש וביטחון שאתה עדיין שווה משהו, גם כשזה קשה עכשיו.`
      : `Listen — what you're describing isn't weakness. Your head is overloaded, and that's stopping you before you even start. You're not asking for more pressure — you want a clearer head and proof you're still worth something, even when it's hard right now.`;
  }

  return text;
}

// ── Mode: goal_proposal ────────────────────────────────────────────────────────

async function generateGoalProposal(
  locale: AppLocale,
  domain: LifeDomain,
  answers: AnswersPayload,
  domainScore: number,
  ctx: UserContext,
  tone: GoalTone = 'default',
  previousTitle?: string
): Promise<{title: string; description: string; success_metric: string}> {
  const ctxLine = contextHint(ctx, locale);
  const toneInstruction =
    tone === 'smaller'
      ? 'Make the goal SMALLER and more achievable — one clear habit or micro-outcome in 90 days.'
      : tone === 'bolder'
        ? 'Make the goal MORE AMBITIOUS while still realistic for 90 days.'
        : 'Write a balanced, achievable 90-day goal.';

  const system = [
    'You are a precise life coach writing a specific 90-day goal for a client.',
    LANG[locale],
    ctxLine,
    toneInstruction,
    previousTitle ? `Previous proposal to improve on: "${previousTitle}"` : '',
    'Write ONE goal title: specific, measurable, time-bound, and personally meaningful.',
    'Format: an action statement, max 15 words.',
    'Then write ONE sentence description (max 20 words): the "why" behind it.',
    'Then write ONE success_metric sentence (max 25 words): how we know they succeeded.',
    'Scale the goal to match their available daily minutes and intensity preference.',
    'Return ONLY valid JSON: { "title": "...", "description": "...", "success_metric": "..." }',
    'No explanation, no markdown — only the JSON object.',
  ].filter(Boolean).join(' ');

  const user = JSON.stringify({
    domain,
    current_satisfaction_score: domainScore,
    why: answers.whyThisDomain,
    pain: answers.whatBothersToday,
    vision: answers.whatIfSucceeds,
  });

  const text = await callOpenAi(system, user, 200);

  if (text) {
    try {
      const parsed = parseJsonObjectOr<Record<string, unknown>>(text, {});
      if (typeof parsed.title === 'string' && typeof parsed.description === 'string') {
        return {
          title: parsed.title,
          description: parsed.description,
          success_metric:
            typeof parsed.success_metric === 'string'
              ? parsed.success_metric
              : answers.whatIfSucceeds.slice(0, 200) || parsed.description,
        };
      }
    } catch { /* fall through */ }
  }

  const fallbackTitle =
    locale === 'he'
      ? `לשפר משמעותית את ה${domain} תוך 90 יום`
      : `Meaningfully improve my ${domain} in 90 days`;
  const fallbackDesc = answers.whyThisDomain.slice(0, 80);
  const fallbackMetric = answers.whatIfSucceeds.slice(0, 200) || fallbackDesc;

  return {title: fallbackTitle, description: fallbackDesc, success_metric: fallbackMetric};
}

// ── Mode: first_step ──────────────────────────────────────────────────────────

async function generateFirstStep(
  locale: AppLocale,
  domain: LifeDomain,
  goalText: string,
  ctx: UserContext,
  excludeTitle?: string
): Promise<{title: string; estimated_minutes: number; description: string}> {
  const maxMin = Math.min(5, ctx.availableTime ?? 5);
  const ctxLine = contextHint(ctx, locale);

  const system = [
    'You are a life coach assigning the very first micro-action for a new client.',
    LANG[locale],
    ctxLine,
    'The task must be:',
    `  - Completable in under ${maxMin} minutes`,
    '  - Physical or concrete (not "think about" or "plan")',
    '  - The single smallest step that creates momentum',
    excludeTitle ? `Do NOT suggest this task again: "${excludeTitle}"` : '',
    'Return ONLY valid JSON: { "title": "...", "description": "...", "estimated_minutes": <number 1-5> }',
    'No explanation, no markdown — only the JSON object.',
  ].filter(Boolean).join(' ');

  const user = JSON.stringify({domain, goal: goalText});

  const text = await callOpenAi(system, user, 120);

  if (text) {
    try {
      const parsed = parseJsonObjectOr<Record<string, unknown>>(text, {});
      if (typeof parsed.title === 'string') {
        return {
          title: parsed.title,
          description: typeof parsed.description === 'string' ? parsed.description : '',
          estimated_minutes:
            typeof parsed.estimated_minutes === 'number'
              ? Math.min(maxMin, Math.max(1, parsed.estimated_minutes))
              : maxMin,
        };
      }
    } catch { /* fall through */ }
  }

  const fallbacks: Record<LifeDomain, {en: string; he: string}> = {
    health: {en: 'Walk outside for 5 minutes right now', he: 'צא להליכה של 5 דקות עכשיו'},
    time: {en: 'Write down your 3 most important tasks today', he: 'כתוב 3 משימות חשובות להיום'},
    wealth: {en: 'Check your bank balance right now', he: 'בדוק את יתרת הבנק שלך עכשיו'},
    career: {en: 'Write one sentence about your ideal next role', he: 'כתוב משפט אחד על הקריירה שאתה רוצה'},
    relationships: {en: 'Send one genuine message to someone you care about', he: 'שלח הודעה אמיתית למישהו שאכפת לך ממנו'},
    mind: {en: 'Take 5 deep breaths slowly right now', he: 'קח 5 נשימות עמוקות לאט עכשיו'},
    spirit: {en: 'Write one thing you are genuinely grateful for', he: 'כתוב דבר אחד שאתה באמת אסיר תודה עליו'},
    house_family: {en: 'Clean one surface in your home right now', he: 'נקה משטח אחד בבית עכשיו'},
  };

  const fb = fallbacks[domain];
  return {
    title: locale === 'he' ? fb.he : fb.en,
    description: '',
    estimated_minutes: maxMin,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

function userContextFromRequest(body: OnboardingUserContext & {locale: AppLocale}): UserContext {
  return {
    availableTime: body.availableTime,
    intensityPreference: body.intensityPreference,
    coachingStyle: body.coachingStyle,
    familyStatus: body.familyStatus,
    age: body.age,
    gender: body.gender,
    lifeContextStatuses: body.lifeContextStatuses,
    wakeTime: body.wakeTime,
    sleepTime: body.sleepTime,
    preferredActionWindow: body.preferredActionWindow,
    physicalConsiderations: body.physicalConsiderations,
  };
}

export async function POST(request: Request) {
  const bodyResult = await readAuthenticatedJsonBody(request, {
    schema: onboardingAiRequestSchema,
  });
  if (!bodyResult.ok) return bodyResult.response;

  const body = bodyResult.data;
  const limited = enforceAiRateLimit({
    action: `onboarding:${body.mode}`,
    userId: bodyResult.user.id,
    limit: 20,
  });
  if (limited) return limited;

  const {locale, domain} = body;
  const ctx = userContextFromRequest(body);

  try {
    if (body.mode === 'insight') {
      const insight = await generateInsight(
        locale,
        domain,
        body.answers,
        ctx,
        body.articulationHelp
      );
      return NextResponse.json({insight});
    }

    if (body.mode === 'goal_proposal') {
      const proposal = await generateGoalProposal(
        locale,
        domain,
        body.answers,
        body.domainScore,
        ctx,
        body.tone,
        body.previousTitle
      );
      return NextResponse.json(proposal);
    }

    if (body.mode === 'insight_and_goal') {
      const [insight, proposal] = await Promise.all([
        generateInsight(locale, domain, body.answers, ctx),
        generateGoalProposal(
          locale,
          domain,
          body.answers,
          body.domainScore,
          ctx,
          body.tone,
          body.previousTitle
        ),
      ]);
      return NextResponse.json({insight, ...proposal});
    }

    const step = await generateFirstStep(
      locale,
      domain,
      body.goalText,
      ctx,
      body.excludeStepTitle
    );
    return NextResponse.json(step);
  } catch (err) {
    return serverError(`AI call failed: ${String(err)}`);
  }
}
