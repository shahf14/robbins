export type AppRoute =
  | '/'
  | '/coach'
  | '/life-coach'
  | '/clarification'
  | '/morning-priming'
  | '/evening-reset'
  | '/settings';

export type StartMode = 'new' | 'stuck' | 'builder';

export type ModeConfig = {
  label: string;
  title: string;
  body: string;
  plan: string[];
  href: AppRoute;
  cta: string;
};

export type StartHereContent = {
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: string;
  primaryCtaHint: string;
  secondaryCta: string;
  secondaryCtaHint: string;
  promise: string;
  modesTitle: string;
  modes: Record<StartMode, ModeConfig>;
  rhythmEyebrow: string;
  rhythmTitle: string;
  rhythmBody: string;
  rhythmOpenNow: string;
  rhythm: Array<{time: string; title: string; body: string; href: AppRoute}>;
  mapTitle: string;
  mapBody: string;
  features: Array<{title: string; body: string; best: string; href: AppRoute; cta: string; icon: string}>;
  principlesTitle: string;
  principles: Array<{title: string; body: string}>;
  playbookTitle: string;
  playbook: Array<{title: string; body: string}>;
  accordionTapHint: string;
  masteryTitle: string;
  masteryBody: string;
  mastery: string[];
  masteryProgress: string;
  finalTitle: string;
  finalBody: string;
  finalCta: string;
  navRhythm: string;
  navFeatures: string;
  navGuides: string;
  navMastery: string;
  progressLabel: string;
};

const heModes: Record<StartMode, ModeConfig> = {
  new: {
    label: 'אני חדש כאן',
    title: 'מסלול היכרות מהיר',
    body: 'תן לעצמך 10 דקות להכיר את המערכת דרך פעולה, לא דרך קריאה אינסופית.',
    plan: [
      'התחל בטקס בוקר כדי לייצב אנרגיה וכוונה.',
      'עשה צ׳ק-אין כן כדי שהאתר יבין את מצבך הנוכחי.',
      'בחר תחום חיים אחד ובנה מטרה ראשונה.',
    ],
    href: '/morning-priming',
    cta: 'התחל בטקס בוקר',
  },
  stuck: {
    label: 'אני תקוע',
    title: 'מסלול יציאה מתקיעות',
    body: 'כשאין אנרגיה, לא מחפשים תוכנית גדולה. מחפשים אמת אחת וצעד אחד שאפשר לבצע.',
    plan: [
      'פתח צ׳ק-אין ותכתוב מה באמת קורה בלי לייפות.',
      'דבר עם המאמן כדי לפרק את הערפל לשאלה אחת מדויקת.',
      'בחר צעד של 2-10 דקות ושמור על הרצף.',
    ],
    href: '/coach',
    cta: 'דבר עם המאמן',
  },
  builder: {
    label: 'אני רוצה לבנות מומנטום',
    title: 'מסלול ביצוע יומי',
    body: 'כאן האתר הופך למכונת התקדמות: מטרות ארוכות טווח שמתפרקות לצעדים קטנים ואמיתיים.',
    plan: [
      'הגדר יעד בתחום אחד שאתה מוכן לקחת ברצינות.',
      'צור צעדי תינוק יומיים וסמן ביצוע בלי דרמה.',
      'בסוף היום בצע איפוס קצר כדי שהמערכת תלמד ותתאים את מחר.',
    ],
    href: '/life-coach',
    cta: 'פתח מטרות',
  },
};

export const heContent: StartHereContent = {
  eyebrow: 'התחל כאן',
  title: 'ברוך הבא למערכת ההפעלה האישית שלך.',
  intro:
    'המטרה של האתר אינה שתמלא עוד טפסים. המטרה היא להפוך רצון מעורפל לתנועה יומית ברורה: להבין איפה אתה נמצא, לבחור כיוון, לבצע צעד קטן, ללמוד מהיום, ולהגיע מחר חד יותר.',
  primaryCta: 'פתח את היום שלי',
  primaryCtaHint: 'לוח הבקרה והצעד הבא שלך',
  secondaryCta: 'בנה מטרה ראשונה',
  secondaryCtaHint: 'הגדרת יעד ראשון בתחום חיים אחד',
  promise:
    'אם תשתמש בעמוד הזה כמצפן, תדע תמיד מה לעשות עכשיו, למה זה חשוב, ואיזה פיצ׳ר ייתן לך את המינוף הכי גבוה.',
  modesTitle: 'בחר איך אתה נכנס היום',
  modes: heModes,
  rhythmEyebrow: 'שגרה יומית',
  rhythmTitle: 'השגרה שמוציאה 100% מהאתר',
  rhythmBody: 'לא צריך להשתמש בכל דבר כל הזמן. צריך להשתמש בכלי הנכון ברגע הנכון.',
  rhythmOpenNow: 'פתח עכשיו',
  rhythm: [
    {time: 'בוקר · 3-7 דקות', title: 'טקס בוקר', body: 'מייצב את המערכת, מחדד כוונה, ומכניס אותך ליום מתוך בחירה במקום תגובה.', href: '/morning-priming'},
    {time: 'תחילת עבודה · 2 דקות', title: 'צ׳ק-אין יומי', body: 'מודד אנרגיה, פוקוס ומומנטום. זה הדלק שמאפשר לאפליקציה להתאים את ההמלצות אליך.', href: '/'},
    {time: 'היום עצמו · 5-30 דקות', title: 'צעדי תינוק', body: 'החלק שבו החיים זזים. לא משימה מושלמת, אלא פעולה קטנה שמוכיחה לזהות שלך שאתה מתקדם.', href: '/life-coach'},
    {time: 'כשתקוע · לפי הצורך', title: 'מאמן וירטואלי', body: 'מקום לחשוב בקול, לפרק חסמים, לקבל ניסוח חד או למצוא את הצעד הבא כשאין בהירות.', href: '/coach'},
    {time: 'ערב · 3-6 דקות', title: 'איפוס ערב', body: 'סוגר לולאה: מה עבד, מה הפריע, ומה לקחת למחר בלי לסחוב את כל היום על הגב.', href: '/evening-reset'},
  ],
  mapTitle: 'מפת הפיצ׳רים',
  mapBody: 'כל פיצ׳ר באתר בנוי לתפקיד אחר. כשאתה יודע איזה כלי פותר איזה מצב, הכול נהיה פשוט יותר.',
  features: [
    {title: 'היום', icon: '📊', body: 'לוח הבקרה היומי שלך: פעולה ראשית, מומנטום, רצף, מדדים וקיצורי דרך.', best: 'פתח ראשון בכל יום.', href: '/', cta: 'לעמוד היום'},
    {title: 'צ׳ק-אין', icon: '⚡', body: 'קריאה אמיתית של המצב שלך. האנרגיה, הפוקוס והמומנטום כאן משפיעים על ההכוונה.', best: 'כשהראש עמוס או כשצריך בהירות.', href: '/', cta: 'עשה צ׳ק-אין'},
    {title: 'מטרות', icon: '🎯', body: 'הופך חזון לתחומי חיים, מטרות, אבני דרך וצעדים יומיים מותאמים.', best: 'כשרוצים לבנות שינוי אמיתי לאורך זמן.', href: '/life-coach', cta: 'בנה מטרה'},
    {title: 'הבהרה', icon: '🔍', body: 'מרחב שאלות עמוק שמחדד מה באמת חשוב, איפה התקיעות ומה היעד הנכון.', best: 'לפני מטרה גדולה או כשיש הרבה רעש פנימי.', href: '/clarification', cta: 'פתח הבהרה'},
    {title: 'מאמן', icon: '💬', body: 'שיחה ממוקדת עם AI כדי לחשוב טוב יותר, לא רק לקבל תשובה.', best: 'כשצריך ניסוח, אומץ, החלטה או פירוק חסם.', href: '/coach', cta: 'פתח מאמן'},
    {title: 'בוקר', icon: '🌅', body: 'ריטואל קצר לכוונה, הודיה, נשימה והתחלה יציבה.', best: 'לפני שהיום מתחיל לקחת אותך איתו.', href: '/morning-priming', cta: 'פתח בוקר'},
    {title: 'ערב', icon: '🌙', body: 'סגירת יום, למידה ותכנון קל למחר.', best: 'כשאתה רוצה לישון נקי יותר ולהגיע מוכן למחר.', href: '/evening-reset', cta: 'פתח ערב'},
    {title: 'הגדרות', icon: '⚙️', body: 'שם, שפה, שעות, סגנון אימון והעדפות שמשפיעות על ההתאמה האישית.', best: 'אחרי ההיכרות הראשונית, כדי לדייק את המערכת אליך.', href: '/settings', cta: 'פתח הגדרות'},
  ],
  principlesTitle: 'כללי הזהב',
  principles: [
    {title: 'קטן מספיק כדי לעשות היום', body: 'המערכת מנצחת דרך עקביות, לא דרך התלהבות של יום אחד.'},
    {title: 'אמת לפני אופטימיות', body: 'צ׳ק-אין כן שווה יותר מתוכנית נוצצת שלא מחוברת למציאות.'},
    {title: 'לא לשבור פעמיים', body: 'יום קשה אינו כישלון. המיומנות היא לחזור מהר, אפילו בצעד זעיר.'},
    {title: 'האתר לומד ממך', body: 'ככל שתסמן צעדים, תכתוב רפלקציות ותעדכן מטרות, ההכוונה נעשית מדויקת יותר.'},
  ],
  playbookTitle: 'מה עושים בכל מצב',
  playbook: [
    {title: 'אין לי כוח', body: 'פתח את היום, בחר צעד אחד קל, או בקש מהמאמן לפרק אותו לגרסה של 2 דקות.'},
    {title: 'יש לי המון רעיונות', body: 'לך להבהרה, תזקק יעד אחד, ואז בנה אותו כמטרה בתחום חיים אחד.'},
    {title: 'אני מרגיש שאני לא מתקדם', body: 'בדוק את הסקירה, הרפלקציות והצעדים שהושלמו. המטרה היא לזהות דפוס, לא להאשים.'},
    {title: 'אני רוצה שינוי גדול', body: 'פתח מטרות, בחר תחום אחד, צור תוכנית 90 יום ותן לצעדים היומיים לעשות את העבודה.'},
  ],
  accordionTapHint: 'לחץ לפתיחה',
  masteryTitle: 'מדד שליטה',
  masteryBody: 'הנה סימנים שאתה משתמש באתר כמו שצריך:',
  mastery: [
    'אתה יודע מה הצעד הבא שלך בלי לפתוח עשרה טאבים בראש.',
    'יש לך לפחות מטרה אחת פעילה שמחוברת לערך אמיתי.',
    'אתה מסמן ביצוע גם כשהביצוע לא מושלם.',
    'אתה משתמש בערב כדי ללמוד, לא כדי לשפוט את עצמך.',
    'כשאתה נופל, אתה חוזר דרך צעד קטן ולא דרך הבטחה ענקית.',
  ],
  masteryProgress: '{done} מתוך {total} סימנים',
  finalTitle: 'המהלך הבא שלך פשוט.',
  finalBody:
    'אל תנסה להיות גרסה חדשה של עצמך בעוד שעה. תן לאתר לעזור לך לנצח את היום הקרוב. יום ועוד יום הופכים לזהות. זה המשחק.',
  finalCta: 'קח אותי לצעד הבא',
  navRhythm: 'שגרה',
  navFeatures: 'מפה',
  navGuides: 'מדריכים',
  navMastery: 'שליטה',
  progressLabel: 'שלב {done} מתוך {total} הושלם',
};

export const enContent: StartHereContent = {
  ...heContent,
  eyebrow: 'Start here',
  title: 'Welcome to your personal operating system.',
  intro:
    'This page turns the app into a clear path: read your state, choose direction, take one small action, learn from the day, and come back sharper tomorrow.',
  primaryCta: 'Open today',
  primaryCtaHint: 'Your dashboard and next step',
  secondaryCta: 'Build first goal',
  secondaryCtaHint: 'Set your first goal in one life domain',
  promise:
    'Use this page as your compass: what to do now, why it matters, and which feature gives you the highest leverage.',
  modesTitle: 'Choose how you enter today',
  modes: {
    new: {...heModes.new, label: 'I am new', title: 'Quick orientation path', cta: 'Start morning ritual'},
    stuck: {...heModes.stuck, label: 'I feel stuck', title: 'Unstuck path', cta: 'Talk to the coach'},
    builder: {...heModes.builder, label: 'I want momentum', title: 'Daily execution path', cta: 'Open goals'},
  },
  rhythmEyebrow: 'Daily rhythm',
  rhythmTitle: 'The rhythm that unlocks the app',
  rhythmBody: 'You do not need every tool all the time. Use the right tool at the right moment.',
  rhythmOpenNow: 'Open now',
  mapTitle: 'Feature map',
  mapBody: 'Every feature has a job. Once you know which tool solves which moment, the app becomes simple.',
  principlesTitle: 'Golden rules',
  playbookTitle: 'What to do when',
  accordionTapHint: 'Tap to expand',
  masteryTitle: 'Mastery signals',
  masteryBody: 'You are using the app well when:',
  masteryProgress: '{done} of {total} signals',
  finalTitle: 'Your next move is simple.',
  finalBody: 'Do not try to become a new person in an hour. Win the next day. Day after day becomes identity.',
  finalCta: 'Take me to the next step',
  navRhythm: 'Rhythm',
  navFeatures: 'Map',
  navGuides: 'Guides',
  navMastery: 'Mastery',
  progressLabel: 'Step {done} of {total} complete',
};

export const MODE_ACCENT: Record<StartMode, {border: string; bar: string}> = {
  new: {border: 'border-[var(--blue)]/45', bar: 'bg-[var(--blue)]'},
  stuck: {border: 'border-[var(--orange)]/45', bar: 'bg-[var(--orange)]'},
  builder: {border: 'border-emerald-500/45', bar: 'bg-emerald-500'},
};

export const FEATURE_BORDER_COLORS = [
  'border-t-[var(--blue)]',
  'border-t-[var(--orange)]',
  'border-t-emerald-500',
  'border-t-violet-500',
  'border-t-amber-500',
  'border-t-rose-500',
  'border-t-cyan-500',
  'border-t-slate-400',
];
