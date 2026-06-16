/**
 * No Fluff / No Fake Progress — reject tasks that feel productive but move nothing.
 * Every step must end in a real deliverable, not reflection-only fluff.
 */

/** Primary fluff verbs — forbidden unless a clear deliverable is also present. */
const FLUFF_ONLY_PATTERNS: RegExp[] = [
  /\bthink about\b/i,
  /\breflect on\b/i,
  /\bread about\b/i,
  /\blearn about\b/i,
  /\bfeel (more|better|about)\b/i,
  /\bimagine\b/i,
  /\bvisuali[sz]e\b/i,
  /\bcontemplate\b/i,
  /\bmeditate on\b/i,
  /\bplan to improve\b/i,
  /\bplan to get better\b/i,
  /\bwork on your mindset\b/i,
  /\bwrite (something|about|on)\b/i,
  /\bjournal about\b/i,
  /לחשוב על/,
  /לקרוא על/,
  /ללמוד על/,
  /להרגיש/,
  /לדמיין/,
  /לכתוב משהו/,
  /לכתוב על/,
  /לכתוב בחופשיות/,
  /תכנן להשתפר/,
  /לתכנן להשתפר/,
  /להרהר/,
  /לעבד רגשית/,
];

/** Fake-progress phrasing without a concrete end state. */
const FAKE_PROGRESS_PATTERNS: RegExp[] = [
  /\b(be more|get better|improve yourself|build awareness|practice gratitude)\b/i,
  /\b(self[- ]?care time|mindful moment|positive mindset)\b/i,
  /(להיות יותר|להשתפר|מודעות עצמית|רגע של שקט|חשיבה חיובית)/,
];

/**
 * Observable end states — every task must resolve to at least one.
 * decision | message sent | short list | physical action | environmental change |
 * specific choice | measurement | time commitment
 */
const DELIVERABLE_OUTCOME_PATTERNS: RegExp[] = [
  // decision
  /\b(decide|decision|determine|commit to|קבע|החלט|החלטה)\b/i,
  // message sent
  /\b(send|sent|message|email|text|whatsapp|dm|הודעה|שלח|נשלח|לשלוח)\b/i,
  // short list
  /\b(list|lists|\b[2-5]\s+(items|options|meals|tasks|things|steps|משפטים|נקודות|ארוחות|משימות))\b/i,
  /\b(רשימה|לרשום|רשמתי)\b/,
  // physical action
  /\b(walk|move|exercise|stretch|tidy|clean|cook|buy|shop|call|open|finish|complete|submit|pack|drink|eat|sleep|הליכה|ללכת|לנקות|לסדר|לקנות|לבשל|להתקשר|לפתוח|לסיים|לשלוח|לשתות)\b/i,
  // environmental change
  /\b(set up|prepare|place|put|remove|organize|arrange|clear|הכן|הנח|הסר|סידור|מקום מוכן)\b/i,
  // specific choice
  /\b(pick one|choose one|select one|בחר אחד|אחת נבחרת|נבחר)\b/i,
  /\b(choose|pick|select|בחר|לבחור)\b/i,
  // measurement
  /\b(measure|count|record|track|log|weigh|check (balance|number)|מדידה|לספור|לתעד|יתרה|\d+\s*(שורות|משפטים|דקות|minutes|min|דק))\b/i,
  // time commitment
  /\b(\d+\s*(min|minute|minutes|דק|דק׳|דקות)|timer|טיימר|for \d+)\b/i,
];

export const NO_FLUFF_PROMPT_BLOCK = [
  '## No Fluff / No Fake Progress (HARD RULE — reject before output):',
  'NEVER return tasks that are ONLY:',
  '- think about / reflect on / לחשוב על',
  '- read about / learn about / לקרוא על / ללמוד על',
  '- feel / imagine / visualize / להרגיש / לדמיין',
  '- write something general / journal vaguely / לכתוב משהו כללי',
  '- plan to improve / תכנן להשתפר / be more X / work on mindset',
  'Unless the SAME step also names a clear deliverable you can verify today.',
  '',
  'Every step MUST end in at least ONE observable outcome:',
  '1. decision — a choice is written or locked in',
  '2. message sent — draft sent or queued to send',
  '3. short list — 2-5 named items on paper/screen',
  '4. physical action — body moves, object handled, task closed',
  '5. environmental change — space/tool prepared or rearranged',
  '6. specific choice — one option picked from a named set',
  '7. measurement — count, log, number checked, N lines written',
  '8. time commitment — timer started for N minutes with a done-when',
  '',
  'Set success_signal to that deliverable — not "felt better" or "reflected".',
  'WEAK (reject): "Think about your career." / "תחשוב על הקריירה." / "Read about healthy eating."',
  'STRONG (pass): "List 3 job leads and pick one to email today." / "רשום 3 ארוחות ובחר אחת לקנות מצרכים."',
].join('\n');

export function hasRealDeliverable(
  title: string,
  description = '',
  successSignal = ''
): boolean {
  const blob = `${title} ${description} ${successSignal}`.trim();
  if (blob.length < 6) return false;
  return DELIVERABLE_OUTCOME_PATTERNS.some((pattern) => pattern.test(blob));
}

/** True when the step looks like fake progress — nice wording, no real move. */
export function detectFakeProgress(
  title: string,
  description = '',
  successSignal = ''
): boolean {
  const titleTrim = title.trim();
  const blob = `${titleTrim} ${description}`.trim();

  if (!hasRealDeliverable(title, description, successSignal)) return true;

  const titleFluff = FLUFF_ONLY_PATTERNS.some((pattern) => pattern.test(titleTrim));
  if (titleFluff && !hasRealDeliverable(titleTrim, '', '')) {
    return !hasRealDeliverable('', description, successSignal);
  }

  return (
    FAKE_PROGRESS_PATTERNS.some((pattern) => pattern.test(blob)) &&
    !hasRealDeliverable(titleTrim, description, successSignal)
  );
}
