'use client';

import {useMemo, useState} from 'react';
import {useLocale} from 'next-intl';
import {Link} from '@/i18n/navigation';

type AppRoute =
  | '/'
  | '/coach'
  | '/life-coach'
  | '/clarification'
  | '/morning-priming'
  | '/evening-reset'
  | '/settings';

type StartMode = 'new' | 'stuck' | 'builder';

type Content = {
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  promise: string;
  modesTitle: string;
  modes: Record<StartMode, {label: string; title: string; body: string; plan: string[]; href: AppRoute; cta: string}>;
  rhythmTitle: string;
  rhythmBody: string;
  rhythm: Array<{time: string; title: string; body: string; href: AppRoute}>;
  mapTitle: string;
  mapBody: string;
  features: Array<{title: string; body: string; best: string; href: AppRoute; cta: string}>;
  principlesTitle: string;
  principles: Array<{title: string; body: string}>;
  playbookTitle: string;
  playbook: Array<{title: string; body: string}>;
  masteryTitle: string;
  masteryBody: string;
  mastery: string[];
  finalTitle: string;
  finalBody: string;
  finalCta: string;
};

const he: Content = {
  eyebrow: 'התחל כאן',
  title: 'ברוך הבא למערכת ההפעלה האישית שלך.',
  intro:
    'המטרה של האתר אינה שתמלא עוד טפסים. המטרה היא להפוך רצון מעורפל לתנועה יומית ברורה: להבין איפה אתה נמצא, לבחור כיוון, לבצע צעד קטן, ללמוד מהיום, ולהגיע מחר חד יותר.',
  primaryCta: 'פתח את היום שלי',
  secondaryCta: 'בנה מטרה ראשונה',
  promise: 'אם תשתמש בעמוד הזה כמצפן, תדע תמיד מה לעשות עכשיו, למה זה חשוב, ואיזה פיצ׳ר ייתן לך את המינוף הכי גבוה.',
  modesTitle: 'בחר איך אתה נכנס היום',
  modes: {
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
  },
  rhythmTitle: 'השגרה שמוציאה 100% מהאתר',
  rhythmBody: 'לא צריך להשתמש בכל דבר כל הזמן. צריך להשתמש בכלי הנכון ברגע הנכון.',
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
    {title: 'היום', body: 'לוח הבקרה היומי שלך: פעולה ראשית, מומנטום, רצף, מדדים וקיצורי דרך.', best: 'פתח ראשון בכל יום.', href: '/', cta: 'לעמוד היום'},
    {title: 'צ׳ק-אין', body: 'קריאה אמיתית של המצב שלך. האנרגיה, הפוקוס והמומנטום כאן משפיעים על ההכוונה.', best: 'כשהראש עמוס או כשצריך בהירות.', href: '/', cta: 'עשה צ׳ק-אין'},
    {title: 'מטרות', body: 'הופך חזון לתחומי חיים, מטרות, אבני דרך וצעדים יומיים מותאמים.', best: 'כשרוצים לבנות שינוי אמיתי לאורך זמן.', href: '/life-coach', cta: 'בנה מטרה'},
    {title: 'הבהרה', body: 'מרחב שאלות עמוק שמחדד מה באמת חשוב, איפה התקיעות ומה היעד הנכון.', best: 'לפני מטרה גדולה או כשיש הרבה רעש פנימי.', href: '/clarification', cta: 'פתח הבהרה'},
    {title: 'מאמן', body: 'שיחה ממוקדת עם AI כדי לחשוב טוב יותר, לא רק לקבל תשובה.', best: 'כשצריך ניסוח, אומץ, החלטה או פירוק חסם.', href: '/coach', cta: 'פתח מאמן'},
    {title: 'בוקר', body: 'ריטואל קצר לכוונה, הודיה, נשימה והתחלה יציבה.', best: 'לפני שהיום מתחיל לקחת אותך איתו.', href: '/morning-priming', cta: 'פתח בוקר'},
    {title: 'ערב', body: 'סגירת יום, למידה ותכנון קל למחר.', best: 'כשאתה רוצה לישון נקי יותר ולהגיע מוכן למחר.', href: '/evening-reset', cta: 'פתח ערב'},
    {title: 'הגדרות', body: 'שם, שפה, שעות, סגנון אימון והעדפות שמשפיעות על ההתאמה האישית.', best: 'אחרי ההיכרות הראשונית, כדי לדייק את המערכת אליך.', href: '/settings', cta: 'פתח הגדרות'},
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
  masteryTitle: 'מדד שליטה',
  masteryBody: 'הנה סימנים שאתה משתמש באתר כמו שצריך:',
  mastery: [
    'אתה יודע מה הצעד הבא שלך בלי לפתוח עשרה טאבים בראש.',
    'יש לך לפחות מטרה אחת פעילה שמחוברת לערך אמיתי.',
    'אתה מסמן ביצוע גם כשהביצוע לא מושלם.',
    'אתה משתמש בערב כדי ללמוד, לא כדי לשפוט את עצמך.',
    'כשאתה נופל, אתה חוזר דרך צעד קטן ולא דרך הבטחה ענקית.',
  ],
  finalTitle: 'המהלך הבא שלך פשוט.',
  finalBody:
    'אל תנסה להיות גרסה חדשה של עצמך בעוד שעה. תן לאתר לעזור לך לנצח את היום הקרוב. יום ועוד יום הופכים לזהות. זה המשחק.',
  finalCta: 'קח אותי לצעד הבא',
};

const en: Content = {
  ...he,
  eyebrow: 'Start here',
  title: 'Welcome to your personal operating system.',
  intro:
    'This page turns the app into a clear path: read your state, choose direction, take one small action, learn from the day, and come back sharper tomorrow.',
  primaryCta: 'Open today',
  secondaryCta: 'Build first goal',
  promise: 'Use this page as your compass: what to do now, why it matters, and which feature gives you the highest leverage.',
  modesTitle: 'Choose how you enter today',
  modes: {
    new: {...he.modes.new, label: 'I am new', title: 'Quick orientation path', href: '/morning-priming', cta: 'Start morning ritual'},
    stuck: {...he.modes.stuck, label: 'I feel stuck', title: 'Unstuck path', href: '/coach', cta: 'Talk to the coach'},
    builder: {...he.modes.builder, label: 'I want momentum', title: 'Daily execution path', href: '/life-coach', cta: 'Open goals'},
  },
  rhythmTitle: 'The rhythm that unlocks the app',
  rhythmBody: 'You do not need every tool all the time. Use the right tool at the right moment.',
  mapTitle: 'Feature map',
  mapBody: 'Every feature has a job. Once you know which tool solves which moment, the app becomes simple.',
  principlesTitle: 'Golden rules',
  playbookTitle: 'What to do when',
  masteryTitle: 'Mastery signals',
  masteryBody: 'You are using the app well when:',
  finalTitle: 'Your next move is simple.',
  finalBody: 'Do not try to become a new person in an hour. Win the next day. Day after day becomes identity.',
  finalCta: 'Take me to the next step',
};

export function StartHereExperience() {
  const locale = useLocale();
  const content = locale === 'he' ? he : en;
  const [mode, setMode] = useState<StartMode>('new');
  const activeMode = content.modes[mode];
  const completion = useMemo(() => ({new: 34, stuck: 67, builder: 100})[mode], [mode]);

  return (
    <main className="pb-16">
      <section className="page-shell py-6 sm:py-8">
        <div className="hero-surface px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="eyebrow">{content.eyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                {content.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
                {content.intro}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/" className="focus-ring btn-primary">
                  {content.primaryCta}
                </Link>
                <Link href="/life-coach" className="focus-ring btn-secondary">
                  {content.secondaryCta}
                </Link>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--blue)]">
                {content.modesTitle}
              </p>
              <div className="mt-4 grid gap-2">
                {(Object.keys(content.modes) as StartMode[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={`focus-ring rounded-2xl border px-4 py-3 text-start transition ${
                      mode === key
                        ? 'border-[var(--blue)]/45 bg-[var(--blue)]/12 text-white'
                        : 'border-white/10 bg-white/3 text-white/62 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black">{content.modes[key].label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-black">{activeMode.title}</h2>
                  <span className="text-sm font-black tabular-nums text-[var(--blue)]">{completion}%</span>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${completion}%`}
                >
                  <div className="h-full rounded-full bg-[var(--blue)] transition-all" style={{width: `${completion}%`}} aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm leading-7 text-white/62">{activeMode.body}</p>
                <ol className="mt-4 grid gap-2">
                  {activeMode.plan.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-6 text-white/78">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <Link href={activeMode.href} className="focus-ring btn-primary mt-5 w-full">
                  {activeMode.cta}
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-sm font-semibold leading-7 text-white/72">
            {content.promise}
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell">
          <div className="max-w-3xl">
            <p className="eyebrow">{locale === 'he' ? 'שגרה יומית' : 'Daily rhythm'}</p>
            <h2 className="mt-3 text-3xl font-black">{content.rhythmTitle}</h2>
            <p className="mt-3 leading-8 text-[var(--muted)]">{content.rhythmBody}</p>
          </div>
          <div className="mt-7 grid gap-3">
            {content.rhythm.map((item, index) => (
              <Link
                key={item.title}
                href={item.href}
                className="focus-ring group grid gap-4 rounded-[22px] border border-[color:var(--color-border)] fill-1 p-5 transition hover:border-[var(--blue)]/30 hover:fill-2 md:grid-cols-[90px_1fr_auto] md:items-center"
              >
                <span className="text-3xl font-black txt-faint tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--blue)]/75">{item.time}</p>
                  <h3 className="mt-1 text-xl font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 txt-soft">{item.body}</p>
                </div>
                <span className="text-sm font-black txt-faint transition group-hover:text-[var(--blue)]" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell">
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{content.mapTitle}</p>
              <h2 className="mt-3 text-3xl font-black">{content.mapTitle}</h2>
              <p className="mt-3 leading-8 text-[var(--muted)]">{content.mapBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.features.map((feature) => (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="focus-ring interactive-panel rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5"
                >
                  <h3 className="text-lg font-black">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 txt-soft">{feature.body}</p>
                  <p className="mt-4 rounded-xl fill-1 px-3 py-2 text-xs font-semibold leading-5 txt-muted">
                    {feature.best}
                  </p>
                  <p className="mt-4 text-sm font-black text-[var(--blue)]">{feature.cta}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell grid gap-4 lg:grid-cols-2">
          <InfoPanel title={content.principlesTitle} items={content.principles} />
          <InfoPanel title={content.playbookTitle} items={content.playbook} />
        </div>
      </section>

      <section className="section-block">
        <div className="page-shell">
          <div className="panel-surface-strong p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{content.masteryTitle}</p>
                <h2 className="mt-3 text-3xl font-black">{content.masteryTitle}</h2>
                <p className="mt-3 leading-8 text-[var(--muted)]">{content.masteryBody}</p>
              </div>
              <div className="grid gap-3">
                {content.mastery.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-[color:var(--color-border)] fill-1 p-4">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--blue)]" />
                    <p className="text-sm font-semibold leading-7 txt-soft">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pt-4">
        <div className="rounded-[28px] border border-[var(--blue)]/25 bg-[linear-gradient(135deg,rgba(26,109,255,0.16),rgba(232,87,42,0.08),rgba(255,255,255,0.03))] px-6 py-8 text-center sm:px-8">
          <h2 className="text-3xl font-black">{content.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-3xl leading-8 txt-soft">{content.finalBody}</p>
          <Link href={activeMode.href} className="focus-ring btn-primary mt-6">
            {content.finalCta}
          </Link>
        </div>
      </section>
    </main>
  );
}

function InfoPanel({title, items}: {title: string; items: Array<{title: string; body: string}>}) {
  return (
    <section className="panel-surface p-6 sm:p-8">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <details
            key={item.title}
            className="group rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4 open:border-[var(--blue)]/30 open:bg-[var(--blue)]/5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black marker:hidden">
              <span>{item.title}</span>
              <span className="text-[var(--blue)] transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-7 txt-soft">{item.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
