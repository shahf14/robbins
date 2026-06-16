import type {AppLocale} from '@/i18n/config';
import type {LifeDomain} from '@/lib/life-coach/types';
import type {ActionPatternKind, LocalizedPatternCopy, PatternCopySet} from './types';

const STRATEGY_BY_KIND: Record<ActionPatternKind, {he: string; en: string}> = {
  no_time: {
    he: 'הכנה קצרה / החלטה מראש / פעולה של 5 דקות',
    en: 'short prep / pre-decision / 5-minute action',
  },
  fear_of_failure: {
    he: 'ניסוי קטן בלי התחייבות',
    en: 'small experiment without commitment',
  },
  lack_of_clarity: {
    he: 'מיפוי / בחירה בין 3 אפשרויות',
    en: 'mapping / choosing among 3 options',
  },
  fatigue: {
    he: 'פעולה פסיבית או סביבתית',
    en: 'passive or environmental action',
  },
  procrastination: {
    he: 'התחלה של 2 דקות בלבד',
    en: '2-minute start only',
  },
};

type PatternSeed = {
  minutes: number;
  he: Omit<LocalizedPatternCopy, 'strategy'>;
  en: Omit<LocalizedPatternCopy, 'strategy'>;
};

function seed(
  minutes: number,
  he: Omit<LocalizedPatternCopy, 'strategy'>,
  en: Omit<LocalizedPatternCopy, 'strategy'>
): PatternSeed {
  return {minutes, he, en};
}

/** kind → domain → proven action template */
const PATTERN_LIBRARY: Record<ActionPatternKind, Record<LifeDomain, PatternSeed>> = {
  no_time: {
    health: seed(5,
      {title: 'החלט מראש ארוחה אחת להיום ורשום 3 מצרכים', description: '5 דקות: בחר ארוחה, כתוב רשימת קניות מינימלית — בלי לבשל עכשיו.', success: 'יש ארוחה נבחרת ורשימת קניות קצרה.', resistance: 'אין זמן — רק החלטה, לא ביצוע מלא.', pain: 'מוריד החלטות ברגע האחרון ומונע דחייה של תזונה.'},
      {title: 'Pre-decide one meal for today and list 3 groceries', description: '5 minutes: pick a meal, write a minimal shopping list — no cooking now.', success: 'One meal chosen and a short grocery list exists.', resistance: 'No time — decision only, not full execution.', pain: 'Removes last-minute food decisions and prevents nutrition avoidance.'}
    ),
    time: seed(5,
      {title: 'בחר משימה אחת ל-5 דקות והכן את מה שצריך להתחיל', description: '5 דקות: פתח קובץ/אפליקציה, שים טיימר, התחל רק את הדקה הראשונה.', success: 'הכנה מוכנה וטיימר הופעל.', resistance: 'לוח זמנים עמוס — רק הכנה.', pain: 'מקטין חיכוך התחלה כשאין חלון זמן גדול.'},
      {title: 'Pick one 5-minute task and prep what you need to start', description: '5 minutes: open the file/app, set a timer, start only the first minute.', success: 'Prep done and timer started.', resistance: 'Packed schedule — prep only.', pain: 'Shrinks startup friction when there is no large time window.'}
    ),
    wealth: seed(5,
      {title: 'קבע החלטה פיננסית אחת קטנה להיום (למשל: לא להוציא מעל X)', description: '5 דקות: כתוב החלטה אחת ברורה ליום — לא ניתוח מלא.', success: 'החלטה אחת כתובה ונראית.', resistance: 'אין זמן לניהול כסף — רק החלטה.', pain: 'מונע עומס החלטות פיננסיות ודחייה של שליטה.'},
      {title: 'Set one small money decision for today (e.g. spending cap)', description: '5 minutes: write one clear decision for today — not a full review.', success: 'One decision written and visible.', resistance: 'No time for money admin — decision only.', pain: 'Prevents financial decision overload and control avoidance.'}
    ),
    career: seed(5,
      {title: 'הכן טיוטת הודעה של 3 שורות לפני שתשלח', description: '5 דקות: כתוב נקודות, לא שליחה — רק הכנה להחלטה מהירה.', success: 'טיוטה של 3 שורות מוכנה.', resistance: 'יום עמוס — הכנה בלבד.', pain: 'מוריד חיכוך תקשורת עבודה כשאין זמן לבלוק ארוך.'},
      {title: 'Draft a 3-line message before sending', description: '5 minutes: bullet points only — prep for a fast send decision.', success: 'A 3-line draft is ready.', resistance: 'Busy day — prep only.', pain: 'Reduces work communication friction without a long block.'}
    ),
    relationships: seed(5,
      {title: 'כתוב משפט אחד מוכן לשליחה לאדם חשוב', description: '5 דקות: טיוטה קצרה בלבד — החלטה מראש מה תגיד.', success: 'משפט אחד מוכן בטיוטה.', resistance: 'אין זמן לשיחה — רק הכנה.', pain: 'מונע ניתוק בגלל חוסר זמן לקשר.'},
      {title: 'Write one ready-to-send sentence to someone important', description: '5 minutes: short draft only — pre-decide what you will say.', success: 'One sentence drafted.', resistance: 'No time for a call — prep only.', pain: 'Prevents disconnection when there is no time to connect.'}
    ),
    mind: seed(5,
      {title: 'רשום 3 דברים שמפריעים — ובחר אחד לטיפול ב-5 דקות', description: '5 דקות: מיפוי מהיר + החלטה מה קדום עכשיו.', success: '3 נקודות כתובות ואחת נבחרה.', resistance: 'ראש עמוס — רק מיפוי קצר.', pain: 'מקטין עומס מחשבתי דרך החלטה מראש.'},
      {title: 'List 3 bothersome items — pick one for a 5-minute pass', description: '5 minutes: quick map + decide what is first now.', success: '3 items listed and one chosen.', resistance: 'Mental overload — short map only.', pain: 'Shrinks cognitive load through a pre-decision.'}
    ),
    spirit: seed(5,
      {title: 'הכן מקום שקט ל-5 דקות (כיסא, מים, טיימר)', description: '5 דקות: סביבה מוכנה — ההחלטה כבר נעשתה.', success: 'מקום שקט מוכן עם טיימר.', resistance: 'אין זמן לארוך — רק הכנת סביבה.', pain: 'מוריד חיכוך להתחברות פנימית כשהזמן מוגבל.'},
      {title: 'Prep a 5-minute quiet spot (chair, water, timer)', description: '5 minutes: environment ready — the decision is already made.', success: 'Quiet spot ready with timer.', resistance: 'No long window — environment prep only.', pain: 'Reduces friction to inner connection on limited time.'}
    ),
    house_family: seed(5,
      {title: 'בחר אזור אחד קטן ושים כלי ניקוי/סידור במקום', description: '5 דקות: הכנה סביבתית — לא לסיים הכל, רק להתחיל.', success: 'אזור נבחר וכלי מוכן.', resistance: 'בית עמוס — הכנה בלבד.', pain: 'מקטין עומס ביתי דרך החלטה והכנה מראש.'},
      {title: 'Pick one small area and place the tidy tool there', description: '5 minutes: environmental prep — not finishing all, just starting.', success: 'Area chosen and tool ready.', resistance: 'Busy home — prep only.', pain: 'Shrinks household overload via pre-decision and prep.'}
    ),
  },
  fear_of_failure: {
    health: seed(8,
      {title: 'נסה גרסת ניסוי: 3 דקות הליכה בלי יעד סופי', description: '8 דקות: ניסוי קטן — אפשר לעצור אחרי 3 דקות, בלי התחייבות להמשך.', success: '3 דקות בוצעו או התחילו — בלי לחץ להשלמה.', resistance: 'פחד לא לעמוד ביעד — ניסוי בלבד.', pain: 'מפחית פחד מכישלון ומחזיר תחושת בטיחות לנסות.'},
      {title: 'Try an experiment: 3-minute walk with no finish goal', description: '8 minutes: tiny trial — you may stop after 3 minutes, no commitment to continue.', success: '3 minutes done or started — no pressure to finish.', resistance: 'Fear of missing the goal — experiment only.', pain: 'Reduces fear of failure and restores safe-to-try feeling.'}
    ),
    time: seed(8,
      {title: 'נסה לעבוד 5 דקות על משימה אחת — מותר לעצור', description: '8 דקות: ניסוי בלי התחייבות לסיים — רק לבדוק אם זה אפשרי.', success: '5 דקות ניסיון בוצעו, גם אם עצרת.', resistance: 'פחד שלא אספיק — ניסוי קטן.', pain: 'מוריד פחד מכישלון סביב ניהול זמן.'},
      {title: 'Try 5 minutes on one task — stopping is allowed', description: '8 minutes: experiment without finishing — just test if it is possible.', success: '5-minute trial done, even if you stopped.', resistance: 'Fear of not finishing — tiny trial.', pain: 'Shrinks failure fear around time management.'}
    ),
    wealth: seed(8,
      {title: 'בדוק נתון פיננסי אחד בלבד — בלי תוכנית מלאה', description: '8 דקות: ניסוי מידע — לא משמעות להחלטה גדולה היום.', success: 'נתון אחד נבדק ונרשם.', resistance: 'פחד מטעות כספית — ניסוי קטן.', pain: 'מפחית חרדה מכישלון פיננסי ומאפשר מגע בטוח.'},
      {title: 'Check one money number only — no full plan today', description: '8 minutes: information experiment — no big decision required.', success: 'One number checked and noted.', resistance: 'Fear of money mistakes — small trial.', pain: 'Reduces financial failure anxiety and enables safe contact.'}
    ),
    career: seed(8,
      {title: 'שלח טיוטה לא מושלמת של הודעה אחת — ניסוי', description: '8 דקות: ניסוי שליחה בלי שלמות — רק לבדוק תגובה.', success: 'טיוטה נשלחה או מוכנה לשליחה.', resistance: 'פחד מביקורת — ניסוי בלי התחייבות.', pain: 'מקטין פחד מכישלון מקצועי דרך ניסוי קטן.'},
      {title: 'Send one imperfect message draft — as an experiment', description: '8 minutes: send trial without perfection — just test response.', success: 'Draft sent or ready to send.', resistance: 'Fear of criticism — low-commitment trial.', pain: 'Shrinks professional failure fear via a small experiment.'}
    ),
    relationships: seed(8,
      {title: 'שלח "היי, חשבתי עליך" — בלי שיחה ארוכה', description: '8 דקות: ניסוי קשר קטן בלי התחייבות לשיחה מלאה.', success: 'הודעה קצרה נשלחה.', resistance: 'פחד מדחייה — ניסוי מינימלי.', pain: 'מפחית פחד מכישלון חברתי ומונע ניתוק.'},
      {title: 'Send "thinking of you" — no long conversation required', description: '8 minutes: small connection trial without a full talk.', success: 'Short message sent.', resistance: 'Fear of rejection — minimal trial.', pain: 'Reduces social failure fear and prevents disconnection.'}
    ),
    mind: seed(8,
      {title: 'כתוב 5 שורות ביומן — מותר שיהיו לא מושלמות', description: '8 דקות: ניסוי ביטוי בלי שיפוט — לא חייבים פתרון.', success: '5 שורות כתובות, גם אם מבולבלות.', resistance: 'פחד שזה לא יעזור — ניסוי בלבד.', pain: 'מוריד פחד מכישלון רגשי ומאפשר ביטוי בטוח.'},
      {title: 'Write 5 journal lines — imperfect is allowed', description: '8 minutes: expression trial without judgment — no solution required.', success: '5 lines written, even if messy.', resistance: 'Fear it will not help — experiment only.', pain: 'Shrinks emotional failure fear and enables safe expression.'}
    ),
    spirit: seed(8,
      {title: 'נסה 3 דקות נשימה — בלי ציפייה ל"הצלחה רוחנית"', description: '8 דקות: ניסוי נוכחות קצר, בלי מדידה.', success: '3 דקות ניסיון בוצעו.', resistance: 'פחד שלא אצליח "להתחבר" — ניסוי.', pain: 'מפחית לחץ להצלחה רוחנית ומאפשר ניסוי עדין.'},
      {title: 'Try 3 minutes of breathing — no spiritual success required', description: '8 minutes: short presence trial, no scoring.', success: '3-minute trial completed.', resistance: 'Fear of not connecting — experiment.', pain: 'Reduces pressure for spiritual success and allows gentle trial.'}
    ),
    house_family: seed(8,
      {title: 'סדר מגש אחד בלבד — ניסוי בלי לסדר את כל הבית', description: '8 דקות: ניסוי קטן — מותר לעצור אחרי מגש אחד.', success: 'מגש אחד סודר.', resistance: 'פחד שלא אספיק — ניסוי מוגבל.', pain: 'מקטין פחד מכישלון ביתי ומאפשר התחלה בטוחה.'},
      {title: 'Tidy one tray only — experiment without cleaning the whole home', description: '8 minutes: small trial — you may stop after one tray.', success: 'One tray tidied.', resistance: 'Fear of not finishing — bounded trial.', pain: 'Shrinks household failure fear and enables safe start.'}
    ),
  },
  lack_of_clarity: {
    health: seed(10,
      {title: 'רשום 3 אפשרויות לארוחה/תזונה להיום ובחר אחת', description: '10 דקות: מיפוי + בחירה — לא תכנון מושלם.', success: '3 אפשרויות כתובות ואחת נבחרה.', resistance: 'לא ברור מה לעשות — מיפוי קודם.', pain: 'מפחית חוסר בהירות סביב תזונה ומונע עמידה במקום.'},
      {title: 'List 3 meal/nutrition options for today and pick one', description: '10 minutes: map + choose — not perfect planning.', success: '3 options listed and one chosen.', resistance: 'Unclear next move — map first.', pain: 'Reduces nutrition confusion and prevents standing still.'}
    ),
    time: seed(10,
      {title: 'רשום 3 משימות אפשריות להיום וסמן אחת כראשונה', description: '10 דקות: מיפוי עדיפויות — בחירה אחת ברורה.', success: '3 משימות ממופות ואחת מסומנת.', resistance: 'עומס לא ברור — מיפוי לפני פעולה.', pain: 'מקטין ערפל זמני ומאפשר התחלה ממוקדת.'},
      {title: 'List 3 possible tasks for today and mark one as first', description: '10 minutes: priority map — one clear choice.', success: '3 tasks mapped and one marked.', resistance: 'Unclear overload — map before action.', pain: 'Shrinks time fog and enables focused start.'}
    ),
    wealth: seed(10,
      {title: 'רשום 3 פעולות כסף קטנות אפשריות ובחר אחת', description: '10 דקות: מיפוי אפשרויות — לא אסטרטגיה מלאה.', success: '3 פעולות כתובות ואחת נבחרה.', resistance: 'חוסר בהירות פיננסית — בחירה קטנה.', pain: 'מוריד ערפל כספי ומונע הימנעות מניהול.'},
      {title: 'List 3 small money actions and choose one', description: '10 minutes: option map — not a full strategy.', success: '3 actions listed and one chosen.', resistance: 'Financial fog — small choice.', pain: 'Reduces money confusion and prevents admin avoidance.'}
    ),
    career: seed(10,
      {title: 'רשום 3 צעדי עבודה אפשריים ובחר את הקטן ביותר', description: '10 דקות: מיפוי + בחירת צעד ראשון ברור.', success: '3 צעדים ממופים ואחד נבחר.', resistance: 'לא ברור מה קדום — מיפוי.', pain: 'מקטין חוסר בהירות מקצועי ומחזיר תנועה.'},
      {title: 'List 3 possible work moves and pick the smallest', description: '10 minutes: map + clear first-step choice.', success: '3 moves mapped and one chosen.', resistance: 'Unclear priority — mapping.', pain: 'Shrinks career confusion and restores motion.'}
    ),
    relationships: seed(10,
      {title: 'רשום 3 אנשים שאפשר ליצור איתם קשר ובחר אחד', description: '10 דקות: מיפוי קשרים + בחירה אחת להיום.', success: '3 אנשים ברשימה ואחד נבחר.', resistance: 'לא ברור למי לפנות — מיפוי.', pain: 'מפחית בלבול חברתי ומונע בידוד.'},
      {title: 'List 3 people you could reach and pick one', description: '10 minutes: relationship map + one choice for today.', success: '3 people listed and one chosen.', resistance: 'Unclear who to contact — map.', pain: 'Reduces social confusion and prevents isolation.'}
    ),
    mind: seed(10,
      {title: 'רשום 3 דברים שמעסיקים אותך ובחר אחד לכתיבה קצרה', description: '10 דקות: מיפוי מחשבות + בחירה מה לשחרר קודם.', success: '3 נושאים כתובים ואחד נבחר.', resistance: 'ערפל מחשבתי — מיפוי לפני פתרון.', pain: 'מקטין חוסר בהירות פנימי ומאפשר התחלה.'},
      {title: 'List 3 things on your mind and pick one to write briefly', description: '10 minutes: thought map + choose what to unload first.', success: '3 topics listed and one chosen.', resistance: 'Mental fog — map before solving.', pain: 'Shrinks inner confusion and enables a start.'}
    ),
    spirit: seed(8,
      {title: 'רשום 3 דברים שמזינים אותך רוחנית ובחר אחד ל-8 דקות', description: '8 דקות: מיפוי + בחירה — לא חיפוש מושלם.', success: '3 אפשרויות כתובות ואחת נבחרה.', resistance: 'לא ברור מה מחזק — מיפוי.', pain: 'מפחית חוסר בהירות רוחני ומחזיר נוכחות.'},
      {title: 'List 3 things that nourish you spiritually and pick one for 8 minutes', description: '8 minutes: map + choose — not a perfect search.', success: '3 options listed and one chosen.', resistance: 'Unclear what helps — mapping.', pain: 'Reduces spiritual confusion and restores presence.'}
    ),
    house_family: seed(10,
      {title: 'רשום 3 אזורים בבית שמפריעים ובחר אחד לשיפור קטן', description: '10 דקות: מיפוי + בחירת אזור אחד.', success: '3 אזורים כתובים ואחד נבחר.', resistance: 'לא ברור מה לסדר — מיפוי.', pain: 'מקטין עומס החלטות ביתי ומאפשר צעד ראשון.'},
      {title: 'List 3 bothersome home areas and pick one small fix', description: '10 minutes: map + choose one area.', success: '3 areas listed and one chosen.', resistance: 'Unclear what to tidy — map.', pain: 'Shrinks household decision load and enables first step.'}
    ),
  },
  fatigue: {
    health: seed(8,
      {title: 'שתה כוס מים ושב 5 דקות — פעולה פסיבית לגוף', description: '8 דקות: סביבתית/מנוחה — בלי מאמץ אינטנסיבי.', success: 'מים שתית ו-5 דקות מנוחה בוצעו.', resistance: 'עייפות — רק פעולה פסיבית.', pain: 'מקטין לחץ על הגוף בעייפות ומונע ויתור מלא.'},
      {title: 'Drink water and sit 5 minutes — passive body action', description: '8 minutes: environmental/rest — no intense effort.', success: 'Water drunk and 5 minutes rest done.', resistance: 'Fatigue — passive action only.', pain: 'Reduces body pressure when tired and prevents total skip.'}
    ),
    time: seed(5,
      {title: 'סמן בלוח משבצת 10 דקות מחר — פעולה סביבתית', description: '5 דקות: הכנת סביבה ליום הבא, בלי עבודה עכשיו.', success: 'משבצת זמן נקבעה בלוח.', resistance: 'עייפות — לא לעבוד עכשיו.', pain: 'שומר מומנטום בלי לדרוש אנרגיה עכשיו.'},
      {title: 'Block 10 minutes on tomorrow\'s calendar — environmental action', description: '5 minutes: prep environment for tomorrow, no work now.', success: 'Time block placed on calendar.', resistance: 'Fatigue — no work now.', pain: 'Preserves momentum without demanding energy now.'}
    ),
    wealth: seed(5,
      {title: 'פתח אפליקציה פיננסית וסמן תזכורת לבדיקה מחר', description: '5 דקות: פעולה סביבתית — לא ניתוח עכשיו.', success: 'תזכורת נקבעה.', resistance: 'עייפות — דחייה מכבדת.', pain: 'מונע הימנעות מלאה מכסף בעייפות.'},
      {title: 'Open finance app and set a reminder to check tomorrow', description: '5 minutes: environmental action — no analysis now.', success: 'Reminder set.', resistance: 'Fatigue — respectful deferral.', pain: 'Prevents total money avoidance when tired.'}
    ),
    career: seed(5,
      {title: 'סגור טאבים מיותרים והשאר רק משימה אחת פתוחה', description: '5 דקות: סביבה דיגיטלית נקייה — פסיבי/סביבתי.', success: 'רק משימה אחת פתוחה על המסך.', resistance: 'עייפות — הפחתת עומס ויזואלי.', pain: 'מקטין עומס קוגניטיבי בעייפות.'},
      {title: 'Close extra tabs and leave only one task open', description: '5 minutes: clean digital environment — passive/setup.', success: 'Only one task tab remains open.', resistance: 'Fatigue — reduce visual load.', pain: 'Shrinks cognitive load when depleted.'}
    ),
    relationships: seed(5,
      {title: 'שלח אימוג׳י אחד לאדם קרוב — פעולה מינימלית', description: '5 דקות: קשר פסיבי/קל — בלי שיחה ארוכה.', success: 'אימוג׳י או הודעה קצרה נשלחה.', resistance: 'אין אנרגיה לשיחה — מינימום.', pain: 'שומר קשר בלי לדרוש אנרגיה גבוהה.'},
      {title: 'Send one emoji to someone close — minimal action', description: '5 minutes: light/passive connection — no long talk.', success: 'Emoji or tiny message sent.', resistance: 'No energy for a call — minimum.', pain: 'Maintains connection without high energy cost.'}
    ),
    mind: seed(8,
      {title: 'האזן 8 דקות למוזיקה שקטה — פעולה פסיבית', description: '8 דקות: מנוחה מודרכת, בלי כתיבה או פתרון.', success: '8 דקות האזנה בוצעו.', resistance: 'מוח עייף — פסיבי בלבד.', pain: 'מאפשר רגיעה בלי לדרוש מאמץ מחשבתי.'},
      {title: 'Listen to calm music for 8 minutes — passive action', description: '8 minutes: guided rest, no writing or solving.', success: '8 minutes of listening done.', resistance: 'Tired mind — passive only.', pain: 'Allows rest without demanding mental effort.'}
    ),
    spirit: seed(8,
      {title: 'הדלק נר / שב ליד חלון 8 דקות — פעולה סביבתית', description: '8 דקות: יצירת אווירה שקטה, בלי מדיטציה מורכבת.', success: '8 דקות בשקט סביבתי.', resistance: 'עייפות — סביבה במקום מאמץ.', pain: 'מחזיר נוכחות עדינה בלי לדרוש אנרגיה.'},
      {title: 'Light a candle / sit by window 8 minutes — environmental', description: '8 minutes: create quiet atmosphere, no complex meditation.', success: '8 minutes in environmental quiet.', resistance: 'Fatigue — environment over effort.', pain: 'Restores gentle presence without energy demand.'}
    ),
    house_family: seed(5,
      {title: 'הנח כלי אחד במקום הנכון — פעולה סביבתית קטנה', description: '5 דקות: שיפור סביבה מינימלי, בלי ניקיון מלא.', success: 'פריט אחד הוחזר למקום.', resistance: 'עייפות — מינימום בלבד.', pain: 'מקטין כאוס סביבתי בלי לדרוש השקעה גדולה.'},
      {title: 'Put one item back in its place — small environmental action', description: '5 minutes: minimal environment improvement, not full clean.', success: 'One item returned to place.', resistance: 'Fatigue — minimum only.', pain: 'Shrinks environmental chaos without large effort.'}
    ),
  },
  procrastination: {
    health: seed(2,
      {title: '2 דקות: הנעל נעליים או מלא כוס מים — רק התחלה', description: '2 דקות: התחלת שרשרת — לא אימון מלא.', success: '2 דקות התחלה בוצעו.', resistance: 'דחיינות — רק 2 דקות מותרות.', pain: 'שובר הימנעות דרך חיכוך נמוך מאוד.'},
      {title: '2 minutes: put on shoes or fill a water glass — start only', description: '2 minutes: chain start — not a full workout.', success: '2-minute start done.', resistance: 'Procrastination — only 2 minutes allowed.', pain: 'Breaks avoidance via very low friction.'}
    ),
    time: seed(2,
      {title: '2 דקות: פתח את המשימה וכתוב משפט אחד', description: '2 דקות: התחלה מיקרוסקופית — מותר לעצור.', success: 'משימה נפתחה ומשפט אחד נכתב.', resistance: 'דחיינות — 2 דקות בלבד.', pain: 'מוריד חיכוך התחלה ומונע דחייה מלאה.'},
      {title: '2 minutes: open the task and write one sentence', description: '2 minutes: microscopic start — stopping is allowed.', success: 'Task opened and one sentence written.', resistance: 'Procrastination — 2 minutes only.', pain: 'Reduces start friction and prevents full delay.'}
    ),
    wealth: seed(2,
      {title: '2 דקות: פתח אפליקציה בנקאית וצפה ביתרה', description: '2 דקות: מגע מינימלי — לא תכנון.', success: 'אפליקציה נפתחה ויתרה נצפתה.', resistance: 'הימנעות — 2 דקות בלבד.', pain: 'שובר הימנעות פיננסית בחיכוך נמוך.'},
      {title: '2 minutes: open banking app and view balance', description: '2 minutes: minimal contact — no planning.', success: 'App opened and balance viewed.', resistance: 'Avoidance — 2 minutes only.', pain: 'Breaks financial avoidance at low friction.'}
    ),
    career: seed(2,
      {title: '2 דקות: פתח מייל אחד וכתוב שורת נושא', description: '2 דקות: התחלה בלבד — לא שליחה.', success: 'מייל נפתח ושורת נושא נכתבה.', resistance: 'דחיינות — 2 דקות.', pain: 'מקטין דחיינות עבודה דרך צעד ראשון זעיר.'},
      {title: '2 minutes: open one email and write the subject line', description: '2 minutes: start only — no send required.', success: 'Email opened and subject drafted.', resistance: 'Procrastination — 2 minutes.', pain: 'Shrinks work procrastination via tiny first step.'}
    ),
    relationships: seed(2,
      {title: '2 דקות: פתח צ\'אט וכתוב "היי"', description: '2 דקות: התחלת שיחה — מותר לא לשלוח עדיין.', success: '"היי" כתוב בטיוטה.', resistance: 'דחיינות חברתית — 2 דקות.', pain: 'מונע ניתוק מדחיינות בחיכוך מינימלי.'},
      {title: '2 minutes: open chat and type "hi"', description: '2 minutes: conversation start — sending optional.', success: '"Hi" typed in draft.', resistance: 'Social procrastination — 2 minutes.', pain: 'Prevents disconnection from procrastination at minimal friction.'}
    ),
    mind: seed(2,
      {title: '2 דקות: פתח מסמך וכתוב מילה אחת על מה מפריע', description: '2 דקות: התחלת ביטוי — לא יומן מלא.', success: 'מילה אחת או משפט קצר נכתב.', resistance: 'דחיינות — 2 דקות בלבד.', pain: 'שובר הימנעות רגשית בצעד זעיר.'},
      {title: '2 minutes: open doc and write one word about what bothers you', description: '2 minutes: expression start — not a full journal.', success: 'One word or short line written.', resistance: 'Procrastination — 2 minutes only.', pain: 'Breaks emotional avoidance with a tiny step.'}
    ),
    spirit: seed(2,
      {title: '2 דקות: שב, נשום 3 פעמים — התחלה בלבד', description: '2 דקות: נוכחות מיקרוסקופית.', success: '3 נשימות בוצעו.', resistance: 'דחיינות — 2 דקות.', pain: 'מחזיר נוכחות בלי לדרוש מדיטציה ארוכה.'},
      {title: '2 minutes: sit, breathe 3 times — start only', description: '2 minutes: microscopic presence.', success: '3 breaths completed.', resistance: 'Procrastination — 2 minutes.', pain: 'Restores presence without requiring long meditation.'}
    ),
    house_family: seed(2,
      {title: '2 דקות: הרם פריט אחד מהרצפה לשולחן', description: '2 דקות: התחלת סידור — פריט אחד בלבד.', success: 'פריט אחד הוזז.', resistance: 'דחיינות — 2 דקות.', pain: 'שובר הימנעות מסידור בחיכוך נמוך.'},
      {title: '2 minutes: lift one item from floor to table', description: '2 minutes: tidy start — one item only.', success: 'One item moved.', resistance: 'Procrastination — 2 minutes.', pain: 'Breaks tidy avoidance at low friction.'}
    ),
  },
};

function withStrategy(kind: ActionPatternKind, seedData: PatternSeed): PatternCopySet {
  const strategy = STRATEGY_BY_KIND[kind];
  return {
    he: {...seedData.he, strategy: strategy.he},
    en: {...seedData.en, strategy: strategy.en},
  };
}

export function getActionPatternCopy(
  kind: ActionPatternKind,
  domain: LifeDomain,
  locale: AppLocale
): LocalizedPatternCopy & {estimated_minutes: number} {
  const seedData = PATTERN_LIBRARY[kind][domain] ?? PATTERN_LIBRARY[kind].mind;
  const copy = withStrategy(kind, seedData)[locale];
  return {...copy, estimated_minutes: seedData.minutes};
}

export function listPatternsForKind(
  kind: ActionPatternKind,
  domain: LifeDomain,
  locale: AppLocale
): Array<LocalizedPatternCopy & {estimated_minutes: number; pattern_id: string}> {
  const primary = getActionPatternCopy(kind, domain, locale);
  const altKind: ActionPatternKind =
    kind === 'procrastination' ? 'no_time' : kind === 'fatigue' ? 'lack_of_clarity' : 'procrastination';
  const alt = getActionPatternCopy(altKind, domain, locale);
  return [
    {...primary, pattern_id: `${kind}:${domain}:primary`},
    {...alt, pattern_id: `${altKind}:${domain}:alt`},
  ];
}

export const ACTION_PATTERNS_PROMPT_BLOCK = [
  '## Action Patterns toolbox (REQUIRED):',
  'The payload includes action_pattern_toolbox — proven templates by domain + blocker.',
  'Do NOT invent tasks from scratch when a matching pattern exists.',
  'Pick the best pattern for the user\'s primary_blocker, adapt title/description to their active goal, and fill pain_addressed.',
  'Blocker → strategy mapping:',
  '- no_time → short prep / pre-decision / 5-minute action',
  '- fear_of_failure → small experiment without commitment',
  '- lack_of_clarity → mapping / choice among options',
  '- fatigue → passive or environmental action',
  '- procrastination → 2-minute start only',
  'If you adapt a pattern, keep the strategy — change wording to match goal title and weekly focus.',
].join('\n');
