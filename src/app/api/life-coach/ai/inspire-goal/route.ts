import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {formatLifeContextLabels} from '@/lib/life-context-labels';
import {getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {getUserParticipantProfile} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, parseLifeCoachJsonBody, resolveLocale} from '@/lib/life-coach/server';
import {callOpenAiResponses} from '@/lib/llm/client';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {parseJsonObjectOr} from '@/lib/safe-json';
import type {AppLocale} from '@/i18n/config';
import type {LifeContextStatus} from '@/lib/life-coach/types';

const DOMAIN_CATEGORY_PROMPTS: Record<string, Record<string, string>> = {
  time: {
    morning_routine: 'morning routine and how the day starts',
    deep_work: 'deep focused work sessions',
    priorities: 'identifying and acting on what matters most',
    delegation: 'delegating tasks to free up mental bandwidth',
    digital_detox: 'reducing screen time and digital distractions',
    weekly_planning: 'weekly review and planning rituals',
    procrastination: 'overcoming procrastination and starting tasks',
    work_life_balance: 'balancing work demands with personal time',
  },
  wealth: {
    savings: 'building consistent savings habits',
    income_growth: 'growing income through new opportunities',
    debt_reduction: 'systematically reducing debt',
    investment: 'starting or improving an investment strategy',
    spending_habits: 'tracking and improving spending habits',
    emergency_fund: 'building a financial safety net',
    financial_education: 'improving financial literacy',
  },
  career: {
    skill_development: 'developing a high-value professional skill',
    visibility: 'increasing professional visibility and reputation',
    promotion: 'working toward the next career level',
    side_project: 'launching or growing a side project',
    networking: 'building meaningful professional relationships',
    leadership: 'developing leadership presence and impact',
    work_quality: 'delivering higher-quality work consistently',
  },
  relationships: {
    partnership: 'deepening the primary romantic relationship',
    family_time: 'spending more quality time with family',
    friendships: 'nurturing meaningful friendships',
    communication: 'improving communication with loved ones',
    conflict_resolution: 'handling conflict more constructively',
    social_life: 'expanding and enjoying social connections',
    boundaries: 'setting and maintaining healthy boundaries',
  },
  mind: {
    focus: 'training sustained focus and attention',
    emotional_regulation: 'managing emotions more skillfully',
    self_talk: 'improving inner dialogue and self-talk',
    stress_management: 'reducing chronic stress effectively',
    learning: 'building a consistent learning habit',
    creativity: 'nurturing creative output and expression',
    mindfulness: 'developing a regular mindfulness practice',
  },
  spirit: {
    purpose: 'connecting with a deeper sense of purpose',
    values: 'living more aligned with personal values',
    gratitude: 'cultivating a daily gratitude practice',
    spiritual_practice: 'deepening a spiritual or meditative practice',
    inner_peace: 'finding more stillness and inner calm',
    meaning: 'finding meaning in daily actions',
    community: 'contributing to and connecting with a community',
  },
  house_family: {
    home_order: 'creating a calmer, more organized home',
    family_routines: 'building reliable family routines',
    chores: 'making household chores more systematic',
    home_improvement: 'completing a meaningful home improvement',
    family_goals: 'setting and working toward shared family goals',
    environment: 'improving the quality of the living environment',
  },
  health: {
    fitness: 'improving physical fitness and exercise frequency',
    sleep: 'improving sleep quality and duration',
    nutrition: 'improving nutrition and healthy eating habits',
    weight: 'reaching and maintaining a healthy target weight',
    energy: 'raising daily energy levels',
    specific_illness: 'managing a specific health condition',
  },
};

const languageInstruction: Record<AppLocale, string> = {
  en: 'Respond in English.',
  he: 'Respond in Hebrew.',
};

type MilestonesResult = {days_30: string; days_60: string; days_90: string};

async function callOpenAi(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string | null> {
  const modelConfig = getLifeCoachModelConfig();
  const result = await callOpenAiResponses({
    model: modelConfig.structuring,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens: maxTokens,
  });
  return result?.text || null;
}

async function generateGoalInspiration(
  domain: string,
  category: string,
  locale: AppLocale,
  lifeContextLabels: string[],
  lifeContextNote?: string | null,
): Promise<string> {
  const categoryDescription = DOMAIN_CATEGORY_PROMPTS[domain]?.[category] ?? `${category} in ${domain}`;
  const noteHint = lifeContextNote?.trim()
    ? locale === 'he'
      ? `הערת המשתמש/ת על ההקשר: ${lifeContextNote.trim()}.`
      : `User context note: ${lifeContextNote.trim()}.`
    : '';
  const lifeHint =
    lifeContextLabels.length > 0
      ? locale === 'he'
        ? `התאם את המטרה להקשר החיים: ${lifeContextLabels.join(', ')}.`
        : `Adapt the goal to life context: ${lifeContextLabels.join(', ')}.`
      : '';
  const systemPrompt = [
    'You are a concise life coach assistant.',
    languageInstruction[locale],
    'Write one clear, specific, inspiring goal sentence for a busy adult.',
    'The goal must be personal, achievable in 90 days, and motivating.',
    lifeHint,
    noteHint,
    'Do not add explanation or headers — just the goal sentence itself.',
    'Maximum 30 words.',
  ]
    .filter(Boolean)
    .join(' ');
  const userPrompt = `Domain: ${domain}. Focus area: ${categoryDescription}. Write one concrete goal.`;

  const text = await callOpenAi(systemPrompt, userPrompt, 80);
  return text ?? fallbackGoalInspiration(domain, category, locale);
}

async function generateMilestonesInspiration(
  domain: string,
  category: string,
  locale: AppLocale,
  goalText: string,
  lifeContextLabels: string[],
): Promise<MilestonesResult> {
  const categoryDescription = DOMAIN_CATEGORY_PROMPTS[domain]?.[category] ?? `${category} in ${domain}`;
  const lifeHint =
    lifeContextLabels.length > 0
      ? locale === 'he'
        ? `התאם אבני דרך להקשר החיים: ${lifeContextLabels.join(', ')}.`
        : `Adapt milestones to life context: ${lifeContextLabels.join(', ')}.`
      : '';
  const systemPrompt = [
    'You are a life coach assistant that writes concrete 30/60/90-day milestones.',
    languageInstruction[locale],
    'Return ONLY a JSON object with keys: days_30, days_60, days_90.',
    'Each value is a short (max 15 words), specific, measurable milestone.',
    'Milestones must progressively build toward the 90-day goal.',
    lifeHint,
    'No markdown, no explanation — only valid JSON.',
  ]
    .filter(Boolean)
    .join(' ');
  const userPrompt = JSON.stringify({
    domain,
    focus_area: categoryDescription,
    goal: goalText || `Improve ${categoryDescription}`,
    life_context_labels: lifeContextLabels,
  });

  const text = await callOpenAi(systemPrompt, userPrompt, 200);

  if (text) {
    try {
      const parsed = parseJsonObjectOr<Record<string, unknown>>(text, {});
      if (typeof parsed.days_30 === 'string' && typeof parsed.days_60 === 'string' && typeof parsed.days_90 === 'string') {
        return {days_30: parsed.days_30, days_60: parsed.days_60, days_90: parsed.days_90};
      }
    } catch {
      // fall through to fallback
    }
  }

  return fallbackMilestonesInspiration(domain, category, locale);
}

function fallbackGoalInspiration(domain: string, category: string, locale: AppLocale): string {
  const description = DOMAIN_CATEGORY_PROMPTS[domain]?.[category] ?? `${category} in ${domain}`;
  if (locale === 'he') {
    return `אני רוצה לשפר את ${description} באופן משמעותי תוך 90 הימים הקרובים.`;
  }
  return `I want to meaningfully improve my ${description} over the next 90 days.`;
}

function fallbackMilestonesInspiration(domain: string, category: string, locale: AppLocale): MilestonesResult {
  const description = DOMAIN_CATEGORY_PROMPTS[domain]?.[category] ?? `${category} in ${domain}`;
  if (locale === 'he') {
    return {
      days_30: `להקים שגרה בסיסית ב${description}`,
      days_60: `לגבש עקביות ולראות שינוי ראשוני`,
      days_90: `לרגש תוצאות ברורות ומדידות`,
    };
  }
  return {
    days_30: `Establish a consistent baseline habit for ${description}`,
    days_60: `Show measurable progress and growing consistency`,
    days_90: `Reach the target state and sustain the new pattern`,
  };
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const bodyResult = await parseLifeCoachJsonBody<Record<string, unknown>>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = (bodyResult.data ?? {}) as Record<string, unknown>;

  const domain = typeof body.domain === 'string' ? body.domain : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : null);
  const mode = typeof body.mode === 'string' ? body.mode : 'goal';
  const goalText = typeof body.goal_text === 'string' ? body.goal_text : '';

  if (!domain || !category) {
    return jsonError('domain and category are required.', 400);
  }

  if (!(LIFE_DOMAINS as readonly string[]).includes(domain)) {
    return jsonError('Unsupported domain.', 400);
  }

  if (category.length > 120 || goalText.length > 1000) {
    return jsonError('category or goal_text is too long.', 400);
  }

  if (mode !== 'goal' && mode !== 'milestones') {
    return jsonError('Unsupported mode.', 400);
  }

  const limited = enforceAiRateLimit({
    action: `life-coach:inspire-goal:${mode}`,
    userId: current.user.id,
    limit: 30,
  });
  if (limited) return limited;

  try {
    const profile = await getUserParticipantProfile(current.user.id);
    const lifeContextLabels = formatLifeContextLabels(
      profile.life_context_statuses as LifeContextStatus[],
      locale
    );

    if (mode === 'milestones') {
      const milestones = await generateMilestonesInspiration(
        domain,
        category,
        locale,
        goalText,
        lifeContextLabels
      );
      return jsonOk(milestones);
    }

    const inspiration = await generateGoalInspiration(
      domain,
      category,
      locale,
      lifeContextLabels,
      profile.life_context_note
    );
    return jsonOk({inspiration});
  } catch (error) {
    return jsonError('Could not generate inspiration.', 500, String(error));
  }
}
