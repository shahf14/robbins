"""Convert ambiguous Hebrew slash forms in messages/he.json to {male, female} objects."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HE_PATH = ROOT / 'messages' / 'he.json'

# Non-gender compound terms — leave string unchanged even if they contain '/'.
SKIP_SUBSTRINGS = (
    'אודיו/יוטיוב',
    'מהלקוח/שרת',
    'מקומי/שרת',
    'פעולה/ות',
    'צהריים/מנוחה',
    'קימה/שינה',
    'צעד/ים',
    'בן/בת',
)

# Longest patterns first.
GENDER_REPLACEMENTS: list[tuple[str, str, str]] = [
    ('שאת/ה', 'שאתה', 'שאת'),
    ('את/ה', 'אתה', 'את'),
    ('שהיית/ה', 'שהיית', 'שהיית'),
    ('שהתינוק/ת', 'שהתינוק', 'שהתינוקת'),
    ('בתינוק/ת', 'בתינוק', 'בתינוקת'),
    ('לתינוק/ת', 'לתינוק', 'לתינוקת'),
    ('בילד/ה', 'בילד', 'בילדה'),
    ('לילד/ה', 'לילד', 'לילדה'),
    ('ילד/ה', 'ילד', 'ילדה'),
    ('סטודנט/ית', 'סטודנט', 'סטודנטית'),
    ('נשוי/נשואה', 'נשוי', 'נשואה'),
    ('רווק/רווקה', 'רווק', 'רווקה'),
    ('חבר/ה טוב/ה', 'חבר טוב', 'חברה טובה'),
    ('טיפול/הורות', 'טיפול/הורות', 'טיפול/הורות'),
    ('ומתפקד/ת', 'ומתפקד', 'ומתפקדת'),
    ('ומתקשה/ה', 'ומתקשה', 'ומתקשה'),
    ('ומרוצה/ה', 'ומרוצה', 'ומרוצה'),
    ('ובעל/ת', 'ובעל', 'ובעלת'),
    ('ובחר/י', 'ובחר', 'ובחרי'),
    ('וערוך/י', 'וערוך', 'וערכי'),
    ('התקשר/י', 'התקשר', 'התקשרי'),
    ('תועבר/י', 'תועבר', 'תועברי'),
    ('תעשה/י', 'תעשה', 'תעשי'),
    ('תרצה/י', 'תרצה', 'תרצי'),
    ('תבחר/י', 'תבחר', 'תבחרי'),
    ('זכור/י', 'זכור', 'זכרי'),
    ('חזור/י', 'חזור', 'חזרי'),
    ('בחר/י', 'בחר', 'בחרי'),
    ('סמן/י', 'סמן', 'סמני'),
    ('דרג/י', 'דרג', 'דרגי'),
    ('תאר/י', 'תאר', 'תארי'),
    ('קרא/י', 'קרא', 'קראי'),
    ('מלא/י', 'מלא', 'מלאי'),
    ('לחץ/י', 'לחץ', 'לחצי'),
    ('עבור/י', 'עבור', 'עברי'),
    ('נסה/י', 'נסה', 'נסי'),
    ('שים/י', 'שים', 'שימי'),
    ('מתחייב/ת', 'מתחייב', 'מתחייבת'),
    ('מתעורר/ת', 'מתעורר', 'מתעוררת'),
    ('מתקדם/ת', 'מתקדם', 'מתקדמת'),
    ('מצליח/ה', 'מצליח', 'מצליחה'),
    ('מרגיש/ה', 'מרגיש', 'מרגישה'),
    ('מרוצה/ה', 'מרוצה', 'מרוצה'),
    ('מרוקן/ת', 'מרוקן', 'מרוקנת'),
    ('מנותק/ת', 'מנותק', 'מנותקת'),
    ('מנהל/ת', 'מנהל', 'מנהלת'),
    ('מסתדר/ת', 'מסתדר', 'מסתדרת'),
    ('ממוקד/ת', 'ממוקד', 'ממוקדת'),
    ('מחובר/ת', 'מחובר', 'מחוברת'),
    ('מטפל/ת', 'מטפל', 'מטפלת'),
    ('מוצף/ת', 'מוצף', 'מוצפת'),
    ('מוכן/ה', 'מוכן', 'מוכנה'),
    ('מעדיף/ה', 'מעדיף', 'מעדיפה'),
    ('נמנע/ת', 'נמנע', 'נמנעת'),
    ('נוכח/ת', 'נוכח', 'נוכחת'),
    ('לוקח/ת', 'לוקח', 'לוקחת'),
    ('דואג/ת', 'דואג', 'דואגת'),
    ('סומך/ת', 'סומך', 'סומכת'),
    ('שומע/ת', 'שומע', 'שומעת'),
    ('עובד/ת', 'עובד', 'עובדת'),
    ('בריא/ה', 'בריא', 'בריאה'),
    ('בודד/ה', 'בודד', 'בודדה'),
    ('בטוח/ה', 'בטוח', 'בטוחה'),
    ('אבוד/ה', 'אבוד', 'אבודה'),
    ('יציב/ה', 'יציב', 'יציבה'),
    ('יקר/ה', 'יקר', 'יקרה'),
    ('חסר/ה', 'חסר', 'חסרה'),
    ('חי/ה', 'חי', 'חיה'),
    ('זמין/ה', 'זמין', 'זמינה'),
    ('נח/ה', 'נח', 'נחה'),
    ('צלול/ה', 'צלול', 'צלולה'),
    ('רגוע/ה', 'רגוע', 'רגועה'),
    ('רחוק/ה', 'רחוק', 'רחוקה'),
    ('רוצה/ה', 'רוצה', 'רוצה'),
    ('קטן/ה', 'קטן', 'קטנה'),
    ('עייף/ה', 'עייף', 'עייפה'),
    ('תקוע/ה', 'תקוע', 'תקועה'),
    ('רופא/ה', 'רופא', 'רופאה'),
    ('טיפול/ת', 'טיפול', 'טיפולית'),
]

GENDER_PATTERN = re.compile(r'[\u0590-\u05FF]+/[\u0590-\u05FF]+')


def should_skip(value: str) -> bool:
    return any(skip in value for skip in SKIP_SUBSTRINGS)


def has_gender_slash(value: str) -> bool:
    if should_skip(value):
        return False
    return bool(GENDER_PATTERN.search(value))


def split_gendered_string(value: str) -> dict[str, str] | str:
    if not has_gender_slash(value):
        return value

    male = value
    female = value
    for pattern, male_rep, female_rep in GENDER_REPLACEMENTS:
        male = male.replace(pattern, male_rep)
        female = female.replace(pattern, female_rep)

    if male == female:
        return value
    return {'male': male, 'female': female}


def walk(obj):
    if isinstance(obj, dict):
        if set(obj.keys()) == {'male', 'female'}:
            return obj
        return {key: walk(val) for key, val in obj.items()}
    if isinstance(obj, str):
        return split_gendered_string(obj)
    return obj


def main():
    with HE_PATH.open(encoding='utf-8') as f:
        data = json.load(f)

    converted = walk(data)

    with HE_PATH.open('w', encoding='utf-8') as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)
        f.write('\n')

    with HE_PATH.open(encoding='utf-8') as f:
        json.load(f)

    print(f'Updated {HE_PATH}')


if __name__ == '__main__':
    main()
