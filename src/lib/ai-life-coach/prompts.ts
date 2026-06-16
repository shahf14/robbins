import type { AppLocale } from '@/i18n/config';
import type { HealthWizardContextInput } from '@/lib/ai-life-coach/health-goal-fallback';
import { buildLifeContextAdaptationHint, lifeContextForPrompt } from '@/lib/life-context-labels';
import type {
  DailyBabyStep,
  DailyReflection,
  Goal,
  LifeContextStatus,
  LifeDomain,
  LifeDomainState,
  Milestone,
  ReflectionBlockerReason,
} from '@/lib/life-coach/types';
import type { PhysicalConsideration, PreferredActionWindow } from '@/lib/user-preferences';
import { findPhaseForDay, goalDayIndex } from '@/lib/ai-life-coach/resolve-daily-step';
import {
  pickWeeklyThemeForDate,
  resolveActiveMilestone,
} from '@/lib/goal-decomposition-tree';
import type {WeeklyGoalFocus} from '@/lib/goal-decomposition-tree/types';
import { behaviorProfileForPrompt } from '@/lib/behavior-profile/compute';
import {FAILED_ACTION_PATTERNS_PROMPT_BLOCK} from '@/lib/behavior-profile/failed-action-patterns';
import {SKIP_WINDOWS_PROMPT_BLOCK} from '@/lib/behavior-profile/skip-windows';
import type { UserBehaviorProfile } from '@/lib/behavior-profile/types';
import { recurringBlockerPatternsForPrompt } from '@/lib/blocker-patterns/detect-recurring-blockers';
import type { RecurringBlockerPattern } from '@/lib/blocker-patterns/types';
import type {AdaptiveTaskCountReason} from '@/lib/life-coach/adaptive-task-count';
import {STEP_CONTRACT_PROMPT_BLOCK} from '@/lib/life-coach/step-contract';
import {BLOCKER_DECOMPOSITION_PROMPT_BLOCK} from '@/lib/life-coach/known-blockers';
import type {KnownBlockersProfile} from '@/lib/life-coach/known-blockers';
import {knownBlockersForPrompt} from '@/lib/life-coach/known-blockers';
import {GOAL_REALISM_PROMPT_BLOCK} from '@/lib/life-coach/goal-realism-check';
import {NEXT_BEST_ACTION_PROMPT_BLOCK} from '@/lib/next-best-action';
import {STEP_REASONING_PROMPT_BLOCK} from '@/lib/life-coach/step-reasoning';
import {PROGRESS_EVIDENCE_PROMPT_BLOCK} from '@/lib/life-coach/weekly-review-emotional';
import {RECURRING_PATTERN_PROMPT_BLOCK} from '@/lib/life-coach/weekly-review-recurring-pattern';
import {ACTION_PATTERNS_PROMPT_BLOCK, buildActionPatternToolbox} from '@/lib/life-coach/action-patterns';
import {
  challengePromptBlock,
  personalizedChallengeForPrompt,
  type PersonalizedChallenge,
} from '@/lib/formulation/personalized-challenge';
import {
  habitTriggerForPrompt,
  habitTriggerPromptBlock,
  type HabitTriggerContext,
} from '@/lib/formulation/habit-trigger-routing';
import {
  barrierPlanBForPrompt,
  barrierPlanBPromptBlock,
  type BarrierPlanBStrategy,
} from '@/lib/formulation/plan-b-routing';
import {
  loadAdaptationForPrompt,
  loadAdaptationPromptBlock,
  loadAdaptationWeeklyPromptBlock,
  type LoadAdaptationContext,
} from '@/lib/formulation/load-adaptation-routing';
import {
  accountabilityForPrompt,
  accountabilityPromptBlock,
  accountabilityWeeklyPromptBlock,
  type AccountabilityContext,
} from '@/lib/formulation/accountability-routing';
import {
  behaviorChangeForPrompt,
  behaviorChangePromptBlock,
  type BehaviorChangeContext,
  type WeekBehaviorChangeAnalysis,
} from '@/lib/formulation/behavior-change-tracking';
import {
  REAL_LIFE_ALIGNMENT_PROMPT_BLOCK,
  realLifeAlignmentForPrompt,
  type RealLifeAlignmentContext,
} from '@/lib/formulation/real-life-alignment-routing';
import {
  SKIP_ADAPTATION_PROMPT_BLOCK,
} from '@/lib/formulation/skip-adaptation-routing';
import {
  coachPromptBlockForEmotionalStage,
  emotionalStageForPrompt,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {NO_FLUFF_PROMPT_BLOCK} from '@/lib/life-coach/no-fluff';
import {
  MORNING_RITUAL_ADAPTATION_PROMPT_BLOCK,
  MOOD_STRATEGY_PROMPT_BLOCK,
  ritualAdaptationForPrompt,
  type RitualAdaptationContext,
} from '@/lib/morning-ritual-adaptation';
import {
  AI_PERSONALIZATION_PROMPT_BLOCK,
  aiPersonalizationSummaryForPrompt,
  type AiPersonalizationSummary,
} from '@/lib/ai-personalization-summary';
import {
  EVENING_BRIEFING_PROMPT_BLOCK,
  eveningBriefingForPrompt,
  type EveningBriefingForTomorrow,
} from '@/lib/evening-reset/for-daily-steps';
import {
  OVERPLANNING_PROMPT_BLOCK,
  overplanningForPrompt,
  type OverplanningContext,
} from '@/lib/life-coach/overplanning';
import {
  STEP_VALUE_FEEDBACK_PROMPT_BLOCK,
  stepValueFeedbackForPrompt,
} from '@/lib/step-value-feedback/summarize';
import {VALUE_GATE_PROMPT_BLOCK} from '@/lib/life-coach/value-gate';
import {
  applyPersonalDifficultyCalibration,
  calibrationForPrompt,
  type PersonalDifficultyCalibration,
} from '@/lib/life-coach/personal-difficulty-calibration';
import {
  longTermProfileForPrompt,
  shortTermContextForPrompt,
  type LongTermProfile,
  type ShortTermContext,
} from '@/lib/coach-memory';
import {
  executionHistoryForPrompt,
  type ExecutionHistorySummary,
} from '@/lib/execution-history/summarize';

const BEHAVIOR_PROFILE_SYSTEM_HINT =
  'When user_behavior_profile is provided, personalize timing, difficulty, and domain focus from it. ' +
  'Low avg_completion_rate_7d or low recovery_rate → shorter easier steps. ' +
  'High low_energy_frequency → default to recovery-sized tasks. ' +
  'Prefer preferred_domains and best_action_window. Avoid common_blockers patterns. ' +
  'Avoid scheduling demanding tasks in avoid_windows; place demanding work in best_windows. ' +
  'Do not repeat failed_action_patterns from user_behavior_profile.';

const RECURRING_BLOCKER_HINT =
  'When recurring_blocker_patterns is provided, treat each pattern as a confirmed loop — ' +
  'apply suggested_adjustment (reduce_task_count, shorten_steps, clarify_steps, plan_b_first, etc.). ' +
  'Name the pattern without shame and change the plan, not the person.';

const ADAPTIVE_TASK_COUNT_HINT =
  'Use max_steps from the payload as a hard cap — generate EXACTLY that many steps, never more. ' +
  'Optimize for daily completion rate, not step volume. ' +
  'If easy_only is true, every step MUST be difficulty easy and at most 10 minutes.';

const DIFFICULTY_CALIBRATION_HINT =
  'Use personal_difficulty from the payload. Never exceed max_minutes or difficulty_ceiling. ' +
  'Aim near target_minutes — if overload_skip_rate is high, stay shorter. ' +
  'When ramp_mode is raise and completion is strong, you may approach max_minutes gradually.';

const TONE_PERSONALIZATION_HINT =
  'Tone is dynamic: follow preferred_tone exactly and never use avoid_tone phrasing. ' +
  'If completion_by_tone shows low completion on motivational/direct, soften copy. ' +
  'If supportive completes well, you may be slightly more challenging.';

const EXECUTION_HISTORY_HINT =
  'Use execution_history as ground truth for what actually happened — not ideals. ' +
  'If completed_easy is high but skipped_hard is high, default to easy steps. ' +
  'Mirror patterns from best_days. Address worst_blocker directly in today\'s steps. ' +
  'Reference step_highlights for specificity — never generic advice. ' +
  'If step_contract_quality.edit_rate is high, titles were too vague — use sharper imperative actions. ' +
  'If completion_rate is low, shorten steps and strengthen fallback_step. ' +
  'If unclear_task_skip_rate is high, every title must start with a concrete verb + object. ' +
  'If decomposition_coherence.day_coherence_rate is low, anchor every step to weekly_focus.today_theme. ' +
  'If step_explainability.completion_lift is negative, strengthen why_this_step with yesterday signals.';

const SHORT_TERM_MEMORY_HINT =
  'short_term_context = last 7 days: current energy/mood, pending backlog, recent_blockers. ' +
  'Adapt today\'s plan to this week\'s reality — not a generic ideal week.';

const LONG_TERM_MEMORY_HINT =
  'long_term_profile = 30-day patterns: what actually works (winning_patterns, best_action_window). ' +
  'Never repeat losing_patterns or anything in avoid. Prefer successful_domains and proven step types.';

const PHYSICAL_CONSIDERATIONS_HE: Record<PhysicalConsideration, string> = {
  low_intensity:
    'עצימות נמוכה בלבד — הצע פעילויות קלות (הליכה, מתיחות, נשימה). אל תציע אירובי עצים או אימון כוח כבד.',
  physical_limitation:
    'מגבלה פיזית — הצע פעילויות בישיבה או שכיבה, ללא מאמץ גבוה. אל תציע ריצה, קפיצה, או עמידה ממושכת.',
  pregnancy_postpartum:
    'הריון/לאחר לידה — פעילויות בטוחות בלבד: הליכה קלה, מתיחות עדינות, נשימה. אסור להציע ירידה במשקל, עצימות גבוהה, או לחץ בטני.',
};

const PHYSICAL_CONSIDERATIONS_EN: Record<PhysicalConsideration, string> = {
  low_intensity:
    'Low intensity only — suggest light activities (walking, stretching, breathing). No intense cardio or heavy strength training.',
  physical_limitation:
    'Physical limitation — suggest activities doable seated or lying down. No running, jumping, or prolonged standing exercise.',
  pregnancy_postpartum:
    'Pregnancy/postpartum — pregnancy-safe activities only: gentle walking, gentle stretching, breathing. Never suggest weight loss, high intensity, or abdominal strain.',
};

function buildPhysicalConsiderationsHint(
  considerations: PhysicalConsideration[] | null | undefined,
  locale: AppLocale
): string {
  if (!considerations?.length) return '';
  const map = locale === 'he' ? PHYSICAL_CONSIDERATIONS_HE : PHYSICAL_CONSIDERATIONS_EN;
  const hints = considerations.map((c) => map[c]).filter(Boolean) as string[];
  if (!hints.length) return '';
  const header =
    locale === 'he'
      ? '## מגבלות פיזיות (קריטי — חובה לשמור):'
      : '## Physical considerations (critical — must respect):';
  return [header, ...hints.map((h) => `- ${h}`)].join('\n');
}

// ── Age group helpers ──────────────────────────────────────────────────────────

type AgeGroup = 'youth' | 'young_adult' | 'mid_adult' | 'mature_adult' | 'senior';

function classifyAgeGroup(age: number | null | undefined): AgeGroup | null {
  if (!age || age < 16) return null;
  if (age < 20) return 'youth';
  if (age < 30) return 'young_adult';
  if (age < 50) return 'mid_adult';
  if (age < 65) return 'mature_adult';
  return 'senior';
}

const AGE_HEALTH_HE: Record<AgeGroup, string> = {
  youth: 'גיל 16–19: הצע הרגלים בסיסיים ובטוחים. מניעת פציעות חשובה יותר מעצימות. פעילות קצרה ועקבית עדיפה.',
  young_adult: 'גיל 20–29: ניתן להציע עצימות מתונה–גבוהה עם התאוששות מלאה. מיקוד בבניית הרגל ועקביות.',
  mid_adult: 'גיל 30–49: בריאות מטבולית, ניהול סטרס ואיכות שינה חשובים כמו הפעילות עצמה. ההתאוששות אחרי מאמץ גבוה ארוכה יותר מגיל 20.',
  mature_adult: 'גיל 50–64: הגנה על מפרקים חיונית. סיכון קרדיווסקולרי גבוה יותר. אסור להציע ימים עוקבים של עצימות גבוהה. עקביות > עצימות.',
  senior: 'גיל 65+: ניידות, גמישות ובריאות קרדיווסקולרית עדינה. אין להציע מאמץ מעל 15 דקות ברצף. כל שיפור קטן הוא הצלחה.',
};

const AGE_HEALTH_EN: Record<AgeGroup, string> = {
  youth: 'Age 16–19: Suggest safe foundational habits. Injury prevention over intensity. Short, consistent activity is best.',
  young_adult: 'Age 20–29: Moderate to high intensity is fine with full recovery. Focus on habit building and consistency.',
  mid_adult: 'Age 30–49: Metabolic health, stress management, and sleep quality matter as much as exercise. Recovery after high effort takes longer than in their 20s.',
  mature_adult: 'Age 50–64: Joint protection is essential. Higher cardiovascular risk. Never suggest consecutive high-intensity days. Consistency over intensity.',
  senior: 'Age 65+: Mobility, flexibility, and gentle cardiovascular health. Do not suggest continuous effort beyond 15 minutes. Every small improvement is a win.',
};

const PERIMENOPAUSE_HE =
  'חשוב (אישה 40–58): שינויי משקל, עייפות וקשיי שינה בגיל זה עשויים להיות הורמונליים — לא רק חוסר מאמץ. אסור למסגר שינויי משקל כבעיית רצון. תעדף ניהול אנרגיה, שינה והפחתת סטרס.';
const PERIMENOPAUSE_EN =
  'Important (woman 40–58): Weight changes, fatigue, and sleep issues at this age may be hormonal — not just effort-related. Never frame weight changes as a willpower problem. Prioritize energy management, sleep, and stress reduction.';

const MEN_HEALTH_HE =
  'גבר 35–55 (בריאות ו-mind): מסגר בריאות כ"ניהול ביצועים ומניעה" — לא "מסע לבריאות". שפה: "אנרגיה", "חדות", "הפחתת סיכון קרדיווסקולרי". לתחום mind: "ביצועים מנטליים", "ריכוז תחת לחץ" — לא "חיבור רגשי". הוסף נגיעה עדינה לבדיקות מניעה שגרתיות.';
const MEN_HEALTH_EN =
  'Man 35–55 (health & mind): Frame health as "performance management and prevention" — not a "wellness journey." Language: "energy", "sharpness", "cardiovascular risk reduction." For mind goals: "mental performance", "focus under pressure" — not "emotional connection." Include a light nudge toward routine preventive checkups.';

function buildAgeHealthHint(
  age: number | null | undefined,
  gender: string | null | undefined,
  locale: AppLocale
): string {
  const parts: string[] = [];
  const ageClass = classifyAgeGroup(age);
  if (ageClass) {
    parts.push(locale === 'he' ? AGE_HEALTH_HE[ageClass] : AGE_HEALTH_EN[ageClass]);
  }
  if (gender === 'female' && age != null && age >= 40 && age <= 58) {
    parts.push(locale === 'he' ? PERIMENOPAUSE_HE : PERIMENOPAUSE_EN);
  }
  if (gender === 'male' && age != null && age >= 35 && age <= 55) {
    parts.push(locale === 'he' ? MEN_HEALTH_HE : MEN_HEALTH_EN);
  }
  if (!parts.length) return '';
  const header = locale === 'he' ? '## הקשר גיל ופיזיולוגיה (חובה):' : '## Age & physiology context (required):';
  return [header, ...parts.map((p) => `- ${p}`)].join('\n');
}

type DomainStageMap = Partial<Record<string, string>> & { _fallback: string };

const LIFE_STAGE_HE: Record<AgeGroup, DomainStageMap> = {
  youth: {
    career: 'גיל 16–19: מיילסטוני קריירה — חשיפה ראשונית, מיומנויות בסיס. לא ניהול בכיר.',
    wealth: 'גיל 16–19: כספים — קרן חירום ראשונה, הרגלי חיסכון. לא תכנון פרישה.',
    health: 'גיל 16–19: בריאות — הרגלי בסיס, שינה, מניעת פציעות. לא תחרות.',
    mind: 'גיל 16–19: נפש — גיבוש זהות, בהירות ערכים, "מי אני". לא להאיץ תשובות.',
    spirit: 'גיל 16–19: רוחניות — חיבור למשהו גדול ממני, חיפוש משמעות מעבר להישגים.',
    house_family: 'גיל 16–19: בית/משפחה — דינמיקה משפחתית, גבולות, צעדים ראשונים לעצמאות.',
    _fallback: 'גיל 16–19: קבע מיילסטונים מינימליסטיים ריאליסטיים. לא ציפיות של מבוגר מבוסס.',
  },
  young_adult: {
    career: 'גיל 20–29: קריירה — רכישת מיומנויות, נראות, תפקיד ראשון/שני. לא ניהול בכיר.',
    wealth: 'גיל 20–29: כספים — קרן חירום, יציאה מחוב, השקעה ראשונה. לא אופטימיזציית פרישה.',
    health: 'גיל 20–29: בריאות — בניית בסיס פיזי, עקביות, שינה. מותר להציע עצימות מתונה.',
    relationships: 'גיל 20–29: קשרים רומנטיים ובניית ידידויות בוגרות. לחץ השוואה חברתית.',
    mind: 'גיל 20–29: נפש — מציאת כיוון, "האם אני בדרך הנכונה?", התמודדות עם לחץ חיצוני לבחירות חיים.',
    spirit: 'גיל 20–29: רוחניות — חיפוש ערכים, יישור בין ערכים לבחירות. לא תשובות — שאלות.',
    house_family: 'גיל 20–29: בית/משפחה — מגורים עצמאיים ראשונים, מעבר לזוגיות, יחסים עם הורים.',
    _fallback: 'גיל 20–29: שלב של בניה — מיילסטונים ראשוניים, לא אופטימיזציה.',
  },
  mid_adult: {
    career: 'גיל 30–49: קריירה — מנהיגות, השפעה, איזון עבודה-חיים. 90 יום יכולים לכלול קידום.',
    wealth: 'גיל 30–49: כספים — רכישת דיור, עלויות משפחה, צמיחת הכנסה.',
    health: 'גיל 30–49: בריאות — מניעה, בריאות מטבולית, ניהול סטרס. לא רק אירובי.',
    relationships: 'גיל 30–49: שותפות, הורות, שמירה על ידידויות למרות לוח עמוס.',
    mind: 'גיל 30–49: נפש — משמעות בעבודה ובהורות, מניעת שחיקה, "האם זה מה שרציתי?". לא תשובות פשוטות.',
    spirit: 'גיל 30–49: רוחניות — חיבור מחדש לעצמי בתוך עומס. מיילסטונים: 10 דקות שקט, שגרה מעגנת.',
    house_family: 'גיל 30–49: בית/משפחה — עומס ניהולי, הורות, חלוקת תפקידים. מיילסטונים ריאליסטיים שמפחיתים עומס — לא מוסיפים.',
    _fallback: 'גיל 30–49: שלב שיא עומס — מיילסטונים ריאליסטיים המתחשבים בהתחייבויות מרובות.',
  },
  mature_adult: {
    career: 'גיל 50–64: קריירה — מורשת, העברת ידע, פיבוט אפשרי. לא "בנה קריירה מאפס".',
    wealth: 'גיל 50–64: כספים — תכנון לפני פרישה, אופטימיזציית מס, שימור תיק.',
    health: 'גיל 50–64: בריאות — מניעת מחלות כרוניות, ניידות, גמישות. עקביות על עצימות.',
    relationships: 'גיל 50–64: עמקות בקשרים קיימים, קשר עם ילדים/נכדים, קהילה.',
    mind: 'גיל 50–64: נפש — שאלת המשמעות של "מה מגיע אחרי?", מה חשוב עכשיו. לא פחד מהמוות — שאלות חיים.',
    spirit: 'גיל 50–64: רוחניות — עיבוד משמעות החיים, רגיעה קיומית, עומק ולא רוחב.',
    house_family: 'גיל 50–64: בית/משפחה — קן ריק, טיפול בהורים מזדקנים, גילוי מחדש של הזוגיות. פחות ניהול, יותר חיבור.',
    _fallback: 'גיל 50–64: מיילסטונים של ייצוב ומשמעות, לא פריצה. פחות אופטימיזציה, יותר עומק.',
  },
  senior: {
    career: 'גיל 65+: פרישה/קריירה — תרומה, ייעוץ, מורשת. לא יעדים עסקיים מסחריים.',
    wealth: 'גיל 65+: כספים — אסטרטגיית משיכה, ירושה. לא צבירת הון.',
    health: 'גיל 65+: בריאות — ניידות, עצמאות, חיוניות. כל שיפור קטן הוא ניצחון.',
    relationships: 'גיל 65+: התמודדות עם אובדן, חברות, שייכות לקהילה.',
    mind: 'גיל 65+: נפש — העברת חוכמה, שלום עם העבר, מה מגיע בהמשך. כבוד לתהליך.',
    spirit: 'גיל 65+: רוחניות — מורשת, משמעות מה שנבנה, שלמות עם מה שהיה.',
    house_family: 'גיל 65+: בית/משפחה — מעבר לדיור קטן יותר, זמן עם נכדים, מה להשאיר אחריך.',
    _fallback: 'גיל 65+: מיילסטונים של חיוניות ומשמעות. לא תחרות עם גיל צעיר יותר.',
  },
};

const LIFE_STAGE_EN: Record<AgeGroup, DomainStageMap> = {
  youth: {
    career: 'Age 16–19: Career milestones — foundational skills, first job exposure. Not senior management.',
    wealth: 'Age 16–19: Financial milestones — first emergency fund, savings habits. Not retirement planning.',
    health: 'Age 16–19: Health — baseline habits, sleep, injury prevention. Not competition.',
    _fallback: 'Age 16–19: Set minimal, realistic milestones. Not adult professional expectations.',
  },
  young_adult: {
    career: 'Age 20–29: Career milestones — skill acquisition, visibility, first/second role. Not senior leadership.',
    wealth: 'Age 20–29: Financial milestones — emergency fund, eliminating debt, first investments. Not retirement optimization.',
    health: 'Age 20–29: Health — build physical baseline, consistency, sleep. Moderate intensity is fine.',
    relationships: 'Age 20–29: Romantic relationships and adult friendships. Social comparison pressure.',
    _fallback: 'Age 20–29: Building phase — foundational milestones, not optimization.',
  },
  mid_adult: {
    career: 'Age 30–49: Career milestones — leadership, influence, work-life integration. 90-day milestones can include promotion.',
    wealth: 'Age 30–49: Financial milestones — home ownership, family costs, income scaling.',
    health: 'Age 30–49: Health — prevention, metabolic health, stress management. Not just cardio intensity.',
    relationships: 'Age 30–49: Partnership, parenting, maintaining friendships despite a busy schedule.',
    _fallback: 'Age 30–49: Peak load phase — realistic milestones that account for multiple commitments.',
  },
  mature_adult: {
    career: 'Age 50–64: Career milestones — legacy, knowledge transfer, possible pivot. Not starting from scratch.',
    wealth: 'Age 50–64: Financial milestones — pre-retirement planning, tax optimization, portfolio preservation.',
    health: 'Age 50–64: Health — chronic disease prevention, mobility, flexibility. Consistency over intensity.',
    relationships: 'Age 50–64: Deepening existing relationships, family connection, community.',
    _fallback: 'Age 50–64: Milestones of stability and meaning. Less optimization, more depth.',
  },
  senior: {
    career: 'Age 65+: Career/retirement — volunteering, mentoring, legacy. Not commercial career goals.',
    wealth: 'Age 65+: Finances — drawdown strategy, estate planning. Not wealth accumulation.',
    health: 'Age 65+: Health — mobility, independence, vitality. Every small improvement is a win.',
    relationships: 'Age 65+: Navigating loss, companionship, community belonging.',
    _fallback: 'Age 65+: Vitality and meaning milestones. Not competing with a younger age.',
  },
};

const RELATIONSHIPS_GENDER_HE: Partial<Record<AgeGroup, Partial<Record<string, string>>>> = {
  young_adult: {
    female: 'אישה 20–29: לחץ השוואה חברתית ברשתות, ציפיות רומנטיות לא מנוסחות, ותחזוקת ידידויות תחת עומס. מיילסטונים צריכים לטפל בגבולות ובפרסונה החברתית — לא רק ב"שיפור תקשורת".',
    male: 'גבר 20–29: בניית ידידויות בוגרות אחרי מסלול ישיר של לימודים/צבא. קשה לשמר קשרים ללא מבנה. מיילסטונים: פורמטים קלים — לשלוח מסרון, לשתף משהו מעניין.',
  },
  mid_adult: {
    female: 'אישה 30–49: ניהול עומס מנטלי בזוגיות ובהורות, שמירה על ידידויות למרות עומס. מיילסטונים מציאותיים — לא "שיחות עמוקות פעמיים בשבוע".',
    male: 'גבר 30–49: סיכון בידוד גבוה — גברים מאבדים ידידויות בגיל זה. קשרים קשורים לרוב לעבודה. צעדים: פורמטים של חיבור נמוך-מאמץ (הצטרף לפעילות, שלח הודעה). אל תציע "שיחה פגיעה ועמוקה" כצעד ראשון.',
  },
  mature_adult: {
    male: 'גבר 50–64: רשת חברתית לרוב קשורה לעבודה — לקראת פרישה זה מסוכן. מיילסטון: בניית קשרים מחוץ לעבודה לפני הפרישה. קהילה, תחביב, וולונטריאות.',
  },
  senior: {
    male: 'גבר 65+: ניתוק חברתי אחרי פרישה הוא דפוס נפוץ. בדידות היא הסיכון המרכזי. מיילסטונים: שגרות חברתיות קבועות, לא "תהיה יותר פתוח".',
  },
};

const RELATIONSHIPS_GENDER_EN: Partial<Record<AgeGroup, Partial<Record<string, string>>>> = {
  young_adult: {
    female: 'Woman 20–29: Social comparison pressure, unspoken romantic expectations, and friendship maintenance under load. Milestones should address boundaries and social persona — not just "improve communication."',
    male: 'Man 20–29: Building adult friendships without the structure of school or military. Hard to maintain connections without a framework. Milestones: low-effort formats — send a message, share something interesting.',
  },
  mid_adult: {
    female: 'Woman 30–49: Managing mental load in partnership and parenting while maintaining friendships. Realistic milestones — not "deep conversations twice a week."',
    male: 'Man 30–49: High isolation risk — men typically lose friendships in this bracket. Connections often tied to work. Steps: low-effort connection formats (join an activity, send a message). Do NOT suggest "a vulnerable, deep conversation" as step one.',
  },
  mature_adult: {
    male: 'Man 50–64: Social network often tied to work — risky as retirement approaches. Milestone: build connections outside work before retirement. Community, hobbies, volunteering.',
  },
  senior: {
    male: 'Man 65+: Social disconnection after retirement is a common pattern. Loneliness is the primary risk. Milestones: regular social routines, not "be more open."',
  },
};

const HOUSE_FAMILY_GENDER_HE: Partial<Record<AgeGroup, Partial<Record<string, string>>>> = {
  mid_adult: {
    female: 'אישה 30–49: העומס המנטלי הביתי (mental load) נופל בצורה לא פרופורציונלית על נשים — תכנון, זיכרון, רשימות. אל תציע "תבקשי עזרה" כצעד ראשון — זה מניח שהיא אחראית לבקש. מיילסטונים: חלוקה מובנית מראש, לא תלויה ביוזמתה.',
    male: 'גבר 30–49: זהות ה"פרנס" עלולה להקטין מעורבות בניהול הבית. מיילסטונים: לקחת בעלות על תחום ניהולי ספציפי (תכנון ארוחות, לו"ז ילדים), לא סיוע כשמתבקשים.',
  },
  mature_adult: {
    female: 'אישה 50–64: טיפול בהורים מזדקנים נופל לרוב על הבת. גם עם ילדים בוגרים — העומס הרגשי ממשיך. מיילסטונים: להפחית עומס, לא להוסיף. אל תציע "להקדיש יותר זמן" — שאלי מה אפשר להעביר לאחרים.',
  },
};

const HOUSE_FAMILY_GENDER_EN: Partial<Record<AgeGroup, Partial<Record<string, string>>>> = {
  mid_adult: {
    female: 'Woman 30–49: The mental load of home management falls disproportionately on women — planning, memory, logistics. Do not suggest "ask for help" as step one — that assumes she is responsible for requesting it. Milestones: structured pre-agreed division, not dependent on her initiative.',
    male: 'Man 30–49: "Provider" identity can reduce hands-on household involvement. Milestones: take ownership of a specific management area (meal planning, kids\' schedule), not just pitching in when asked.',
  },
  mature_adult: {
    female: 'Woman 50–64: Aging parent care disproportionately falls on daughters. Even with adult children, the emotional load continues. Milestones: reduce load, not add to it. Do not suggest "dedicate more time" — ask what can be delegated.',
  },
};

function buildAgeLifeStageHint(
  age: number | null | undefined,
  gender: string | null | undefined,
  domain: string,
  locale: AppLocale
): string {
  const ageClass = classifyAgeGroup(age);
  if (!ageClass) return '';
  const map = locale === 'he' ? LIFE_STAGE_HE : LIFE_STAGE_EN;
  const stageMap = map[ageClass];
  const domainHint = (stageMap[domain] ?? stageMap._fallback);
  const parts = [domainHint];
  if (gender === 'female' && age != null && age >= 40 && age <= 58 && domain === 'health') {
    parts.push(
      locale === 'he'
        ? 'אישה בגיל מעבר אפשרי (40–58): שינויי משקל ועייפות עשויים להיות הורמונליים. אל תמסגר כבעיית רצון. מיילסטונים חייבים להתחשב בשינויים הורמונליים.'
        : 'Woman in likely perimenopause window (40–58): weight changes and fatigue may be hormonal. Do not frame as willpower. Milestones must account for hormonal changes.'
    );
  }
  if (domain === 'relationships' && gender && (gender === 'male' || gender === 'female')) {
    const gMap = locale === 'he' ? RELATIONSHIPS_GENDER_HE : RELATIONSHIPS_GENDER_EN;
    const gHint = gMap[ageClass]?.[gender];
    if (gHint) parts.push(gHint);
  }
  if (domain === 'house_family' && gender && (gender === 'male' || gender === 'female')) {
    const gMap = locale === 'he' ? HOUSE_FAMILY_GENDER_HE : HOUSE_FAMILY_GENDER_EN;
    const gHint = gMap[ageClass]?.[gender];
    if (gHint) parts.push(gHint);
  }
  const header = locale === 'he' ? '## שלב חיים — מסגרת מיילסטונים (חשוב):' : '## Life stage — milestone framing (important):';
  return [header, ...parts.map((p) => `- ${p}`)].join('\n');
}

// ── Age-adapted coaching tone ──────────────────────────────────────────────────

const AGE_TONE_HE: Partial<Record<AgeGroup, string>> = {
  youth: 'שפה חקרנית ופתוחה: "מה לדעתך יקרה אם תנסה...", "תגלה", "ניסוי". לא טון הרצאה.',
  young_adult: 'שפה מוכוונת תוצאות: "תוך 6 שבועות תשים לב ל...", "ראיות מראות ש...". לא מוסרני.',
  mature_adult: 'שפה מאשרת חוכמה: "בשלב זה בחיים שלך", "עם הניסיון שצברת", "אתה כבר יודע ש...". לא מתנשא.',
  senior: 'שפה של מורשת ומשמעות: "מה שבנית", "החוכמה שצברת", "מה שאנשים סביבך ילמדו ממך".',
};

const AGE_TONE_EN: Partial<Record<AgeGroup, string>> = {
  youth: 'Exploratory language: "what do you think would happen if you tried", "discover", "experiment." Not a lecture tone.',
  young_adult: 'Results-oriented language: "within 6 weeks you\'ll notice", "evidence shows that." Not preachy.',
  mature_adult: 'Wisdom-affirming language: "at this stage of your life", "given your experience", "you already know that." Not condescending.',
  senior: 'Legacy and meaning language: "what you\'ve built", "the wisdom you carry", "what those around you will take from you."',
};

function buildAgeCoachingToneAugment(
  age: number | null | undefined,
  locale: AppLocale
): string {
  const ageClass = classifyAgeGroup(age);
  if (!ageClass) return '';
  const map = locale === 'he' ? AGE_TONE_HE : AGE_TONE_EN;
  const hint = map[ageClass];
  if (!hint) return '';
  const header = locale === 'he' ? '## שכבת שפה לפי גיל:' : '## Age-adapted language layer:';
  return `${header}\n- ${hint}`;
}

const languageInstruction: Record<AppLocale, string> = {
  en: 'CRITICAL: Write EVERY string value in the JSON output (titles, descriptions, metrics, summaries, recommendations) in English only. Do not mix in any other language.',
  he: 'קריטי: כל ערך טקסטואלי בפלט ה-JSON (כותרות, תיאורים, מדדים, סיכומים, המלצות) חייב להיכתב בעברית בלבד, בניסוח טבעי ומודרני. אסור לערבב אנגלית או כל שפה אחרת — גם לא מילה בודדת. אם מצוטט טקסט של המשתמש, תרגם אותו לעברית.',
};

function buildToneInstruction(
  coachingStyle: string,
  preferredTone?: string,
  avoidTone?: string
): string {
  const base = coachingStyleInstruction[coachingStyle] ?? coachingStyleInstruction.supportive;
  const parts = [base];
  if (preferredTone?.trim()) parts.push(`preferred_tone: ${preferredTone.trim()}`);
  if (avoidTone?.trim()) parts.push(`avoid_tone: ${avoidTone.trim()}`);
  parts.push(TONE_PERSONALIZATION_HINT);
  return parts.join('\n');
}

export function buildGoalStructuringSystemPrompt(
  locale: AppLocale,
  hasHealthWizard = false,
  lifeContextStatuses: LifeContextStatus[] = [],
  coachingStyle = 'supportive',
  preferredTone?: string,
  avoidTone?: string,
  age?: number | null,
  gender?: string | null,
  domain?: string
) {
  const lifeHint = buildLifeContextAdaptationHint(lifeContextStatuses, locale);
  const styleInstruction = buildToneInstruction(coachingStyle, preferredTone, avoidTone);
  const toneAugment = buildAgeCoachingToneAugment(age, locale);
  const lifeStageHint = domain ? buildAgeLifeStageHint(age, gender, domain, locale) : '';
  const base = [
    'You are an AI executive life coach inspired by Tony Robbins RPM methodology.',
    languageInstruction[locale],
    styleInstruction,
    toneAugment,
    'Your job is to convert vague life goals into clear, realistic, measurable goals, milestones, and small daily actions.',
    'Do not give generic motivational advice.',
    'Make the plan realistic for a busy adult.',
    'Baby steps must be specific, small, and executable today.',
    'Never provide medical, legal, or financial advice as absolute instruction.',
    lifeHint,
    lifeStageHint,
    STEP_CONTRACT_PROMPT_BLOCK,
    '',
    VALUE_GATE_PROMPT_BLOCK,
    '',
    NO_FLUFF_PROMPT_BLOCK,
    '',
    AI_PERSONALIZATION_PROMPT_BLOCK,
    '',
    GOAL_REALISM_PROMPT_BLOCK,
    '',
    FAILED_ACTION_PATTERNS_PROMPT_BLOCK,
    '',
    NEXT_BEST_ACTION_PROMPT_BLOCK,
    'Return only valid JSON.',
  ].filter(Boolean);

  if (hasHealthWizard) {
    return [
      ...base,
      '',
      '## Health wizard (structured input provided)',
      '- Use health_wizard_context as the source of truth: category, metrics, timeline, anchor, weight_direction.',
      '- daily_baby_steps[0] must match category: nutrition/weight_gain → meal planning or eating; sleep → wind-down; fitness → movement.',
      '- Do NOT default to walking unless category is fitness.',
      '- Prefix today\'s baby step with the user anchor: "After [anchor] at [time], ...".',
      '- weight_direction "gain" or secondary_focus "weight_gain": encourage additional meals/calories, never weight-loss advice.',
      '- execution_plan: 4 to 13 phases covering days 1-90. Each phase has start_day, end_day, focus, task_templates (1-7 items), optional weigh_in near milestones.',
      '- Phases should progress: weeks 1-2 base habit, weeks 3-8 consistency, weeks 9-13 stabilization.',
      '- plan_source in output is not required; include execution_plan always.',
    ].join('\n');
  }

  return [
    ...base,
    '',
    '## Health Domain Specialization',
    'When the domain is "health":',
    '- Focus on one of these subcategories: fitness, sleep, nutrition, weight, energy, or specific illness management.',
    '- Success metrics must be numeric and measurable.',
    '- Milestones at 30, 60, and 90 day intervals.',
    '- Baby steps anchored to existing habits when possible.',
    '- Avoid shame-based motivation.',
  ].join('\n');
}

export function buildGoalStructuringUserPrompt(input: {
  locale: AppLocale;
  domain: string;
  assessment: Pick<LifeDomainState, 'current_score' | 'current_state' | 'desired_state' | 'main_blockers' | 'available_time_per_day' | 'intensity_preference'> | null;
  raw_goal: string;
  deadline: string | null;
  motivation: string;
  constraints: string;
  health_wizard_context?: HealthWizardContextInput;
  life_context_statuses?: LifeContextStatus[];
  age?: number | null;
  gender?: string | null;
  known_blockers?: KnownBlockersProfile | null;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  user_behavior_profile?: UserBehaviorProfile | null;
}) {
  const lifeContext = lifeContextForPrompt(input.life_context_statuses, input.locale);
  return JSON.stringify(
    {
      domain: input.domain,
      participant_age: input.age ?? null,
      participant_gender: input.gender ?? null,
      current_score: input.assessment?.current_score ?? null,
      current_state: input.assessment?.current_state ?? '',
      desired_state: input.assessment?.desired_state ?? '',
      main_blockers: input.assessment?.main_blockers ?? [],
      known_blockers: knownBlockersForPrompt(input.known_blockers),
      ai_personalization_summary: aiPersonalizationSummaryForPrompt(
        input.ai_personalization_summary
      ),
      available_time_per_day: input.assessment?.available_time_per_day ?? null,
      intensity_preference: input.assessment?.intensity_preference ?? 'balanced',
      life_context_statuses: lifeContext.statuses,
      life_context_labels: lifeContext.labels,
      raw_goal: input.raw_goal,
      deadline: input.deadline,
      motivation: input.motivation,
      constraints: input.constraints,
      health_wizard_context: input.health_wizard_context ?? null,
      user_behavior_profile: behaviorProfileForPrompt(input.user_behavior_profile ?? null),
    },
    null,
    2
  );
}

const coachingStyleInstruction: Record<string, string> = {
  supportive: 'Coaching style: be warm, encouraging, and empathetic. Celebrate small wins.',
  direct: 'Coaching style: be concise and direct. Focus on the action, skip motivational preamble.',
  motivational: 'Coaching style: be energetic and inspiring. Use strong, action-oriented language.',
};

export function buildDailyStepsSystemPrompt(
  locale: AppLocale,
  focusedHealthPlan = false,
  wakeTime = '07:00',
  coachingStyle = 'supportive',
  preferredTone?: string,
  avoidTone?: string,
  lifeContextStatuses: LifeContextStatus[] = [],
  physicalConsiderations: PhysicalConsideration[] = [],
  preferredActionWindow: PreferredActionWindow = 'flexible',
  age?: number | null,
  gender?: string | null,
  sleepTime = '22:30',
  emotionalRouting?: EmotionalStageRouting | null
) {
  const lifeHint = buildLifeContextAdaptationHint(lifeContextStatuses, locale);
  const physicalHint = buildPhysicalConsiderationsHint(physicalConsiderations, locale);
  const ageHint = buildAgeHealthHint(age, gender, locale);
  const toneAugment = buildAgeCoachingToneAugment(age, locale);

  const [sleepH, sleepM] = sleepTime.split(':').map(Number);
  const cutoffMinutes = Math.max(0, sleepH * 60 + (sleepM ?? 0) - 60);
  const cutoffTime = `${String(Math.floor(cutoffMinutes / 60)).padStart(2, '0')}:${String(cutoffMinutes % 60).padStart(2, '0')}`;

  const sleepInstruction =
    locale === 'he'
      ? `המשתמש/ת בדרך כלל הולך/ת לישון ב-${sleepTime}. אל תציע משימות פעילות אחרי ${cutoffTime}. צעדים בערב צריכים להיות הרגעה, סגירה או הכנה ליום הבא — לא משימות מורכבות.`
      : `The user typically goes to sleep at ${sleepTime}. Do not schedule active tasks after ${cutoffTime}. Evening steps should be wind-down, closure, or next-day prep — not demanding work.`;

  const windowInstruction = preferredActionWindow === 'flexible'
    ? `The user typically wakes up at ${wakeTime} and sleeps at ${sleepTime}. Schedule tasks to start no earlier than ${wakeTime}, spread across the day, and finish active work before ${cutoffTime}.`
    : {
      morning: `The user wakes at ${wakeTime} and sleeps at ${sleepTime}. Preferred action window: morning (06:00–12:00). Place all steps within this range, before ${cutoffTime}.`,
      midday: `The user wakes at ${wakeTime} and sleeps at ${sleepTime}. Preferred action window: midday (10:00–14:00). Place all steps within this range, before ${cutoffTime}.`,
      evening: `The user wakes at ${wakeTime} and sleeps at ${sleepTime}. Preferred action window: evening (17:00–21:00). Place wind-down steps here, finishing before ${cutoffTime}.`,
    }[preferredActionWindow];

  const lines = [
    'You generate daily baby steps for a user\'s life goals.',
    languageInstruction[locale],
    buildToneInstruction(coachingStyle, preferredTone, avoidTone),
    toneAugment,
    lifeHint,
    ageHint,
    physicalHint,
    windowInstruction,
    sleepInstruction,
    coachPromptBlockForEmotionalStage(emotionalRouting ?? null, locale),
    MORNING_RITUAL_ADAPTATION_PROMPT_BLOCK,
    MOOD_STRATEGY_PROMPT_BLOCK,
    EVENING_BRIEFING_PROMPT_BLOCK,
    OVERPLANNING_PROMPT_BLOCK,
    SKIP_WINDOWS_PROMPT_BLOCK,
    FAILED_ACTION_PATTERNS_PROMPT_BLOCK,
    AI_PERSONALIZATION_PROMPT_BLOCK,
    '- energy 4-6 (medium): easy or medium difficulty only, max 15 minutes.',
    '- energy 7-10 (high): any difficulty up to 20 minutes.',
    '',
    'Rules:',
    '- Generate EXACTLY max_steps from the payload — never exceed it.',
    ADAPTIVE_TASK_COUNT_HINT,
    DIFFICULTY_CALIBRATION_HINT,
    '- Each step must be concrete, specific, and immediately actionable.',
    '- Each step must take 5 to 20 minutes (respect personal_difficulty.max_minutes when set).',
    '- Prefer consistency over intensity.',
    '- Adapt to skipped tasks and low energy.',
    '- Do not shame the user.',
    '- Prefer behavior over vague advice.',
    '',
    STEP_CONTRACT_PROMPT_BLOCK,
    '',
    STEP_REASONING_PROMPT_BLOCK,
    '',
    VALUE_GATE_PROMPT_BLOCK,
    '',
    NO_FLUFF_PROMPT_BLOCK,
    '',
    STEP_VALUE_FEEDBACK_PROMPT_BLOCK,
    '',
    ACTION_PATTERNS_PROMPT_BLOCK,
    '',
    challengePromptBlock(locale),
    '',
    habitTriggerPromptBlock(locale),
    '',
    barrierPlanBPromptBlock(locale),
    '',
    loadAdaptationPromptBlock(locale),
    '',
    accountabilityPromptBlock(locale),
    '',
    REAL_LIFE_ALIGNMENT_PROMPT_BLOCK,
    '',
    SKIP_ADAPTATION_PROMPT_BLOCK,
    '',
    '## Goal decomposition tree (CRITICAL):',
    '- Tree: Goal → 30/60/90 milestone → weekly_focus → today\'s step.',
    '- When active_goals include decomposition.weekly_focus, derive steps FROM that focus — do NOT invent unrelated themes.',
    '- Each step must advance weekly_focus.focus_title and today_theme.',
    '- Set goal_id to the matching goal; reasoning must echo progress_cue.',
    '- Rotate through weekly_themes; pick today_theme not covered in recent steps this week.',
    '',
    '## Morning mission sync:',
    '- If morning_mission is present, at least one step should directly support it or clearly explain why a smaller substitute is safer today.',
    '- Treat morning_mission as today’s explicit user intention, unless latest_morning_ritual/evening_briefing indicates low energy or a conflict.',
    '',
    '## Health-specific rules:',
    '- If the user has been skipping health tasks, shrink the next task to 2-5 minutes.',
    '- Anchor health tasks using health_context.anchor when present.',
    '- If energy score is low (1-4), suggest restorative tasks aligned with their health category.',
    '- Never suggest more than 20 minutes for a single health task.',
    '',
    '## Behavior profile adaptation:',
    BEHAVIOR_PROFILE_SYSTEM_HINT,
    '',
    '## Execution history:',
    EXECUTION_HISTORY_HINT,
    '',
    '## Coach memory:',
    SHORT_TERM_MEMORY_HINT,
    LONG_TERM_MEMORY_HINT,
  ];

  if (focusedHealthPlan) {
    lines.push(
      '- The user has an execution_plan: stay within current_phase focus and category. Do NOT suggest unrelated movement if their goal is nutrition or weight gain.'
    );
  } else {
    lines.push('- Vary tasks only when multiple unrelated health goals exist.');
  }

  lines.push('', '- Return only valid JSON.');
  return lines.filter(Boolean).join('\n');
}

export function buildDailyStepsUserPrompt(input: {
  locale: AppLocale;
  date: string;
  domainStates: LifeDomainState[];
  activeGoals: Goal[];
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  milestonesByGoalId?: Record<string, Milestone[]>;
  weeklyFocusByGoalId?: Record<string, WeeklyGoalFocus>;
  wake_time?: string;
  sleep_time?: string;
  coaching_style?: string;
  preferred_tone?: string;
  avoid_tone?: string;
  life_context_statuses?: LifeContextStatus[];
  life_context_note?: string | null;
  physical_considerations?: PhysicalConsideration[];
  preferred_action_window?: PreferredActionWindow;
  user_behavior_profile?: UserBehaviorProfile | null;
  tone_personalization?: ReturnType<typeof import('@/lib/coach-tone').tonePersonalizationForPrompt>;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
  max_steps?: number;
  easy_only?: boolean;
  task_count_reason?: AdaptiveTaskCountReason;
  difficulty_calibration?: PersonalDifficultyCalibration | null;
  latest_morning_ritual?: RitualAdaptationContext | null;
  morning_mission?: {
    mission: string;
    identity: string | null;
    time_block: string | null;
    suggested_domain: LifeDomain | null;
  } | null;
  evening_briefing?: EveningBriefingForTomorrow | null;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  overplanning?: OverplanningContext | null;
  personalized_challenge?: PersonalizedChallenge | null;
  habit_trigger?: HabitTriggerContext | null;
  plan_b_strategy?: BarrierPlanBStrategy | null;
  load_adaptation?: LoadAdaptationContext | null;
  accountability?: AccountabilityContext | null;
  real_life_alignment?: RealLifeAlignmentContext | null;
  skip_adaptation?: Record<string, unknown> | null;
  emotional_routing?: EmotionalStageRouting | null;
  domain_rivalry?: import('@/lib/gamification/domain-rivalry').DomainRivalrySnapshot | null;
  weekly_review_context?: import('@/lib/life-coach/weekly-review-context').WeeklyReviewContext | null;
}) {
  const lifeContext = lifeContextForPrompt(input.life_context_statuses, input.locale);
  const contextNote = input.life_context_note?.trim() || null;
  const goalsEnriched = input.activeGoals.map((goal) => {
    const dayIndex =
      goal.domain === 'health' && goal.health_context?.execution_plan
        ? goalDayIndex(goal.created_at, input.date)
        : null;
    const phase =
      goal.health_context?.execution_plan && dayIndex
        ? findPhaseForDay(goal.health_context.execution_plan, dayIndex)
        : null;

    const milestones = input.milestonesByGoalId?.[goal.id] ?? [];
    const weeklyFocus = input.weeklyFocusByGoalId?.[goal.id] ?? null;
    const milestoneCtx = resolveActiveMilestone(goal, milestones, input.date);
    const todayTheme = weeklyFocus
      ? pickWeeklyThemeForDate(weeklyFocus.weekly_themes, input.date)
      : null;

    return {
      ...goal,
      milestones,
      plan_day_index: dayIndex,
      current_phase: phase
        ? { focus: phase.focus, start_day: phase.start_day, end_day: phase.end_day }
        : null,
      decomposition: {
        day_index: milestoneCtx.day_index,
        active_milestone: milestoneCtx.milestone_title,
        active_day_marker: milestoneCtx.day_marker,
        weekly_focus: weeklyFocus
          ? {
              focus_title: weeklyFocus.focus_title,
              focus_description: weeklyFocus.focus_description,
              weekly_themes: weeklyFocus.weekly_themes,
              progress_cue: weeklyFocus.progress_cue,
              today_theme: todayTheme,
            }
          : null,
      },
    };
  });

  const focusedHealthPlan = input.activeGoals.some(
    (g) => g.domain === 'health' && g.health_context?.execution_plan
  );

  const actionPatternToolbox = buildActionPatternToolbox({
    locale: input.locale,
    activeGoals: input.activeGoals.map((g) => ({
      id: g.id,
      domain: g.domain,
      title: g.title,
    })),
    domainStates: input.domainStates,
    recurringBlockers: input.recurring_blocker_patterns,
    recentReflections: input.recentReflections,
    executionHistory: input.execution_history,
  });

  return JSON.stringify(
    {
      date: input.date,
      max_steps: input.max_steps ?? 2,
      easy_only: input.easy_only ?? false,
      task_count_reason: input.task_count_reason ?? 'default',
      latest_morning_ritual: ritualAdaptationForPrompt(input.latest_morning_ritual),
      morning_mission: input.morning_mission ?? null,
      evening_briefing: eveningBriefingForPrompt(input.evening_briefing),
      ai_personalization_summary: aiPersonalizationSummaryForPrompt(
        input.ai_personalization_summary
      ),
      overplanning: overplanningForPrompt(input.overplanning),
      personal_difficulty: calibrationForPrompt(input.difficulty_calibration),
      domain_states: input.domainStates,
      active_goals: goalsEnriched,
      execution_history: executionHistoryForPrompt(input.execution_history),
      step_value_feedback: stepValueFeedbackForPrompt(
        input.execution_history?.step_value_feedback ?? null
      ),
      short_term_context: shortTermContextForPrompt(input.short_term_context),
      long_term_profile: longTermProfileForPrompt(input.long_term_profile),
      recent_reflections_compact: input.recentReflections.slice(0, 7).map((r) => ({
        date: r.date,
        blocker_reason: r.blocker_reason,
        energy_score: r.energy_score,
        mood_score: r.mood_score,
      })),
      user_behavior_profile: behaviorProfileForPrompt(input.user_behavior_profile ?? null),
      recurring_blocker_patterns: recurringBlockerPatternsForPrompt(
        input.recurring_blocker_patterns ?? []
      ),
      action_pattern_toolbox: actionPatternToolbox,
      personalized_challenge: personalizedChallengeForPrompt(input.personalized_challenge ?? null),
      habit_trigger: habitTriggerForPrompt(input.habit_trigger ?? null),
      plan_b_strategy: barrierPlanBForPrompt(input.plan_b_strategy ?? null),
      load_adaptation: loadAdaptationForPrompt(input.load_adaptation ?? null),
      accountability: accountabilityForPrompt(input.accountability ?? null),
      real_life_alignment: realLifeAlignmentForPrompt(input.real_life_alignment ?? null),
      skip_adaptation: input.skip_adaptation ?? null,
      emotional_routing: input.emotional_routing
        ? emotionalStageForPrompt(input.emotional_routing)
        : null,
      domain_rivalry: input.domain_rivalry ?? null,
      weekly_review_context: input.weekly_review_context ?? null,
      life_context_statuses: lifeContext.statuses,
      life_context_labels: lifeContext.labels,
      life_context_note: contextNote,
      preferred_tone: input.preferred_tone ?? null,
      avoid_tone: input.avoid_tone ?? null,
      tone_personalization: input.tone_personalization ?? null,
      _meta: {
        focused_health_plan: focusedHealthPlan,
        wake_time: input.wake_time ?? '07:00',
        sleep_time: input.sleep_time ?? '22:30',
        coaching_style: input.coaching_style ?? 'supportive',
        physical_considerations: input.physical_considerations ?? [],
        preferred_action_window: input.preferred_action_window ?? 'flexible',
      },
    },
    null,
    2
  );
}

export function hasFocusedHealthPlan(goals: Goal[]): boolean {
  return goals.some((g) => g.domain === 'health' && g.health_context?.execution_plan);
}

export function buildReflectionAnalysisSystemPrompt(
  locale: AppLocale,
  lifeContextStatuses: LifeContextStatus[] = []
) {
  const lifeHint = buildLifeContextAdaptationHint(lifeContextStatuses, locale);
  return [
    'You analyze execution patterns.',
    languageInstruction[locale],
    'Identify why the user is not completing tasks and suggest practical adjustments.',
    'Do not be generic.',
    'Do not over-motivate.',
    'Never shame the user.',
    '## Reflection analysis contract (REQUIRED fields):',
    '- primary_emotion: dominant feeling (e.g. overwhelmed, depleted, resistant)',
    '- trigger: situational cause (e.g. family chaos, low energy, unclear task)',
    '- blocker: execution friction in plain language',
    '- need: what the user needs next (e.g. smaller plan, concrete first move)',
    '- recommended_adjustment: one sentence for tomorrow (e.g. one 2-minute step tomorrow)',
    '- risk_signal: low | medium | high',
    '- next_day_adjustments: { max_tasks, max_minutes_per_task, easy_only }',
    'If risk_signal is high, cap max_tasks to 1 and set easy_only true.',
    'Example: emotion=overwhelmed, trigger=family chaos, need=smaller plan, adjustment=one 2-minute step tomorrow.',
    lifeHint,
    BEHAVIOR_PROFILE_SYSTEM_HINT,
    RECURRING_BLOCKER_HINT,
    EXECUTION_HISTORY_HINT,
    SHORT_TERM_MEMORY_HINT,
    LONG_TERM_MEMORY_HINT,
    '',
    NEXT_BEST_ACTION_PROMPT_BLOCK,
    'Return only valid JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildReflectionAnalysisUserPrompt(input: {
  locale: AppLocale;
  date: string;
  blocker_reason: ReflectionBlockerReason | null;
  reflection_text: string | null;
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  life_context_statuses?: LifeContextStatus[];
  user_behavior_profile?: UserBehaviorProfile | null;
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
}) {
  const lifeContext = lifeContextForPrompt(input.life_context_statuses, input.locale);
  return JSON.stringify(
    {
      date: input.date,
      blocker_reason: input.blocker_reason,
      reflection_text: input.reflection_text,
      execution_history: executionHistoryForPrompt(input.execution_history),
      short_term_context: shortTermContextForPrompt(input.short_term_context),
      long_term_profile: longTermProfileForPrompt(input.long_term_profile),
      user_behavior_profile: behaviorProfileForPrompt(input.user_behavior_profile ?? null),
      life_context_statuses: lifeContext.statuses,
      life_context_labels: lifeContext.labels,
    },
    null,
    2
  );
}

export function buildWeeklyReviewSystemPrompt(
  locale: AppLocale,
  lifeContextStatuses: LifeContextStatus[] = [],
  coachingStyle = 'supportive',
  preferredTone?: string,
  avoidTone?: string
) {
  const lifeHint = buildLifeContextAdaptationHint(lifeContextStatuses, locale);
  return [
    'You generate a short weekly review for a life coaching app inspired by Tony Robbins.',
    languageInstruction[locale],
    buildToneInstruction(coachingStyle, preferredTone, avoidTone),
    'Be practical, concise, and motivating without being generic.',
    'Summarize completed steps, strongest and weakest domain, main blocker, and one adjustment for next week.',
    lifeHint,
    '',
    '## Moment of Truth approach:',
    '- Compare what the user PLANNED to do vs what they ACTUALLY did.',
    '- If there is a gap, provide a positive reframe in Tony Robbins style (not guilt).',
    '- When life_context_labels are provided, reframe missed steps as understandable given their life situation — not failure.',
    '- Highlight the smallest win of the week and amplify it.',
    '- Suggest one specific, concrete adjustment for next week (not a vague platitude).',
    '- pattern_mining contains computed correlations — treat as ground truth for recommendations.',
    '- Echo pattern_insights in summary when relevant; align recommended_adjustment with plan_adjustments.',
    '- If this is the first or second week with minimal data, still provide a useful review based on whatever data exists.',
    '- Never say "not enough data" — always find something actionable.',
    '',
    '## Emotional Reflection Layer (required):',
    '- Add emotional_reflection that translates week_execution into a short personal identity story.',
    '- Do NOT repeat summary statistics or domain_progress counts in emotional_reflection.',
    '- identity_proof: what the user proved to themselves this week (concrete behavior evidence).',
    '- comeback_evidence: where they returned to the path after difficulty — cite specific days, blockers, or step titles when present.',
    '- meaning_statement: 2-4 sentences connecting imperfect progress to identity (Tony Robbins reframe, never guilt).',
    '- confidence_builder: echo one identity_phrase or reflection theme with new meaning from this week.',
    '- next_identity_action: one tiny next step that reinforces the emerging identity (not a new goal).',
    '- Be specific, warm, personal, non-generic. Use week_execution and identity_phrases as ground truth.',
    '',
    RECURRING_PATTERN_PROMPT_BLOCK,
    '',
    loadAdaptationWeeklyPromptBlock(locale),
    '',
    accountabilityWeeklyPromptBlock(locale),
    '',
    behaviorChangePromptBlock(locale),
    '',
    PROGRESS_EVIDENCE_PROMPT_BLOCK,
    '',
    BEHAVIOR_PROFILE_SYSTEM_HINT,
    RECURRING_BLOCKER_HINT,
    EXECUTION_HISTORY_HINT,
    SHORT_TERM_MEMORY_HINT,
    LONG_TERM_MEMORY_HINT,
    AI_PERSONALIZATION_PROMPT_BLOCK,
    '',
    NEXT_BEST_ACTION_PROMPT_BLOCK,
    'Return only valid JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWeeklyReviewUserPrompt(input: {
  locale: AppLocale;
  period_start: string;
  period_end: string;
  domainStates: LifeDomainState[];
  activeGoals: Goal[];
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  life_context_statuses?: LifeContextStatus[];
  user_behavior_profile?: UserBehaviorProfile | null;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
  pattern_mining?: import('@/lib/life-coach/types').WeeklyPatternMining | null;
  week_execution?: import('@/lib/life-coach/weekly-review-emotional').WeeklyExecutionSnapshot;
  identity_phrases?: string[];
  coaching_style?: string;
  preferred_tone?: string;
  avoid_tone?: string;
  tone_personalization?: ReturnType<typeof import('@/lib/coach-tone').tonePersonalizationForPrompt>;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  load_adaptation?: LoadAdaptationContext | null;
  accountability?: AccountabilityContext | null;
  behavior_change?: BehaviorChangeContext | null;
  behavior_change_analysis?: WeekBehaviorChangeAnalysis | null;
  morning_ritual_summary?: import('@/lib/life-coach/morning-ritual-weekly-summary').MorningRitualWeeklySummary | null;
  checkin_weekly_summary?: import('@/lib/life-coach/checkin-weekly-summary').CheckinWeeklySummary | null;
  step_value_feedback_summary?: import('@/lib/step-value-feedback/summarize').StepValueFeedbackSummary | null;
  reflection_loot_summary?: {count: number; dominant_loot_type: string | null} | null;
}) {
  const lifeContext = lifeContextForPrompt(input.life_context_statuses, input.locale);
  return JSON.stringify(
    {
      period_start: input.period_start,
      period_end: input.period_end,
      domain_states: input.domainStates,
      active_goals: input.activeGoals.map((goal) => ({
        id: goal.id,
        domain: goal.domain,
        title: goal.title,
        description: goal.description,
        success_metric: goal.success_metric,
        why_important: goal.health_context?.why_deep?.why_important ?? null,
        why_now: goal.health_context?.why_deep?.why_now ?? null,
      })),
      week_execution: input.week_execution ?? null,
      identity_phrases: input.identity_phrases ?? [],
      execution_history: executionHistoryForPrompt(input.execution_history),
      short_term_context: shortTermContextForPrompt(input.short_term_context),
      long_term_profile: longTermProfileForPrompt(input.long_term_profile),
      recent_reflections_compact: input.recentReflections.slice(0, 7).map((r) => ({
        date: r.date,
        blocker_reason: r.blocker_reason,
        energy_score: r.energy_score,
        mood_score: r.mood_score,
        reflection_excerpt: r.reflection_text?.trim().slice(0, 160) ?? null,
        primary_emotion: r.analysis?.primary_emotion ?? null,
      })),
      user_behavior_profile: behaviorProfileForPrompt(input.user_behavior_profile ?? null),
      recurring_blocker_patterns: recurringBlockerPatternsForPrompt(
        input.recurring_blocker_patterns ?? []
      ),
      life_context_statuses: lifeContext.statuses,
      life_context_labels: lifeContext.labels,
      pattern_mining: input.pattern_mining ?? null,
      pattern_insights: input.pattern_mining?.insights ?? [],
      plan_adjustments: input.pattern_mining?.plan_adjustments ?? null,
      coaching_style: input.coaching_style ?? 'supportive',
      preferred_tone: input.preferred_tone ?? null,
      avoid_tone: input.avoid_tone ?? null,
      tone_personalization: input.tone_personalization ?? null,
      ai_personalization_summary: aiPersonalizationSummaryForPrompt(
        input.ai_personalization_summary
      ),
      load_adaptation: loadAdaptationForPrompt(input.load_adaptation ?? null),
      accountability: accountabilityForPrompt(input.accountability ?? null),
      behavior_change: behaviorChangeForPrompt(
        input.behavior_change ?? null,
        input.behavior_change_analysis ?? null
      ),
      morning_ritual_summary: input.morning_ritual_summary ?? null,
      checkin_weekly_summary: input.checkin_weekly_summary ?? null,
      step_value_feedback: input.step_value_feedback_summary ?? null,
      reflection_loot_summary: input.reflection_loot_summary ?? null,
    },
    null,
    2
  );
}

export function buildSkipRecoverySystemPrompt(locale: AppLocale) {
  return [
    'You rewrite a skipped daily baby step into a lighter 3-minute version the user can finish today.',
    languageInstruction[locale],
    'Return JSON only: { title, description, estimated_minutes, difficulty }.',
    'Rules:',
    '- estimated_minutes MUST be 3.',
    '- difficulty MUST be "easy".',
    '- Keep the same intent as the original step — do not invent a new goal.',
    '- Title: short, concrete, starts with "3 min:" (en) or "3 דק׳:" (he).',
    '- Description: one clear deliverable the user can finish in 3 minutes — no vague advice.',
    '- If a blocker is provided, address it (shorter, clearer first move).',
  ].join('\n');
}

export function buildSkipRecoveryUserPrompt(input: {
  locale: AppLocale;
  step: Pick<DailyBabyStep, 'title' | 'description' | 'estimated_minutes' | 'difficulty' | 'domain'>;
  blocker_reason?: ReflectionBlockerReason | null;
}) {
  return JSON.stringify(
    {
      original_step: {
        title: input.step.title,
        description: input.step.description,
        estimated_minutes: input.step.estimated_minutes,
        difficulty: input.step.difficulty,
        domain: input.step.domain,
      },
      blocker_reason: input.blocker_reason ?? null,
      target_minutes: 3,
    },
    null,
    2
  );
}
