/**
 * clinical-analysis.ts
 *
 * Lightweight client-side text analysis for psychological behavioral signals.
 * All functions are pure, synchronous, and locale-aware.
 * No AI/server calls — designed to run at collection time in the browser.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GratitudeTargetType = 'person' | 'experience' | 'thing' | 'abstract';
export type VisualizationContentType = 'future_positive' | 'problem_solving' | 'escapist' | 'empty';

// ---------------------------------------------------------------------------
// Self-blame / self-critical language detection
// ---------------------------------------------------------------------------

const SELF_BLAME_HE = [
  'בגללי', 'אשם', 'אשמה', 'אשמים', 'לא הצלחתי', 'כישלון', 'כשלתי',
  'כרגיל אני', 'תמיד אני', 'שוב אני', 'אין לי', 'מה הטעם',
  'לעולם לא', 'אני לא מסוגל', 'אני לא מצליח', 'אני גרוע',
  'אני חסר', 'אני חסרת', 'טיפש', 'טיפשה', 'עצלן', 'עצלנית',
  'בזבוז', 'כמו תמיד', 'שוב כישלון', 'פשוט לא מסוגל',
];

const SELF_BLAME_EN = [
  'my fault', 'i failed', 'i always fail', 'i never', 'i can\'t',
  'i ruined', 'worthless', 'hopeless', 'useless', 'i\'m stupid',
  'as usual', 'i\'m lazy', 'i gave up', 'i always do this',
  'i\'m such a', 'i messed up', 'failure', 'i blew it',
  'my problem', 'i\'m the problem', 'i let', 'i should have',
];

export function detectSelfBlame(text: string, locale: string): boolean {
  if (!text || !text.trim()) return false;
  const lower = text.toLowerCase();
  const patterns = locale === 'he' ? SELF_BLAME_HE : SELF_BLAME_EN;
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Somatic / physical complaint detection
// ---------------------------------------------------------------------------

const PHYSICAL_COMPLAINT_HE = [
  'כאב ראש', 'כאבי ראש', 'כאב גב', 'כאבי גב', 'כאב בטן', 'כאבי בטן',
  'מיגרנה', 'סחרחורת', 'עייפות', 'ממש עייף', 'ממש עייפה', 'לא ישנתי',
  'לא ישנה', 'גוף כבד', 'כבד עלי', 'לא מרגיש טוב', 'לא מרגישה טוב',
  'חולה', 'מחוסר כוח', 'מחוסרת כוח', 'רדום', 'רדומה', 'לא יכול לזוז',
];

const PHYSICAL_COMPLAINT_EN = [
  'headache', 'head ache', 'back pain', 'stomach', 'nausea', 'migraine',
  'dizzy', 'exhausted', 'body ache', 'didn\'t sleep', 'can\'t sleep',
  'not feeling well', 'feeling sick', 'so tired', 'no energy',
  'dragging', 'heavy body', 'can\'t move', 'physically drained',
];

// ---------------------------------------------------------------------------
// Gratitude target type classification
// ---------------------------------------------------------------------------

const PERSON_KW_HE = [
  'אשתי', 'בעלי', 'בן זוג', 'בת זוג', 'ילד', 'ילדה', 'ילדים',
  'אמא', 'אבא', 'הורים', 'אח', 'אחות', 'חבר', 'חברה', 'חברים',
  'משפחה', 'בן', 'בת', 'סבא', 'סבתא', 'קולגה', 'שותף', 'מורה',
];
const PERSON_KW_EN = [
  'wife', 'husband', 'partner', 'child', 'children', 'kids',
  'mom', 'dad', 'parents', 'brother', 'sister', 'friend', 'friends',
  'family', 'son', 'daughter', 'grandfather', 'grandmother', 'colleague', 'teacher',
];

const EXPERIENCE_KW_HE = [
  'טיול', 'נסיעה', 'שינה', 'ספר', 'מוזיקה', 'ריצה', 'אימון',
  'שיחה', 'פגישה', 'חוויה', 'זמן ל', 'להיות ב', 'רגע', 'שקט',
  'מנוחה', 'ארוחה', 'ארוחת', 'צחוק', 'כיף', 'הצלחה',
];
const EXPERIENCE_KW_EN = [
  'walk', 'trip', 'sleep', 'book', 'music', 'run', 'workout',
  'conversation', 'meeting', 'experience', 'time for', 'being in', 'moment',
  'quiet', 'rest', 'meal', 'laugh', 'fun', 'success', 'win',
];

const THING_KW_HE = [
  'בית', 'מכונית', 'אוכל', 'קפה', 'טלפון', 'מחשב', 'כסף',
  'לבוש', 'בגד', 'מיטה', 'כלים', 'ציוד', 'ממון', 'רכוש',
];
const THING_KW_EN = [
  'house', 'home', 'car', 'food', 'coffee', 'phone', 'computer',
  'money', 'clothes', 'bed', 'tools', 'equipment', 'property', 'stuff',
];

export function classifyGratitudeTarget(text: string, locale: string): GratitudeTargetType {
  if (!text || text.trim().length < 3) return 'abstract';
  const lower = text.toLowerCase();
  const [personKw, experienceKw, thingKw] =
    locale === 'he'
      ? [PERSON_KW_HE, EXPERIENCE_KW_HE, THING_KW_HE]
      : [PERSON_KW_EN, EXPERIENCE_KW_EN, THING_KW_EN];

  if (personKw.some((k) => lower.includes(k.toLowerCase()))) return 'person';
  if (experienceKw.some((k) => lower.includes(k.toLowerCase()))) return 'experience';
  if (thingKw.some((k) => lower.includes(k.toLowerCase()))) return 'thing';
  return 'abstract';
}

// ---------------------------------------------------------------------------
// Generic gratitude detection (autopilot / copy-paste ritual)
// ---------------------------------------------------------------------------

const GENERIC_PHRASES_HE = [
  'תודה על הבריאות', 'תודה על המשפחה', 'תודה על החיים',
  'תודה על הבית', 'תודה שאני בריא', 'תודה שאני בריאה',
  'תודה על כל מה שיש לי', 'תודה על הכל',
];
const GENERIC_PHRASES_EN = [
  'grateful for my health', 'thankful for my family', 'grateful for life',
  'thankful for my home', 'grateful for everything', 'thankful for all',
];

/** Similarity: returns true if two strings share >70% of their words */
function isSimilarText(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0) return false;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / wordsA.size >= 0.7;
}

export function isGratitudeGeneric(
  text: string,
  recentGratitudeTexts: string[],
  locale: string
): boolean {
  if (!text || text.trim().length < 3) return false;
  const lower = text.toLowerCase().trim();
  const genericPhrases = locale === 'he' ? GENERIC_PHRASES_HE : GENERIC_PHRASES_EN;

  // Known generic phrase
  if (genericPhrases.some((p) => lower.includes(p.toLowerCase()))) return true;

  // Repeated from last 7 days (>70% similarity)
  const recent7 = recentGratitudeTexts.slice(0, 21); // ~3 per day × 7 days
  if (recent7.some((prev) => isSimilarText(text, prev))) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Visualization content type classification
// ---------------------------------------------------------------------------

const ESCAPIST_KW_HE = [
  'לברוח', 'לעזוב', 'רחוק מ', 'בלי', 'שיגמר', 'שזה ייגמר',
  'לא להיות', 'להיעלם', 'שקט מ', 'לא לחשוב על', 'להפסיק',
];
const ESCAPIST_KW_EN = [
  'escape', 'run away', 'leave it all', 'far from', 'without',
  'just end', 'disappear', 'stop thinking', 'get away', 'if only',
];

const FUTURE_POSITIVE_KW_HE = [
  'אני רואה את עצמי', 'בעתיד', 'אצליח', 'אהיה', 'אגיע',
  'החיים שלי יהיו', 'אני עתיד', 'אני תוכל', 'יום אחד',
  'הגרסה הטובה', 'החזון שלי', 'עד סוף השנה', 'בעוד',
];
const FUTURE_POSITIVE_KW_EN = [
  'i see myself', 'in the future', 'i will succeed', 'i will be',
  'my life will', 'vision', 'one day', 'best version', 'by the end',
  'i can see', 'imagine myself', 'my goal is to become',
];

const PROBLEM_SOLVING_KW_HE = [
  'פתרון', 'איך', 'אם אעשה', 'צעד ראשון', 'הדרך היא',
  'אפשר לפתור', 'הגישה', 'האסטרטגיה', 'אנסה', 'הצעד הבא',
];
const PROBLEM_SOLVING_KW_EN = [
  'solution', 'how to', 'if i do', 'first step', 'the way is',
  'i can solve', 'approach', 'strategy', 'i will try', 'next step',
];

export function classifyVisualizationContent(
  text: string,
  locale: string
): VisualizationContentType {
  if (!text || text.trim().length < 5) return 'empty';
  const lower = text.toLowerCase();

  const [escapistKw, futurePosKw, problemKw] =
    locale === 'he'
      ? [ESCAPIST_KW_HE, FUTURE_POSITIVE_KW_HE, PROBLEM_SOLVING_KW_HE]
      : [ESCAPIST_KW_EN, FUTURE_POSITIVE_KW_EN, PROBLEM_SOLVING_KW_EN];

  // Score each type
  const escapistScore = escapistKw.filter((k) => lower.includes(k.toLowerCase())).length;
  const futureScore   = futurePosKw.filter((k) => lower.includes(k.toLowerCase())).length;
  const problemScore  = problemKw.filter((k) => lower.includes(k.toLowerCase())).length;

  const max = Math.max(escapistScore, futureScore, problemScore);
  if (max === 0) return 'future_positive'; // default: give benefit of the doubt

  if (escapistScore === max) return 'escapist';
  if (problemScore === max)  return 'problem_solving';
  return 'future_positive';
}

// ---------------------------------------------------------------------------
// Success metric specificity
// ---------------------------------------------------------------------------

const MEASURABLE_REGEX = /\d+\s*(ק"מ|ק"ג|km|kg|₪|\$|שעות|hours|דקות|minutes|פעמים|times|%|קלוריות|calories|cal)/i;

// ---------------------------------------------------------------------------
// Word count helper
// ---------------------------------------------------------------------------

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

// ---------------------------------------------------------------------------
// Tag valence helper (used at check-in build time)
// ---------------------------------------------------------------------------

const POSITIVE_TAGS = new Set([
  'driven', 'laserFocused', 'inspired', 'disciplined', 'calm', 'aligned', 'grateful',
]);

function tagIsPositive(tag: string): boolean {
  return POSITIVE_TAGS.has(tag);
}
