import type {ParticipantGender} from '@/lib/formulation/participant-profile';
import {isParticipantGender} from '@/lib/formulation/participant-profile';

const GENDER_VARIANT_KEYS = new Set(['male', 'female']);

const SKIP_SUBSTRINGS = [
  'אודיו/יוטיוב',
  'מהלקוח/שרת',
  'מקומי/שרת',
  'פעולה/ות',
  'צהריים/מנוחה',
  'קימה/שינה',
  'צעד/ים',
  'בן/בת',
] as const;

const HEBREW_GENDER_REPLACEMENTS: ReadonlyArray<readonly [string, string, string]> = [
  ['שאת/ה', 'שאתה', 'שאת'],
  ['את/ה', 'אתה', 'את'],
  ['שהיית/ה', 'שהיית', 'שהיית'],
  ['שהתינוק/ת', 'שהתינוק', 'שהתינוקת'],
  ['בתינוק/ת', 'בתינוק', 'בתינוקת'],
  ['לתינוק/ת', 'לתינוק', 'לתינוקת'],
  ['בילד/ה', 'בילד', 'בילדה'],
  ['לילד/ה', 'לילד', 'לילדה'],
  ['ילד/ה', 'ילד', 'ילדה'],
  ['סטודנט/ית', 'סטודנט', 'סטודנטית'],
  ['נשוי/נשואה', 'נשוי', 'נשואה'],
  ['רווק/רווקה', 'רווק', 'רווקה'],
  ['חבר/ה טוב/ה', 'חבר טוב', 'חברה טובה'],
  ['ומתפקד/ת', 'ומתפקד', 'ומתפקדת'],
  ['ומתקשה/ה', 'ומתקשה', 'ומתקשה'],
  ['ומרוצה/ה', 'ומרוצה', 'ומרוצה'],
  ['ובעל/ת', 'ובעל', 'ובעלת'],
  ['ובחר/י', 'ובחר', 'ובחרי'],
  ['וערוך/י', 'וערוך', 'וערכי'],
  ['התקשר/י', 'התקשר', 'התקשרי'],
  ['תועבר/י', 'תועבר', 'תועברי'],
  ['תעשה/י', 'תעשה', 'תעשי'],
  ['תרצה/י', 'תרצה', 'תרצי'],
  ['תבחר/י', 'תבחר', 'תבחרי'],
  ['זכור/י', 'זכור', 'זכרי'],
  ['חזור/י', 'חזור', 'חזרי'],
  ['בחר/י', 'בחר', 'בחרי'],
  ['סמן/י', 'סמן', 'סמני'],
  ['דרג/י', 'דרג', 'דרגי'],
  ['תאר/י', 'תאר', 'תארי'],
  ['קרא/י', 'קרא', 'קראי'],
  ['מלא/י', 'מלא', 'מלאי'],
  ['לחץ/י', 'לחץ', 'לחצי'],
  ['עבור/י', 'עבור', 'עברי'],
  ['נסה/י', 'נסה', 'נסי'],
  ['שים/י', 'שים', 'שימי'],
  ['כתוב/י', 'כתוב', 'כתבי'],
  ['סיים/י', 'סיים', 'סיימי'],
  ['בצע/י', 'בצע', 'בצעי'],
  ['זהה/י', 'זהה', 'זהי'],
  ['הכנס/י', 'הכנס', 'הכניסי'],
  ['החזק/י', 'החזק', 'החזיקי'],
  ['תרגיש/י', 'תרגיש', 'תרגישי'],
  ['תן/י', 'תן', 'תני'],
  ['שחרר/י', 'שחרר', 'שחררי'],
  ['נשוף/י', 'נשוף', 'נשפי'],
  ['עגן/י', 'עגן', 'עגני'],
  ['עמוד/י', 'עמוד', 'עמדי'],
  ['שב/י', 'שב', 'שבי'],
  ['שאף/י', 'שאף', 'שאפי'],
  ['הישאר/י', 'הישאר', 'הישארי'],
  ['קח/י', 'קח', 'קחי'],
  ['היית/ה', 'היית', 'היית'],
  ['הייתי', 'הייתי', 'הייתי'],
  ['אומר/ת', 'אומר', 'אומרת'],
  ['היית אומר/ת', 'היית אומר', 'היית אומרת'],
  ['הייתי אומר/ת', 'הייתי אומר', 'הייתי אומרת'],
  ['תזוז/י', 'תזוז', 'תזוזי'],
  ['פותח/ת', 'פותח', 'פותחת'],
  ['סיימת/ה', 'סיימת', 'סיימת'],
  ['שתית/ה', 'שתית', 'שתית'],
  ['קמת/ה', 'קמת', 'קמת'],
  ['סגרת/ה', 'סגרת', 'סגרת'],
  ['נרדם/ה', 'נרדם', 'נרדמה'],
  ['הפעל/י', 'הפעל', 'הפעילי'],
  ['מתחייב/ת', 'מתחייב', 'מתחייבת'],
  ['מתעורר/ת', 'מתעורר', 'מתעוררת'],
  ['מתקדם/ת', 'מתקדם', 'מתקדמת'],
  ['מצליח/ה', 'מצליח', 'מצליחה'],
  ['מרגיש/ה', 'מרגיש', 'מרגישה'],
  ['מרוצה/ה', 'מרוצה', 'מרוצה'],
  ['מרוקן/ת', 'מרוקן', 'מרוקנת'],
  ['מנותק/ת', 'מנותק', 'מנותקת'],
  ['מנהל/ת', 'מנהל', 'מנהלת'],
  ['מסתדר/ת', 'מסתדר', 'מסתדרת'],
  ['ממוקד/ת', 'ממוקד', 'ממוקדת'],
  ['מחובר/ת', 'מחובר', 'מחוברת'],
  ['מטפל/ת', 'מטפל', 'מטפלת'],
  ['מוצף/ת', 'מוצף', 'מוצפת'],
  ['מוכן/ה', 'מוכן', 'מוכנה'],
  ['מעדיף/ה', 'מעדיף', 'מעדיפה'],
  ['נמנע/ת', 'נמנע', 'נמנעת'],
  ['נוכח/ת', 'נוכח', 'נוכחת'],
  ['לוקח/ת', 'לוקח', 'לוקחת'],
  ['דואג/ת', 'דואג', 'דואגת'],
  ['סומך/ת', 'סומך', 'סומכת'],
  ['שומע/ת', 'שומע', 'שומעת'],
  ['עובד/ת', 'עובד', 'עובדת'],
  ['בריא/ה', 'בריא', 'בריאה'],
  ['בודד/ה', 'בודד', 'בודדה'],
  ['בטוח/ה', 'בטוח', 'בטוחה'],
  ['אבוד/ה', 'אבוד', 'אבודה'],
  ['יציב/ה', 'יציב', 'יציבה'],
  ['יקר/ה', 'יקר', 'יקרה'],
  ['חסר/ה', 'חסר', 'חסרה'],
  ['חי/ה', 'חי', 'חיה'],
  ['זמין/ה', 'זמין', 'זמינה'],
  ['נח/ה', 'נח', 'נחה'],
  ['צלול/ה', 'צלול', 'צלולה'],
  ['רגוע/ה', 'רגוע', 'רגועה'],
  ['רחוק/ה', 'רחוק', 'רחוקה'],
  ['רוצה/ה', 'רוצה', 'רוצה'],
  ['קטן/ה', 'קטן', 'קטנה'],
  ['עייף/ה', 'עייף', 'עייפה'],
  ['תקוע/ה', 'תקוע', 'תקועה'],
  ['רופא/ה', 'רופא', 'רופאה'],
  ['מוותר/ת', 'מוותר', 'מוותרת'],
  ['מתקשה/ה', 'מתקשה', 'מתקשה'],
  ['יודע/ת', 'יודע', 'יודעת'],
  ['מזהה/ה', 'מזהה', 'מזהה'],
  ['חושש/ת', 'חושש', 'חוששת'],
  ['לא לבד/ה', 'לא לבד', 'לא לבדה'],
];

const HEBREW_GENDER_PATTERN = /[\u0590-\u05FF]+\/[\u0590-\u05FF]+/;

export type GenderedPair = {male: string; female: string};

export function resolveParticipantGender(
  gender?: ParticipantGender | string | null
): ParticipantGender {
  if (gender === 'female') return 'female';
  return 'male';
}

export function pickGendered<T>(
  gender: ParticipantGender,
  variants: {male: T; female: T}
): T {
  return variants[gender];
}

export function genderFromUnknown(value: unknown): ParticipantGender {
  return isParticipantGender(String(value ?? '')) ? (value as ParticipantGender) : 'male';
}

function shouldSkipGenderSplit(value: string): boolean {
  return SKIP_SUBSTRINGS.some((skip) => value.includes(skip));
}

function hasGenderSlash(value: string): boolean {
  if (shouldSkipGenderSplit(value)) return false;
  return HEBREW_GENDER_PATTERN.test(value);
}

export function splitGenderedHebrewString(value: string): string | GenderedPair {
  if (!hasGenderSlash(value)) return value;

  let male = value;
  let female = value;
  for (const [pattern, maleRep, femaleRep] of HEBREW_GENDER_REPLACEMENTS) {
    male = male.replaceAll(pattern, maleRep);
    female = female.replaceAll(pattern, femaleRep);
  }

  if (male === female) return value;
  return {male, female};
}

export function resolveGenderedHebrewText(
  value: string,
  gender?: ParticipantGender | string | null
): string {
  const split = splitGenderedHebrewString(value);
  if (typeof split === 'string') return split;
  return pickGendered(resolveParticipantGender(gender), split);
}

const GENDER_OPTION_LABEL_KEYS = new Set(['genderOptions']);

function isGenderVariantObject(value: unknown): value is GenderedPair {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  return (
    keys.length === 2 &&
    keys.every((key) => GENDER_VARIANT_KEYS.has(key)) &&
    typeof obj.male === 'string' &&
    typeof obj.female === 'string'
  );
}

function shouldPreserveGenderOptionLabels(path: string[]): boolean {
  const leaf = path[path.length - 1];
  return leaf != null && GENDER_OPTION_LABEL_KEYS.has(leaf);
}

/** Resolve nested `{ male, female }` objects and slash forms for runtime Hebrew copy. */
export function resolveGenderedDeep<T>(
  value: T,
  gender?: ParticipantGender | string | null,
  path: string[] = []
): T {
  const resolvedGender = resolveParticipantGender(gender);

  if (typeof value === 'string') {
    const split = splitGenderedHebrewString(value);
    if (typeof split === 'string') return split as T;
    return split[resolvedGender] as T;
  }

  if (isGenderVariantObject(value) && !shouldPreserveGenderOptionLabels(path)) {
    return value[resolvedGender] as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveGenderedDeep(item, resolvedGender, path)) as T;
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(input)) {
      output[key] = resolveGenderedDeep(entry, resolvedGender, [...path, key]);
    }
    return output as T;
  }

  return value;
}

/** Flatten `{ male, female }` message leaves for the active gender (Hebrew UI). */
export function resolveGenderedMessages<T>(messages: T, gender: ParticipantGender): T {
  return resolveGenderedDeep(messages, gender);
}
