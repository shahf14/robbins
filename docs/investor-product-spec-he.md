# מסמך אפיון למשקיע - אפליקציית רובינס

תאריך עדכון: 7 ביוני 2026  
סטטוס: אב-טיפוס מוצרי מתקדם, local-first, עם תשתית Next.js, SQLite מקומי, תמיכה ב-AI, onboarding חדש, דשבורד אישי, טקס בוקר, איפוס ערב, מאמן מטרות ותשתית ראשונית למובייל/תשלומים/Push.

## תקציר מנהלים

אפליקציית רובינס היא מערכת אימון אישי יומית בעברית ובאנגלית, שמטרתה להפוך שינוי אישי מתוכן השראתי או שיחה כללית לתהליך ביצועי קבוע: בירור מצב, בחירת תחום חיים, יצירת מטרה, צעד ראשון מיידי, צעדים יומיים, טקסי בוקר וערב, צ׳ק-אין, רפלקציה ותובנות AI.

מאז מסמך האפיון הקודם נוספו כמה שכבות מוצריות משמעותיות:

1. Onboarding חדש שמוביל משתמש חדש דרך בחירת תחום, דירוג תחומי חיים, שאלות עומק, insight אישי, יצירת מטרה וצעד ראשון.
2. דשבורד בית חדש במבנה "Personal OS", עם Momentum Score, פעולה מרכזית, התקדמות מטרה, KPI strip וקיצורי כלים.
3. איפוס ערב חדש עם מצבי quick/standard/deep, סקירת ניצחון יומי, חסמים, gratitude, insight, תכנון ניצחון למחר, הכנת סביבה ו-readiness score.
4. מערכת Feature Unlock הדרגתית להפחתת עומס פיצ׳רים: פתיחה של יכולות לפי ימים מה-onboarding.
5. תשתית גישה מהאייפון באמצעות Tailscale, פתיחת firewall ושרת dev על `0.0.0.0:3000`.
6. הרחבת סכמת הנתונים עם `evening_resets`, `subscriptions` ו-`push_subscriptions`.

המשמעות למשקיע: המוצר התקדם מאוסף פיצ׳רים של coaching לאב-טיפוס של מערכת שינוי יומית שלמה. הוא כבר לא רק "מאמן AI", אלא מערכת שמנסה לנהל את המחזור היומי המלא של משתמש: התחלה, ביצוע, סיום, למידה וחזרה.

## מטרת המוצר

המטרה המרכזית היא להגדיל את הסיכוי שמשתמש יבצע שינוי אמיתי לאורך זמן, על ידי הפיכת מטרות גדולות ליחידות פעולה קטנות, מדידות ומותאמות למצבו היומי.

מטרות משנה:

- להפחית חיכוך בכניסה ראשונה באמצעות onboarding שמייצר ערך תוך דקות.
- להפוך "אני רוצה להשתנות" ל"זה הצעד שלי היום".
- להציג למשתמש תמונת מומנטום פשוטה במקום עומס נתונים.
- לייצר שגרות יומיות בבוקר ובערב שמחברות state, identity ו-execution.
- ללמוד מדפוסי ביצוע, דילוגים, חסמים ורפלקציות.
- לבנות מוצר עברי טבעי, RTL, שמרגיש מקומי ולא מתורגם.
- ליצור בסיס עתידי למודל subscription ולתזכורות push.

## הבעיה שהמוצר פותר

רוב המשתמשים אינם נכשלים כי חסר להם ידע. הם נכשלים כי קשה להם לתרגם ידע להתנהגות יומיומית. הבעיה מורכבת מכמה שכבות:

- מטרות גדולות מדי, מופשטות מדי, או לא מחוברות לפעולה מיידית.
- עומס פיצ׳רים באפליקציות שיפור עצמי שגורם לנטישה כבר ביום הראשון.
- פער בין מוטיבציה רגעית לבין מערכת ביצוע מתמשכת.
- חוסר התאמה בין תוכנית קבועה לבין ימים חלשים, אנרגיה נמוכה וחסמים אמיתיים.
- אפליקציות wellness שמרגיעות, אך לא בהכרח מובילות להתקדמות מדידה.
- צ׳אטבוטים כלליים שנותנים עצות, אך לא מחזיקים היסטוריית ביצוע, סטטוסים ומחזור יומי.

אפליקציית רובינס פותרת זאת באמצעות לולאה סגורה: הבנה -> מטרה -> צעד -> ביצוע -> רפלקציה -> התאמה.

## קהל יעד

### קהל יעד ראשוני

- משתמשים דוברי עברית שמחפשים מאמן אישי דיגיטלי ולא עוד אפליקציית משימות.
- אנשים שמכירים התפתחות אישית, טוני רובינס, productivity, habit tracking ו-wellness.
- משתמשים שרוצים לעבוד על בריאות, זמן, כסף, קריירה, מערכות יחסים, מיינד, משמעות או בית ומשפחה.
- אנשים שמתקשים להתמיד, במיוחד אחרי ימים חלשים או דילוגים.
- משתמש יחיד/early adopter שמוכן להשתמש ב-PWA או גישה דרך Tailscale בשלב האב-טיפוס.

### קהלים עתידיים

- מאמנים אישיים שרוצים מערכת המשך בין מפגשים.
- קהילות התפתחות אישית וסדנאות.
- יוצרי תוכן עם תוכניות habit/life design.
- עסקים קטנים ובינוניים שרוצים כלי well-being פשוט יותר מפתרונות enterprise.
- משפכים B2B2C שבהם המאמן/הקהילה מביאים את המשתמשים.

## הצעת הערך

### למשתמש

- "אני מקבל צעד אחד ברור במקום להיתקע בתוך מחשבות."
- "האפליקציה זוכרת את המטרות, האנרגיה והחסמים שלי."
- "גם ביום חלש, התוכנית יורדת לגודל שאני יכול לבצע."
- "אני מתחיל את היום עם כיוון ומסיים אותו עם למידה למחר."
- "זה בעברית טבעית, לא מוצר באנגלית שתורגם."

### למשקיע

המוצר ממוקם בין AI coaching, habit systems, wellness rituals ו-goal execution. היתרון אינו רק באיכות ה-AI אלא בחיבור בין UI יומי, נתוני ביצוע, progressive onboarding, שגרות בוקר/ערב ומערכת מטרות.

## מצב מוצר נוכחי

המוצר הוא אב-טיפוס מתקדם ולא מוצר production מלא. קיימים מסכים וזרימות מוצר אמיתיות, אך עדיין נדרשות שכבות מסחריות ואבטחתיות לפני השקה לקהל רחב.

### תשתית קיימת

- Next.js 16, React 19, TypeScript.
- `next-intl` לתמיכה בעברית ואנגלית.
- RTL/LTR לפי locale.
- PWA עם manifest ו-service worker.
- SQLite מקומי דרך `better-sqlite3`.
- API routes עבור coaching, onboarding AI, life coach, formulation, evening reset, check-ins, rituals, DB admin ו-cron.
- OpenAI Responses API כאשר מוגדר `OPENAI_API_KEY`; fallback מקומי כאשר אין מפתח.
- `npm run dev` מריץ שרת על `0.0.0.0:3000`, מתאים לגישה ממכשירים נוספים.
- `run.bat`, `setup-firewall.bat`, `launch.vbs` להפעלה נוחה וגישה מהאייפון דרך Tailscale.

### מגבלות סטטוס

- המוצר עדיין local-first.
- אין עדיין authentication מסחרי מלא למשתמשים מרובים.
- אין billing פעיל, למרות שיש טבלת `subscriptions`.
- אין push flow מלא, למרות שיש טבלת `push_subscriptions`.
- אין הצפנת production, retention policy, export/delete מלא וייעוץ משפטי סופי.
- השם "רובינס" דורש בדיקת סימני מסחר לפני השקה ציבורית.

## פיצ׳רים קיימים

### 1. Onboarding חדש

ה-onboarding הוא שינוי מרכזי שמטפל באחת החולשות הקודמות: עומס פיצ׳רים. במקום לזרוק משתמש חדש לדשבורד, הוא מוביל אותו דרך מסע קצר שמייצר מטרה וצעד ראשון.

שלבים קיימים:

1. פרטים בסיסיים: שם, שפה, שעת קימה, מצב משפחתי אופציונלי וגיל אופציונלי.
2. דירוג 8 תחומי החיים ובחירת תחום ראשון להתמקדות.
3. שאלות עומק: למה התחום חשוב, מה מפריע היום, מה יקרה אם כלום לא ישתנה, ואיך תיראה הצלחה.
4. יצירת insight אישי ב-AI או fallback.
5. יצירת הצעת מטרה ל-90 יום.
6. עריכת כותרת המטרה ואישור.
7. יצירת צעד ראשון שאפשר לבצע תוך פחות מ-5 דקות.
8. סימון הצעד הראשון כהושלם וחגיגת כניסה לאפליקציה.

ערך עסקי:

- מקצר time-to-value.
- יוצר מחויבות ראשונה.
- שומר primary domain להמשך personalization.
- מאפשר Progressive Unlock לפי תאריך השלמת onboarding.

### 2. דשבורד בית חדש - Personal OS

הדשבורד הישן הוחלף/הורחב לדשבורד אישי ממוקד פעולה. הוא מבוסס על נתונים מהמאמן, צ׳ק-אינים וטקסי בוקר.

יכולות קיימות:

- Momentum Score מתוך רצף טקסי בוקר, השלמת צעדים השבוע ומדד momentum מהצ׳ק-אין.
- ברכה אישית לפי שעה ושם משתמש.
- פוקוס יומי editable שנשמר מקומית.
- פעולה מרכזית: הצעד הבא, כפתור סימון השלמה, או קריאה ליצירת צעדים/מטרה.
- התקדמות מטרה פעילה עם אחוז ביצוע, תחום, milestones וימים שנותרו.
- KPI strip: streak, צעדים שבוצעו השבוע, completion rate, מגמת אנרגיה.
- Tools bar לטקס בוקר, צ׳ק-אין ומאמן מטרות, כולל badges של done/pending.

ערך עסקי:

- מחזק שימוש יומי.
- מצמצם עומס קוגניטיבי לשאלה אחת: מה הפעולה החשובה עכשיו?
- מייצר "מסך בית" שמשקיע יכול להבין כמוצר ולא רק כרשימת פיצ׳רים.

### 3. Feature Unlock הדרגתי

נוספה מערכת פתיחת פיצ׳רים לפי ימים מה-onboarding:

| פיצ׳ר | יום פתיחה |
| --- | --- |
| צ׳ק-אין | יום 0 |
| מאמן חיים | יום 0 |
| טקס בוקר | יום 3 |
| ריבוי תחומים | יום 7 |
| פורמולציה/הבהרה עמוקה | יום 14 |

יכולות קיימות:

- Hook בשם `useFeatureUnlock`.
- Banner שמראה מה הפיצ׳ר הבא שייפתח ומתי.
- Teaser שמטשטש תוכן נעול ומסביר מתי ייפתח.

ערך עסקי:

- מפחית הצפה למשתמש חדש.
- מגדיל סיכוי ל-retention דרך תחושת התקדמות.
- מאפשר packaging עתידי סביב Freemium/Premium.

### 4. טקס בוקר

טקס הבוקר נשאר חלק מרכזי במוצר. הוא נועד להתחיל את היום דרך state, gratitude, identity ו-action.

יכולות קיימות:

- בחירת מצב: מהיר, רגיל, עמוק.
- נשימות מונחות.
- הכרת תודה עם טריגרים חושיים.
- affirmation / היגד עצמי.
- ניהול אמירות וסשנים קוליים/יוטיוב.
- ויזואליזציה.
- הצהרת זהות.
- משימה יומית.
- דירוג מצב לפני ואחרי.
- שמירת טקסים ורצף.
- שמירת gratitude entries ונתוני שימוש.

### 5. איפוס ערב - Evening Reset

נוסף flow חדש לסיום יום. זהו פיצ׳ר משמעותי כי הוא משלים את המחזור היומי: לא רק להתחיל עם כוונה, אלא לסיים עם למידה והכנה.

מצבים קיימים:

- Quick - כ-3 דקות.
- Standard - כ-5 דקות.
- Deep - כ-10 דקות.

שלבים קיימים לפי מצב:

- סקירת הניצחון הגדול של היום.
- סקירת מה עבד ומה חסם.
- Emotional dump לפריקת עומס מנטלי.
- הכרת תודה עם קטגוריות: אדם, רגע, הישג, הזדמנות.
- Insight מקומי/AI-like על בסיס דפוסים בטקסט.
- הגדרת "הניצחון של מחר".
- הכנת סביבה: פריטים/פעולות להכנה למחר.
- יעד שינה.
- ויזואליזציה למחר.
- Completion screen עם readiness score.

נתונים נשמרים:

- מצב הטקס.
- משך.
- completed.
- readiness score.
- tomorrows win.
- emotional dump word count.
- האם הוזכר blocker.
- skipped steps.
- session JSON מלא.
- streak ערב.

ערך עסקי:

- יוצר שימוש גם בערב, לא רק בבוקר.
- מחזק retention יומי כפול.
- משפר personalization של הצעדים למחר.
- מבדל מול אפליקציות habit פשוטות.

### 6. צ׳ק-אין יומי

הצ׳ק-אין נשאר זמין מתחת למסך הבית.

יכולות קיימות:

- מדדי אנרגיה ופוקוס.
- תגיות מצב/רגש.
- פעולה מועדפת או אמת שהמשתמש נמנע ממנה.
- response דרך `/api/coach`.
- היסטוריית צ׳ק-אין.
- מדדי interaction וניתוחים התנהגותיים אופציונליים.

### 7. מאמן חיים ב-8 תחומי חיים

המאמן עדיין ליבת מערכת המטרות לטווח ארוך.

תחומים קיימים:

- בריאות.
- זמן.
- כסף/עושר.
- קריירה.
- מערכות יחסים.
- מיינד/רגש.
- רוח/משמעות.
- בית ומשפחה.

יכולות קיימות:

- כרטיסי תחומים.
- אבחון תחום.
- יצירת מטרות ידנית או בעזרת AI.
- Goal wizard.
- קטגוריות משנה.
- אבני דרך.
- עריכת מטרות.
- מחיקה, השלמה ופתיחה מחדש.
- תצוגת התקדמות.
- Goal celebration.
- Daily Pulse.
- Progress dashboard.
- Weekly review משופר.
- Blocker deep dive.
- Add task FAB ומשימות freestyle.

### 8. Goal Wizard ותוכנית 30/60/90

יכולות קיימות:

- בחירת תחום וקטגוריית משנה.
- כתיבת מטרה גולמית.
- השראה מ-AI.
- יצירת goal bundle.
- milestones ל-30/60/90.
- preview לפני שמירה.
- success metric.
- deadline.
- motivation ו-constraints.

### 9. התמחות בתחום הבריאות

תחום הבריאות מקבל טיפול עמוק יותר.

יכולות קיימות:

- Health goal wizard.
- קטגוריות כמו fitness, sleep, nutrition, weight, energy.
- baseline ו-target.
- יחידת מדידה.
- weight direction.
- anchor habit ו-anchor time.
- health why important / why now / what lost.
- execution plan ל-90 יום.
- health phases.
- התאמת צעדים לפי השלב הנוכחי.

### 10. צעדי תינוק יומיים

המערכת מייצרת 1-3 צעדים יומיים לפי מטרות פעילות, רפלקציות, אנרגיה והיסטוריית ביצוע.

יכולות קיימות:

- יצירת צעדים דרך AI או fallback.
- התאמה לרמת אנרגיה ומצב רוח.
- קושי: easy, medium, hard.
- זמן משוער.
- סטטוסים: pending, completed, skipped, partial.
- דחייה למחר.
- מחיקה.
- רפלקציה על צעד.
- blocker reason.
- actual minutes.
- read tracking.

### 11. רפלקציות, insights וסקירות שבועיות

יכולות קיימות:

- Daily reflection.
- mood score ו-energy score.
- טקסט רפלקציה.
- blocker reason.
- ניתוח reflection.
- AI insights מסוג pattern/recommendation/weekly_review.
- Weekly review עם תקופה, תחום חזק, תחום חלש, חסם מרכזי והמלצה.
- Cross-domain blocker detection.

### 12. תהליך הבהרה/פורמולציה

הפיצ׳ר קיים ונפתח הדרגתית אחרי 14 ימים לפי מערכת unlock.

שלבים קיימים:

- הסכמה וגבולות שימוש.
- סינון סיכון.
- דירוגים ושאלות מכוונות.
- follow-up.
- שאלות exploration.
- formulation collaborative.
- בחירת micro-goal.
- coach handoff.
- export.

הפרומפטים מגדירים במפורש שהמערכת אינה מטפלת, אינה מאבחנת ואינה נותנת ייעוץ רפואי/משפטי/תרופתי.

### 13. ניהול תוכן ונתונים

יכולות קיימות:

- Admin panel.
- ניהול affirmations ו-identities.
- צפייה בנתונים.
- ייבוא/ייצוא JSON.
- ייצוא check-ins ל-CSV.
- לוגים.
- SQL editor.
- table browser.
- admin guard בסיסי.

### 14. גישה מהאייפון דרך Tailscale

נוספו קבצי הפעלה שמאפשרים להשתמש באפליקציה מהמכשיר גם מחוץ לבית, כל עוד המחשב דלוק ומחובר:

- `run.bat` פותח firewall rule אם אפשר, מציג URL מקומי ו-URL של Tailscale, מפעיל `tailscale serve --bg localhost:3000`, ומריץ `npm run dev`.
- `setup-firewall.bat` מאפשר להגדיר firewall rule בהרצה כמנהל.
- `launch.vbs` מפעיל את `run.bat` בנוחות.
- `package.json` מעודכן כך ש-`npm run dev` מאזין על `0.0.0.0:3000`.

זה אינו פתרון production, אבל הוא מתאים מאוד למשתמש יחיד שרוצה לגשת מהאייפון לאב-טיפוס בלי לחשוף אותו לאינטרנט הפתוח.

## תשתית נתונים

הסכמה כוללת כיום:

- `users`
- `checkins`
- `morning_rituals`
- `gratitude_entries`
- `ritual_content`
- `domain_assessments`
- `goals`
- `milestones`
- `daily_steps`
- `daily_reflections`
- `health_phases`
- `ai_insights`
- `weekly_reviews`
- `streaks`
- `formulation_sessions`
- `evening_resets`
- `subscriptions`
- `push_subscriptions`

הוספת `evening_resets` מחזקת את מודל המחזור היומי. הוספת `subscriptions` ו-`push_subscriptions` מסמנת כיוון מסחרי ותפעולי עתידי, אף שהזרימות המלאות עדיין לא ממומשות.

## חוויית משתמש מרכזית

### Flow 1: משתמש חדש

1. נכנס ל-onboarding.
2. בוחר שפה, שעת קימה ופרטים בסיסיים.
3. מדרג 8 תחומי חיים.
4. בוחר תחום ראשון.
5. עונה על שאלות עומק.
6. מקבל insight אישי.
7. מקבל הצעת מטרה.
8. מאשר/עורך את המטרה.
9. מקבל צעד ראשון של עד 5 דקות.
10. מסמן את הצעד הראשון כהושלם ונכנס לדשבורד.

### Flow 2: יום רגיל

1. המשתמש נכנס לדשבורד.
2. רואה Momentum Score.
3. רואה את הפעולה המרכזית להיום.
4. מסמן צעד כהושלם או מייצר צעדים.
5. עושה צ׳ק-אין.
6. מקדם מטרה.
7. בערב מבצע Evening Reset.
8. המידע נשמר לשיפור ההמלצות הבאות.

### Flow 3: שבוע שימוש

1. המשתמש צובר צעדים, טקסים וצ׳ק-אינים.
2. הדשבורד מציג completion rate ו-energy trend.
3. מאמן החיים מייצר weekly review.
4. המערכת מזהה חסמים חוזרים.
5. feature unlock פותח יכולות חדשות באופן מדורג.

## בידול מרכזי

### עברית ו-RTL כבסיס מוצרי

המוצר בנוי בעברית ואנגלית עם כיווניות מתאימה, ולא כתוספת מאוחרת.

### מערכת פעולה ולא רק שיחה

רוב מוצרי AI coaching מתמקדים בשיחה. כאן יש goals, steps, rituals, reflections, scores, progress ו-daily loops.

### Onboarding שמייצר פעולה ראשונה

המשתמש לא רק "מגדיר פרופיל"; הוא יוצא עם מטרה וצעד ראשון שהושלם.

### Morning + Evening loops

שילוב טקס בוקר ואיפוס ערב יוצר מחזור יומי מלא: כוונה בבוקר, למידה בערב.

### Progressive Unlock

פתיחה הדרגתית של פיצ׳רים מטפלת בעומס מוצרי ומייצרת retention hook.

### נתוני ביצוע כבסיס ל-personalization

הערך העתידי אינו רק הפרומפטים אלא מאגר דפוסי הביצוע: completion, skipped, blocker, energy, readiness, streaks ו-reflections.

## SWOT

### Strengths - חוזקות

- אב-טיפוס רחב ועובד, עם מסכי מוצר אמיתיים.
- Onboarding חדש שמייצר time-to-value מהיר.
- דשבורד אישי עם Momentum Score ופעולה מרכזית.
- Morning Ritual ו-Evening Reset יוצרים מחזור יומי מלא.
- מערכת מטרות עם 8 תחומי חיים, milestones וצעדים יומיים.
- התאמת צעדים לפי אנרגיה, מצב רוח וחסמים.
- עברית/אנגלית ו-RTL.
- Feature Unlock שמקטין עומס ומשפר סיכוי להתמדה.
- תשתית נתונים עשירה ל-personalization.
- תשתית ראשונית ל-subscriptions ו-push.
- פתרון גישה פרטי מהאייפון דרך Tailscale למשתמש יחיד.

### Weaknesses - חולשות

- עדיין local-first ולא production-ready.
- אין authentication מסחרי מלא.
- אין billing פעיל למרות תשתית טבלה.
- אין אפליקציה native, רק Web/PWA.
- אין עדיין נתוני traction או retention אמיתיים.
- שם "רובינס" עלול להיות רגיש משפטית.
- חלק מה-insights ב-Evening Reset הם heuristic/fallback ולא AI מלא.
- עומס פיצ׳רים עדיין גבוה, גם אם unlock עוזר.
- נדרשת עבודה משפטית וקלינית סביב שימוש רגשי ונתונים אישיים.

### Opportunities - הזדמנויות

- שוק AI coaching צומח ומחפש מוצרים שמחברים בין שיחה לפעולה.
- חסר מוצר עברי איכותי שמחבר goals, rituals, check-ins ו-AI.
- אפשרות למודל B2C subscription.
- אפשרות למוצר למאמנים וקהילות.
- אפשרות ל-white-label.
- שימוש ב-push notifications להחזרת משתמשים לבוקר/ערב.
- שילוב עתידי עם Calendar, Apple Health או Google Fit.
- מיתוג מחדש לפני השקה יכול לפתוח כיוון רחב יותר מ-"Robbins-inspired".

### Threats - איומים

- BetterUp, CoachHub, Headspace, Calm, Noom ו-Rocky.ai מחזיקים מותגים ותקציבים.
- ChatGPT וכלי AI כלליים יכולים לתת עצות ותוכניות בסיסיות.
- רגולציה ורגישות סביב mental health, privacy ו-AI advice.
- עלויות LLM בשימוש יומיומי.
- נטישה אם הערך לא ברור תוך ימים ספורים.
- תחרות מצד אפליקציות habit tracking פשוטות וזולות.

## ניתוח מתחרים

### מפת תחרות

| קטגוריה | שחקנים מרכזיים | מה הם מציעים | פער/הזדמנות לאפליקציית רובינס |
| --- | --- | --- | --- |
| AI coaching לארגונים | BetterUp Grow, CoachHub AIMY, Rocky.ai | AI coaching, מנהיגות, מיומנויות, white-label, enterprise | פחות מתאימים למשתמש פרטי עברי ולמחזור בוקר-ערב אישי |
| אפליקציות הרגלים | Fabulous, Habitify, Streaks, Coach.me | שגרות, תזכורות, מעקב הרגלים | חלשות יותר בהבנת חסמים, AI goals ותוכנית 90 יום |
| מיינדפולנס ושינה | Calm, Headspace, Insight Timer | מדיטציה, שינה, הרגעה, תוכן guided | חזקות בתוכן, חלשות יותר ב-goal execution |
| בריאות והתנהגות | Noom | שינוי הרגלי בריאות/משקל, coaching, פסיכולוגיה התנהגותית | ממוקדת בריאות/משקל; רובינס רחבה לכל תחומי החיים |
| AI mental health support | Wysa, Youper, Woebot-like products | תמיכה רגשית, CBT/self-help | רובינס צריכה להישאר coaching לא-קליני ולהימנע ממיצוב טיפולי |
| AI כללי | ChatGPT, Claude, Gemini, Replika | שיחה, תוכניות, תמיכה, רעיונות | אין מערכת ביצוע יומית מובנית, סטטוסים, streaks, rituals ונתוני התקדמות |

### BetterUp Grow

BetterUp Grow ממוצב כ-AI coaching להתנהגות ומנהיגות, מבוסס מדע, תובנות ממיליוני coaching sessions ומיקוד enterprise. זה מאמת את השוק של AI coaching, אך משאיר מקום לפתרון consumer-first, עברי, זול ופשוט יותר.

מקור: [BetterUp Grow AI Coaching](https://www.betterup.com/products/betterup-ai-coaching)

### CoachHub AIMY

CoachHub AIMY הוא AI coach שמטרתו להנגיש coaching לארגונים ולכוח עבודה גלובלי. המיקוד הוא קריירה, leadership ו-talent development. רובינס יכולה לבדל דרך life domains, טקסים יומיים, עברית ו-consumer habit loop.

מקור: [CoachHub AIMY](https://www.coachhub.com/news_media/coachhub-unveils-ai-coach-aimy)

### Rocky.ai

Rocky.ai מתמחה ב-AI coaching, custom agents, voice/avatar ו-white-label. זהו מתחרה קרוב מבחינת AI coaching ומאמנים/ארגונים. היתרון האפשרי של רובינס: מוצר יומי ממוקד execution בעברית, עם onboarding וצעד ראשון, ולא רק conversational coach.

מקור: [Rocky.ai](https://www.rocky.ai/)

### Headspace

Headspace ממשיכה להתרחב מעבר למדיטציה לתחום coaching ותמיכה נפשית. לפי עמודי העזרה, coaching יכול לכלול מפגשי טקסט חודשיים בתשלום. Headspace חזקה באמון ובתוכן, אך פחות ממוקדת בבניית מטרות רב-תחומיות וביצוע יומי.

מקורות: [Headspace Coaching](https://www.headspace.com/coaching-subscription), [Headspace Help Center](https://help.headspace.com/hc/en-us/articles/25083776133659-How-Do-I-Enroll-in-Headspace-Mental-Health-Coaching)

### Calm

Calm ממוצבת סביב שינה, מדיטציה והרגעה. היא מתחרה על זמן wellness יומי, אך אינה מערכת ביצוע מטרות. רובינס יכולה לבדל דרך השאלה: "מה עשית היום ומה תעשה מחר?"

מקור: [Calm](https://www.calm.com/)

### Noom

Noom מוכיחה שמשתמשים משלמים על שינוי התנהגותי עם coaching, אך היא ממוקדת בעיקר בריאות/משקל. רובינס יכולה להיות רחבה יותר: "Noom for life goals".

מקור: [Noom](https://www.noom.com/)

### Fabulous

Fabulous חזקה ב-routines ו-self-care. היא מתחרה ישירה על טקסים והרגלים, אך רובינס יכולה לבדל דרך AI goals, עברית, Evening Reset ונתוני ביצוע עמוקים.

מקור: [Fabulous](https://www.thefabulous.co/)

## מודל עסקי אפשרי

### B2C Freemium

- Free: onboarding, צעד ראשון, צ׳ק-אין בסיסי, מטרה אחת.
- Plus: טקס בוקר, איפוס ערב, צעדים יומיים, history, weekly review.
- Premium: formulation, multi-domain, AI insights מתקדמים, export, push routines.

טווח מחיר אפשרי לבדיקה: 29-59 ש"ח לחודש או 249-499 ש"ח לשנה.

### Coach Companion

- מאמן אישי מקבל מערכת ללקוחות.
- לקוח מבצע צעדים וטקסים בין מפגשים.
- המאמן רואה רק מידע שהמשתמש אישר לשיתוף.
- מודל לפי מאמן/מתאמנים.

### קהילות ו-white-label

- קהילות התפתחות אישית.
- סדנאות וקורסים.
- תכנים מותאמים למוביל הקהילה.
- onboarding ממותג לפי תוכנית.

## מדדי הצלחה למשקיע

### מדדי מוצר

- Completion rate של onboarding.
- אחוז משתמשים שמסמנים צעד ראשון כהושלם.
- D1/D7/D30 retention.
- מספר פתיחות דשבורד בשבוע.
- completion rate של צעדים יומיים.
- שיעור ביצוע Morning Ritual.
- שיעור ביצוע Evening Reset.
- readiness score ממוצע.
- weekly review generation rate.
- אחוז משתמשים שמגיעים לפתיחת day 7 ו-day 14.

### מדדי עסק

- conversion ל-Premium.
- CAC.
- LTV.
- churn חודשי.
- ARPU.
- עלות LLM למשתמש פעיל.
- retention לפי cohort onboarding.
- referral/organic growth.

## סיכונים והפחתה

### פרטיות ונתונים רגישים

נדרש לפני השקה:

- authentication מלא.
- הצפנת נתונים.
- export/delete self-service.
- privacy policy משפטית.
- terms משפטיים.
- retention policy.
- audit log לניהול.

### בריאות נפשית

המוצר צריך להישאר coaching ולא therapy:

- ניסוח ברור שאינו ייעוץ רפואי/נפשי.
- crisis handling.
- הפניות חירום לפי מדינה.
- guardrails בתוצרים.
- בדיקות safety.

### מיתוג

השם "רובינס" עלול ליצור סיכון משפטי או תפיסת שיוך לטוני רובינס. מומלץ לבדוק סימני מסחר ולשקול שם עצמאי לפני השקה ציבורית.

### עומס מוצר

למרות Feature Unlock, יש עדיין הרבה יכולות. יש להמשיך למדוד איפה משתמשים נתקעים ולשמור את מסך הבית סביב פעולה אחת.

## Roadmap מוצע

### שלב 1 - MVP יציב למשתמש יחיד/בטא סגורה

- להקשיח onboarding.
- לוודא שכל זרימת צעד ראשון נשמרת תקין.
- לחבר Evening Reset להמלצות מחר.
- לבדוק mobile UX באייפון דרך Tailscale/PWA.
- להוסיף בדיקות בסיסיות ל-onboarding, evening reset ו-feature unlock.

### שלב 2 - Production readiness

- authentication.
- אחסון ענן מאובטח.
- הצפנה.
- export/delete.
- privacy/terms משפטיים.
- monitoring ו-error handling.
- מדיניות נתונים רגישים.

### שלב 3 - Monetization

- לחבר `subscriptions` ל-Stripe או ספק מקומי.
- להגדיר packages סביב unlocks.
- Paywall עדין אחרי ערך ראשוני.
- מדידת conversion.

### שלב 4 - Retention

- push notifications.
- תזכורות בוקר/ערב.
- adaptive step difficulty.
- monthly review.
- streak recovery אחרי דילוג.

### שלב 5 - Coach/Community

- dashboard למאמן.
- שיתוף סלקטיבי של נתונים.
- white-label.
- תוכניות מובנות.

## המלצה אסטרטגית

המיצוב המומלץ כבר אינו רק "מאמן חיים AI". לאחר השינויים, המוצר מתאים יותר למיצוב:

> מערכת ביצוע אישית בעברית, שמתחילה איתך את היום, מסיימת איתך את היום, והופכת מטרות גדולות לצעדים קטנים שאפשר באמת לבצע.

המסר למשקיע צריך להדגיש שלוש נקודות:

1. המוצר יוצר ערך כבר ב-onboarding.
2. יש מחזור יומי מלא: בוקר, פעולה, צ׳ק-אין, ערב.
3. הנתונים המצטברים יוצרים personalization שקשה לשכפל בצ׳אט כללי.

## סיכום למשקיע

אפליקציית רובינס התקדמה לאב-טיפוס מוצרי עשיר עם בסיס ברור ל-retention: onboarding עם צעד ראשון, דשבורד מומנטום, מאמן מטרות, טקס בוקר, איפוס ערב, צ׳ק-אין, רפלקציות, תובנות AI ופתיחת פיצ׳רים הדרגתית. השלב הבא אינו להוסיף עוד פיצ׳רים, אלא להקשיח את הליבה, למדוד שימוש, לשפר mobile UX, ולהכין שכבות production: אבטחה, משתמשים, תשלומים ופרטיות.

ההזדמנות היא לבנות מוצר coaching יומי בעברית שממוקד לא בתוכן אלא בביצוע. אם המוצר יוכיח retention ושימוש חוזר בבוקר/ערב, הוא יכול להפוך לפלטפורמה רחבה למשתמשים פרטיים, מאמנים וקהילות.

## מקורות חיצוניים

- [BetterUp Grow AI Coaching](https://www.betterup.com/products/betterup-ai-coaching)
- [CoachHub AIMY](https://www.coachhub.com/news_media/coachhub-unveils-ai-coach-aimy)
- [Rocky.ai](https://www.rocky.ai/)
- [Headspace Coaching](https://www.headspace.com/coaching-subscription)
- [Headspace Help Center](https://help.headspace.com/hc/en-us/articles/25083776133659-How-Do-I-Enroll-in-Headspace-Mental-Health-Coaching)
- [Calm](https://www.calm.com/)
- [Noom](https://www.noom.com/)
- [Fabulous](https://www.thefabulous.co/)
