import type {AppLocale} from '@/i18n/config';
import {resolveGenderedDeep} from '@/lib/gendered-copy';
import {
  buildEmotionalStageRouting,
  selectMindsetBlockerForEmotionalStage,
} from '@/lib/formulation/emotional-stage-routing';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import type {FormulationSession} from '@/lib/life-coach/types';

/** Active psychological blocker the mindset exercise should address. */
export type MindsetBlockerKind = 'self_criticism' | 'avoidance' | 'low_control' | 'guilt';

export type MindsetExercise = {
  id: string;
  target_blocker: MindsetBlockerKind;
  title: string;
  instructions: string;
  /** Internal: which barrier this exercise is meant to reduce. */
  why_this_exercise: string;
  suggested_micro_goal_week: string;
};

export type CentralBlockerDetection = {
  dominant_blocker: MindsetBlockerKind | null;
  scores: Array<{blocker: MindsetBlockerKind; weight: number}>;
  signals_used: string[];
};

type ExerciseCopy = Omit<MindsetExercise, 'id' | 'target_blocker'>;

const EXERCISES: Record<MindsetBlockerKind, {id: string; he: ExerciseCopy; en: ExerciseCopy}> = {
  self_criticism: {
    id: 'fact_vs_story',
    he: {
      title: 'הפרדה בין עובדה לפרשנות',
      instructions:
        'פעם השבוע — בחר/י מצב אחד שמכביד. כתוב/י שתי עמודות: «מה קרה בפועל» ו«מה אמרתי לעצמי על זה». סיים/י במשפט אחד שמפריד ביניהם.',
      why_this_exercise: 'מפחית ביקורת עצמית קוטלנית — מפריד בין מה שקרה לבין הפרשנות.',
      suggested_micro_goal_week:
        'פעם השבוע — לכתוב מצב אחד בשתי עמודות: עובדה מול פרשנות, ולסיים במשפט שמפריד ביניהם',
    },
    en: {
      title: 'Separate fact from story',
      instructions:
        'Once this week — pick one heavy moment. Write two columns: "what actually happened" and "what I told myself about it". End with one sentence that separates them.',
      why_this_exercise: 'Reduces harsh self-criticism by separating what happened from your interpretation.',
      suggested_micro_goal_week:
        'Once this week — write one situation in two columns: fact vs interpretation, ending with one separating sentence',
    },
  },
  avoidance: {
    id: 'small_avoided_step',
    he: {
      title: 'הצעד הקטן שאני נמנע/ת ממנו',
      instructions:
        'פעם השבוע — זהה/י צעד אחד קטן שדוחים (הודעה, שיחה, משימה). כתוב/י אותו במשפט אחד ובצע/י גרסה של 10 דקות בלבד.',
      why_this_exercise: 'מפחית הימנעות — מזהה ומקטין את הצעד שדוחים.',
      suggested_micro_goal_week:
        'פעם השבוע — לזהות צעד קטן שדוחים, לכתוב אותו במשפט, ולבצע גרסה של 10 דקות',
    },
    en: {
      title: 'The small step I keep avoiding',
      instructions:
        'Once this week — name one small step you keep putting off (message, conversation, task). Write it in one sentence and do a 10-minute version only.',
      why_this_exercise: 'Reduces avoidance by naming and shrinking the step you keep postponing.',
      suggested_micro_goal_week:
        'Once this week — name one avoided step in one sentence and do a 10-minute version',
    },
  },
  low_control: {
    id: 'three_in_control',
    he: {
      title: '3 דברים בשליטתי היום',
      instructions:
        '3 פעמים השבוע — בבוקר כתוב/י 3 דברים שבשליטתך היום (גם קטנים). בחר/י אחד ובצע/י פעולה של 5 דקות.',
      why_this_exercise: 'מחזק תחושת שליטה כשמרגיש/ה שאין שליטה על מה שקורה.',
      suggested_micro_goal_week:
        '3 פעמים השבוע — לכתוב 3 דברים בשליטתך היום ולבצע פעולה קטנה על אחד מהם',
    },
    en: {
      title: '3 things in my control today',
      instructions:
        '3 times this week — each morning list 3 things in your control today (even small ones). Pick one and take a 5-minute action.',
      why_this_exercise: 'Strengthens sense of control when things feel out of your hands.',
      suggested_micro_goal_week:
        '3 times this week — list 3 things in your control today and take one small action on one of them',
    },
  },
  guilt: {
    id: 'self_compassion_brief',
    he: {
      title: 'חמלה עצמית קצרה',
      instructions:
        'פעם השבוע — כשעולה אשמה, כתוב/י: «מה הייתי אומר/ת לחבר/ה טוב/ה באותו מצב?» קרא/י את זה בקול רגוע.',
      why_this_exercise: 'מפחית אשמה ומעמיסות מחזקת — מחליף ביקורת עצמית בקול תומך.',
      suggested_micro_goal_week:
        'פעם השבוע — כשעולה אשמה, לכתוב מה היית אומר/ת לחבר/ה טוב/ה ולקרוא בקול רגוע',
    },
    en: {
      title: 'Brief self-compassion',
      instructions:
        'Once this week — when guilt shows up, write: "What would I say to a good friend in this situation?" Read it aloud in a calm voice.',
      why_this_exercise: 'Reduces guilt and self-punishing loops — swaps self-attack for a supportive voice.',
      suggested_micro_goal_week:
        'Once this week — when guilt shows up, write what you would tell a good friend and read it calmly',
    },
  },
};

const BLOCKER_PRIORITY: MindsetBlockerKind[] = [
  'guilt',
  'self_criticism',
  'avoidance',
  'low_control',
];

function ratingDistress(session: FormulationSession, key: string): number {
  const rating = session.passive_ratings.find((r) => r.key === key);
  return rating ? distressWeight(rating.key, rating.score) : 0;
}

function guiltInText(text: string, locale: AppLocale): boolean {
  const re = locale === 'he' ? /אשמה|אשם|מאשים|אשמת/i : /\bguilt\b|guilty|blaming myself/i;
  return re.test(text);
}

function chipBoostsBlocker(
  session: FormulationSession,
  sourceKey: string,
  locale: AppLocale
): number {
  let boost = 0;
  for (const answer of session.prior_question_answers) {
    const meta = session.rating_follow_ups.find((f) => f.key === answer.key);
    if (meta?.source_rating_key !== sourceKey) continue;
    if (/(very|מאוד|הרבה|quite|somewhat|קצת|moderately|moderate|בינוני)/i.test(answer.answer)) {
      boost += 1;
    }
    if (/(not at all|בכלל לא|hardly|hardly ever)/i.test(answer.answer) && sourceKey === 'sense_of_control') {
      boost += 2;
    }
  }
  return boost;
}

/** Score active blockers from ratings, synthesis, formulation, and handoff text. */
export function detectCentralBlocker(
  session: FormulationSession,
  locale: AppLocale
): CentralBlockerDetection {
  const insights = buildFormulationInsights(session, locale);
  const scores = new Map<MindsetBlockerKind, number>();
  const signals: string[] = [];

  const add = (blocker: MindsetBlockerKind, weight: number, signal: string) => {
    if (weight <= 0) return;
    scores.set(blocker, (scores.get(blocker) ?? 0) + weight);
    signals.push(signal);
  };

  const selfCrit = ratingDistress(session, 'self_criticism');
  if (selfCrit >= 4) add('self_criticism', selfCrit, 'passive_ratings.self_criticism');
  add(
    'self_criticism',
    chipBoostsBlocker(session, 'self_criticism', locale),
    'prior_question_answers.self_criticism'
  );
  if (insights.burning_now_themes.some((t) => t.id === 'self_criticism')) {
    add('self_criticism', 2, 'burning_now_themes.self_criticism');
  }

  const avoidance = ratingDistress(session, 'avoidance');
  if (avoidance >= 4) add('avoidance', avoidance, 'passive_ratings.avoidance');
  add('avoidance', chipBoostsBlocker(session, 'avoidance', locale), 'prior_question_answers.avoidance');
  if (insights.burning_now_themes.some((t) => t.id === 'avoidance')) {
    add('avoidance', 2, 'burning_now_themes.avoidance');
  }

  const lowControl = ratingDistress(session, 'sense_of_control');
  if (lowControl >= 4) add('low_control', lowControl, 'passive_ratings.sense_of_control');
  add(
    'low_control',
    chipBoostsBlocker(session, 'sense_of_control', locale),
    'prior_question_answers.sense_of_control'
  );
  if (insights.burning_now_themes.some((t) => t.id === 'sense_of_control')) {
    add('low_control', 2, 'burning_now_themes.sense_of_control');
  }

  const maintaining = session.formulation_approved?.maintaining_factors ?? [];
  if (maintaining.some((f) => guiltInText(f, locale))) {
    add('guilt', 5, 'formulation_approved.maintaining_factors.guilt');
  }

  const barrierBlob = [
    session.coach_handoff?.anticipated_barrier,
    session.formulation_approved?.presenting_concern_user_words,
  ]
    .filter(Boolean)
    .join(' ');
  if (guiltInText(barrierBlob, locale)) {
    add('guilt', 2, 'anticipated_barrier.guilt');
  }
  if (/avoid|הימנע|דחי|procrastin/i.test(barrierBlob)) {
    add('avoidance', 1, 'anticipated_barrier.avoidance');
  }
  if (/critici|ביקורת|self.?attack|קוטל/i.test(barrierBlob)) {
    add('self_criticism', 1, 'anticipated_barrier.self_criticism');
  }
  if (/control|שליטה|helpless|חסר.?שליט/i.test(barrierBlob)) {
    add('low_control', 1, 'anticipated_barrier.low_control');
  }

  const ranked = [...scores.entries()]
    .map(([blocker, weight]) => ({blocker, weight}))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return BLOCKER_PRIORITY.indexOf(a.blocker) - BLOCKER_PRIORITY.indexOf(b.blocker);
    });

  return {
    dominant_blocker: ranked[0]?.blocker ?? null,
    scores: ranked,
    signals_used: signals,
  };
}

function getMindsetExercise(
  blocker: MindsetBlockerKind,
  locale: AppLocale,
  gender?: string | null
): MindsetExercise {
  const entry = EXERCISES[blocker];
  const copy =
    locale === 'he' ? resolveGenderedDeep(entry.he, gender) : entry.en;
  return {
    id: entry.id,
    target_blocker: blocker,
    ...copy,
  };
}

/** Pick the mindset exercise that best matches the user's active blocker. */
export function selectMindsetExercise(
  session: FormulationSession,
  locale: AppLocale
): MindsetExercise {
  const detection = detectCentralBlocker(session, locale);
  const routing = buildEmotionalStageRouting(session, locale);
  const blocker =
    selectMindsetBlockerForEmotionalStage(detection.scores, routing) ??
    detection.dominant_blocker ??
    'low_control';
  return getMindsetExercise(blocker, locale, session.participant_gender);
}

/** Compact payload for micro-goal LLM context. */
export function buildMindsetExerciseRecommendation(
  session: FormulationSession,
  locale: AppLocale
) {
  const detection = detectCentralBlocker(session, locale);
  const routing = buildEmotionalStageRouting(session, locale);
  const exercise = selectMindsetExercise(session, locale);
  const selectedBlocker =
    selectMindsetBlockerForEmotionalStage(detection.scores, routing) ??
    detection.dominant_blocker;

  return {
    central_blocker: selectedBlocker,
    emotional_stage_profile: routing.content_profile,
    clarity_over_action: routing.clarity_over_action,
    strengths_signal: routing.strengths_signal,
    blocker_scores: detection.scores,
    signals_used: detection.signals_used,
    recommended_exercise: {
      id: exercise.id,
      target_blocker: exercise.target_blocker,
      title: exercise.title,
      instructions: exercise.instructions,
      why_this_exercise: exercise.why_this_exercise,
      suggested_micro_goal_week: exercise.suggested_micro_goal_week,
    },
  };
}
