import type {AppLocale} from '@/i18n/config';
import {resolveGenderedDeep, resolveParticipantGender} from '@/lib/gendered-copy';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import type {BreathingType} from '@/lib/morning-ritual-types';
import type {
  FormulationSession,
  LifeContextStatus,
  RiskLevel,
} from '@/lib/life-coach/types';

type MeditationType =
  | 'body_scan_release'
  | 'breath_ground'
  | 'focus_short'
  | 'self_compassion_meaning'
  | 'gentle_presence';

export type MeditationRecommendation = {
  meditation_type: MeditationType;
  title: string;
  instructions: string;
  why_this_meditation: string;
  pain_served: string;
  breathing_type: BreathingType;
  duration_minutes: number;
  avoid_deep_content: boolean;
  max_rounds: {quick: number; standard: number; deep: number};
  signals_used: string[];
  phase_guidance: {
    prepare: string;
    inhale: string[];
    hold: string[];
    exhale: string[];
    complete: string;
  };
};

type NeedScores = Record<
  Exclude<MeditationType, 'gentle_presence'>,
  {score: number; signals: string[]}
>;

function ratingDistress(session: FormulationSession, key: string): number {
  const rating = session.passive_ratings.find((r) => r.key === key);
  return rating ? distressWeight(rating.key, rating.score) : 0;
}

function blob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function stressorBoost(stressors: string[], pattern: RegExp, signal: string, base = 0): number {
  if (!stressors.some((s) => pattern.test(s))) return base;
  return base + 2;
}

function scoreMeditationNeeds(session: FormulationSession): NeedScores {
  const mindBody = session.dimensions?.mind_body ?? {};
  const stressors = session.formulation_approved?.stressors ?? [];
  const maintaining = session.formulation_approved?.maintaining_factors ?? [];

  const bodySignals: string[] = [];
  let bodyScore = 0;
  if (mindBody.body_tension) {
    bodyScore += 5;
    bodySignals.push('dimensions.mind_body.body_tension');
  }
  const bodyRating = ratingDistress(session, 'body_tension');
  if (bodyRating >= 3) {
    bodyScore += bodyRating;
    bodySignals.push('passive_ratings.body_tension');
  }
  if ([...stressors, ...maintaining].some((s) => /מתח|tension|כואב|pain|גוף|body|צוואר|neck|shoulder/i.test(s))) {
    bodyScore += 2;
    bodySignals.push('stressors.body');
  }

  const worrySignals: string[] = [];
  let worryScore = 0;
  for (const key of ['worry_load', 'student_exam_anxiety'] as const) {
    const w = ratingDistress(session, key);
    if (w >= 3) {
      worryScore += w;
      worrySignals.push(`passive_ratings.${key}`);
    }
  }
  worryScore += stressorBoost(
    [...stressors, ...maintaining, session.presenting_concern_user_words].filter(
      (s): s is string => !!s
    ),
    /דאג|worry|anxiet|חרד|stress|לחץ/i,
    'stressors.worry'
  );
  if (worryScore >= 2 && !worrySignals.includes('stressors.worry') && worrySignals.length === 0) {
    worrySignals.push('stressors.worry');
  }

  const focusSignals: string[] = [];
  let focusScore = ratingDistress(session, 'focus');
  if (focusScore >= 3) {
    focusSignals.push('passive_ratings.focus');
  }
  focusScore += stressorBoost(
    [...stressors, ...maintaining],
    /focus|פוקוס|concentrat|מוסח|distract/i,
    'stressors.focus'
  );
  if (focusScore >= 3 && !focusSignals.includes('stressors.focus')) {
    focusSignals.push('stressors.focus');
  }

  const moodSignals: string[] = [];
  let moodScore = 0;
  for (const key of ['low_mood', 'self_criticism'] as const) {
    const w = ratingDistress(session, key);
    if (w >= 3) {
      moodScore += w;
      moodSignals.push(`passive_ratings.${key}`);
    }
  }
  moodScore += stressorBoost(
    [...stressors, ...maintaining],
    /עצב|mood|depress|קוטל|hopeless|מדוכא/i,
    'stressors.mood'
  );
  if (moodScore >= 3 && moodSignals.length === 0) {
    moodSignals.push('stressors.mood');
  }

  return {
    body_scan_release: {score: bodyScore, signals: bodySignals},
    breath_ground: {score: worryScore, signals: worrySignals},
    focus_short: {score: focusScore, signals: focusSignals},
    self_compassion_meaning: {score: moodScore, signals: moodSignals},
  };
}

function riskLevel(session: FormulationSession): RiskLevel | null {
  return (
    session.formulation_approved?.risk_screen?.level ??
    session.risk_level ??
    null
  );
}

function lifeContextNote(statuses: LifeContextStatus[]): string | null {
  if (statuses.includes('new_parent')) return 'new_parent';
  if (statuses.includes('caregiver')) return 'caregiver';
  return null;
}

const MEDITATION_COPY: Record<
  MeditationType,
  {he: Omit<MeditationRecommendation, 'meditation_type' | 'signals_used'>; en: Omit<MeditationRecommendation, 'meditation_type' | 'signals_used'>}
> = {
  body_scan_release: {
    he: {
      title: 'סריקת גוף — שחרור',
      instructions: '3–5 דקות: עבור/י מהכתפיים למטה. איפה יש מתח — נשימה שם, בלי לתקן.',
      why_this_meditation: 'יש מתח בגוף בנתונים — לא wellness גנרי, אלא שחרור של מה שנאסף.',
      pain_served: 'מתח גופני / body_tension',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 5},
      phase_guidance: {
        prepare: 'עמוד/י או שב/י. שים/י יד על המקום הכי מתוח.',
        inhale: ['שאף/י למקום המתוח.', 'הכנס/י אוויר לאזור שכואב.', 'נשימה אל הכתפיים / הגב.'],
        hold: ['החזק/י — רק תרגיש/י.', 'אין צורך לשנות.', 'תן/י לגוף להיות כמו שהוא.'],
        exhale: ['שחרר/י את הלסת והכתפיים.', 'נשוף/י את המתח החוצה.', 'רך — לא לדחוף.'],
        complete: 'הגוף קיבל תשומת לב — לא חייב להיעלם.',
      },
    },
    en: {
      title: 'Body scan — release',
      instructions: '3–5 min: move attention from shoulders down. Where there is tension — breathe there, without fixing.',
      why_this_meditation: 'Body tension showed up in your data — not generic wellness, but release for what was collected.',
      pain_served: 'Physical tension / body_tension',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 5},
      phase_guidance: {
        prepare: 'Stand or sit. Place a hand where tension is strongest.',
        inhale: ['Breathe into the tight spot.', 'Send air to where it hurts.', 'Inhale toward shoulders / back.'],
        hold: ['Hold — just notice.', 'No need to change anything.', 'Let the body be as it is.'],
        exhale: ['Release jaw and shoulders.', 'Exhale tension out.', 'Soft — no forcing.'],
        complete: 'The body got attention — it does not have to disappear.',
      },
    },
  },
  breath_ground: {
    he: {
      title: 'נשימה + קרקוע',
      instructions: '4 דקות: 5-4-3-2-1 — 5 דברים שרואים, 4 שומעים… בין נשימות.',
      why_this_meditation: 'דאגה גבוהה בנתונים — קרקוע לפני שמנסים לפתור.',
      pain_served: 'דאגה / worry_load',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 4},
      phase_guidance: {
        prepare: 'רגליים על הרצפה. שים/י לב ל-3 דברים שאת/ה רואה.',
        inhale: ['שאף/י לאט — את/ה כאן.', 'נשימה לבטן, לא לחזה בלבד.', 'קח/י אוויר — הרגע הזה בלבד.'],
        hold: ['מה את/ה שומע/ת עכשיו?', 'הישאר/י בחדר, בגוף.', 'אין צורך לברוח מהראש.'],
        exhale: ['שחרר/י כתפיים.', 'נשוף/י את הדחף לרוץ קדימה.', 'עגן/י — הרגליים, הכיסא.'],
        complete: 'קצת יותר קרקוע — לא פתרון, אבל יציבות.',
      },
    },
    en: {
      title: 'Breath + grounding',
      instructions: '4 min: 5-4-3-2-1 senses between slow breaths.',
      why_this_meditation: 'High worry in your data — ground before trying to solve.',
      pain_served: 'Worry / worry_load',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 4},
      phase_guidance: {
        prepare: 'Feet on the floor. Name 3 things you see.',
        inhale: ['Inhale slowly — you are here.', 'Belly breath, not chest only.', 'This moment only.'],
        hold: ['What do you hear right now?', 'Stay in the room, in the body.', 'No need to outrun the mind.'],
        exhale: ['Drop shoulders.', 'Exhale the urge to rush ahead.', 'Anchor — feet, chair.'],
        complete: 'A bit more ground — not a fix, but steadiness.',
      },
    },
  },
  focus_short: {
    he: {
      title: 'ריכוז קצר',
      instructions: '3 דקות: בחר/י נקודה אחת (נשימה / קול) — כל פיזור, חזור/י.',
      why_this_meditation: 'פוקוס נמוך בנתונים — ריכוז קצר, לא מדיטציה ארוכה.',
      pain_served: 'קושי בריכוז / focus',
      breathing_type: 'default',
      duration_minutes: 3,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 5, deep: 5},
      phase_guidance: {
        prepare: 'בחר/י נקודת עוגן אחת — קצה האף או הצליל של הנשימה.',
        inhale: ['שאף/י — חזור/י לנקודה.', 'כל מחשב — חזור/י.', 'ריכוז, לא שלמות.'],
        hold: ['הישאר/י עם הנקודה.', 'אם ברחת — זה בסדר.', 'שוב אל הנשימה.'],
        exhale: ['שחרר/י.', 'נקודה אחת — מספיק.', 'קצר וחוזר.'],
        complete: '3 דקות של נוכחות — לא יום שלם.',
      },
    },
    en: {
      title: 'Short focus',
      instructions: '3 min: pick one anchor (breath / sound) — when distracted, return.',
      why_this_meditation: 'Low focus in your data — short concentration, not a long sit.',
      pain_served: 'Difficulty focusing / focus',
      breathing_type: 'default',
      duration_minutes: 3,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 5, deep: 5},
      phase_guidance: {
        prepare: 'Pick one anchor — tip of nose or breath sound.',
        inhale: ['Inhale — return to the anchor.', 'Thoughts wander — return.', 'Focus, not perfection.'],
        hold: ['Stay with the point.', 'If you drift, that is OK.', 'Back to breath.'],
        exhale: ['Release.', 'One point is enough.', 'Short and repeat.'],
        complete: 'Three minutes of presence — not a whole day.',
      },
    },
  },
  self_compassion_meaning: {
    he: {
      title: 'חמלה עצמית / משמעות',
      instructions: '4 דקות: מה היית/ה אומר/ת לחבר/ה טוב/ה במצב דומה?',
      why_this_meditation: 'מצב רוח נמוך בנתונים — חמלה, לא "תחשוב חיובי".',
      pain_served: 'מצב רוח נמוך / low_mood',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 4},
      phase_guidance: {
        prepare: 'שים/י יד על הלב. זה קשה — וזה מובן.',
        inhale: ['שאף/י חמלה, לא לחץ.', 'משפט אחד של רוך לעצמך.', 'את/ה לא לבד/ה.'],
        hold: ['מה עדיין חשוב לך?', 'רגע של משמעות — קטן.', 'אין צורך לתקן הכל.'],
        exhale: ['שחרר/י ביקורת.', 'נשוף/י את הקול הקשה.', 'רך — כמו לחבר/ה.'],
        complete: 'חמלה אחת — לא פתרון, אבל נשימה.',
      },
    },
    en: {
      title: 'Self-compassion / meaning',
      instructions: '4 min: what would you tell a good friend in a similar moment?',
      why_this_meditation: 'Low mood in your data — compassion, not "think positive".',
      pain_served: 'Low mood / low_mood',
      breathing_type: 'calm',
      duration_minutes: 4,
      avoid_deep_content: false,
      max_rounds: {quick: 3, standard: 4, deep: 4},
      phase_guidance: {
        prepare: 'Hand on heart. This is hard — and that makes sense.',
        inhale: ['Inhale kindness, not pressure.', 'One gentle sentence to yourself.', 'You are not alone in this.'],
        hold: ['What still matters to you?', 'A small moment of meaning.', 'No need to fix everything.'],
        exhale: ['Release criticism.', 'Exhale the harsh voice.', 'Soft — like to a friend.'],
        complete: 'One breath of compassion — not a cure, but air.',
      },
    },
  },
  gentle_presence: {
    he: {
      title: 'נוכחות רכה',
      instructions: '2–3 דקות: נשימות איטיות — בלי חקירה עמוקה או imagery מעורר.',
      why_this_meditation: 'רמת סיכון מורמת — תוכן רדוד ובטוח, לא מדיטציה עמוקה.',
      pain_served: 'בטיחות / risk elevated',
      breathing_type: 'calm',
      duration_minutes: 3,
      avoid_deep_content: true,
      max_rounds: {quick: 2, standard: 3, deep: 3},
      phase_guidance: {
        prepare: 'שב/י בנוח. אין צורך לעשות כלום מלבד לנשום.',
        inhale: ['שאיפה רכה.', 'איטי — בקצב שלך.', 'את/ה בטוח/ה כאן.'],
        hold: ['רק רגע.', 'בלי לחפור.', 'נוכחות קלה.'],
        exhale: ['נשיפה ארוכה.', 'שחרור.', 'אין מרathon.'],
        complete: 'מספיק — לא צריך יותר היום.',
      },
    },
    en: {
      title: 'Gentle presence',
      instructions: '2–3 min: slow breaths — no deep inquiry or arousing imagery.',
      why_this_meditation: 'Elevated risk — shallow and safe, not deep meditation.',
      pain_served: 'Safety / elevated risk',
      breathing_type: 'calm',
      duration_minutes: 3,
      avoid_deep_content: true,
      max_rounds: {quick: 2, standard: 3, deep: 3},
      phase_guidance: {
        prepare: 'Sit comfortably. Nothing to do but breathe.',
        inhale: ['Soft inhale.', 'Slow — your pace.', 'You are safe here.'],
        hold: ['Just a moment.', 'No digging.', 'Light presence.'],
        exhale: ['Long exhale.', 'Release.', 'No marathon.'],
        complete: 'Enough — no more required today.',
      },
    },
  },
};

function pickDominantNeed(scores: NeedScores): {
  type: Exclude<MeditationType, 'gentle_presence'>;
  signals: string[];
} {
  const ranked = (Object.entries(scores) as Array<
    [Exclude<MeditationType, 'gentle_presence'>, {score: number; signals: string[]}]
  >)
    .filter(([, entry]) => entry.score >= 3)
    .sort((a, b) => b[1].score - a[1].score);

  if (ranked.length === 0) {
    return {type: 'breath_ground', signals: ['default.ground']};
  }

  return {type: ranked[0]![0], signals: ranked[0]![1].signals};
}

export function buildMeditationRecommendation(
  session: FormulationSession,
  locale: AppLocale = session.locale
): MeditationRecommendation | null {
  if (!session.formulation_approved && session.passive_ratings.length === 0) {
    return null;
  }

  const risk = riskLevel(session);
  const scores = scoreMeditationNeeds(session);
  const ctx = lifeContextNote(session.life_context_statuses);

  let type: MeditationType;
  let signals: string[];

  if (risk === 'elevated' || risk === 'crisis') {
    type = 'gentle_presence';
    signals = [`risk.${risk}`, ...Object.values(scores).flatMap((s) => s.signals)].slice(0, 4);
  } else {
    const pick = pickDominantNeed(scores);
    type = pick.type;
    signals = pick.signals;
    if (ctx === 'new_parent' && type === 'focus_short' && scores.breath_ground.score >= 3) {
      type = 'breath_ground';
    }
  }

  const rawCopy = MEDITATION_COPY[type][locale === 'he' ? 'he' : 'en'];
  const copy =
    locale === 'he'
      ? resolveGenderedDeep(rawCopy, resolveParticipantGender(session.participant_gender))
      : rawCopy;

  return {
    meditation_type: type,
    signals_used: signals,
    ...copy,
  };
}

export function meditationForPrompt(
  rec: MeditationRecommendation | null
): Record<string, unknown> | null {
  if (!rec) return null;
  return {
    meditation_type: rec.meditation_type,
    title: rec.title,
    instructions: rec.instructions,
    why_this_meditation: rec.why_this_meditation,
    pain_served: rec.pain_served,
    breathing_type: rec.breathing_type,
    duration_minutes: rec.duration_minutes,
    avoid_deep_content: rec.avoid_deep_content,
    max_rounds: rec.max_rounds,
    signals_used: rec.signals_used,
  };
}

export function resolveBreathingTypeForMeditation(
  rec: MeditationRecommendation | null,
  fallback: BreathingType
): BreathingType {
  return rec?.breathing_type ?? fallback;
}

export function maxBreathingRoundsForMeditation(
  rec: MeditationRecommendation | null,
  mode: 'quick' | 'standard' | 'deep',
  patternRounds: number
): number {
  if (!rec) return patternRounds;
  const cap = rec.max_rounds[mode];
  return Math.min(patternRounds, cap);
}
