export function buildWeeklyShareText(input: {
  completed: number;
  showUpDays: number;
  minutes: number;
  topDomain?: string;
  locale: string;
}): string {
  const isHe = input.locale === 'he';
  if (isHe) {
    return [
      'עדכון שבועי — Robbins',
      `הופעות: ${input.showUpDays} ימים`,
      `צעדים שהושלמו: ${input.completed}`,
      `דקות השקעה: ${input.minutes}`,
      input.topDomain ? `תחום מוביל: ${input.topDomain}` : '',
      'מתחייב/ת להופיע — לא לשלמות.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    'Weekly update — Robbins',
    `Show-up days: ${input.showUpDays}`,
    `Steps completed: ${input.completed}`,
    `Minutes invested: ${input.minutes}`,
    input.topDomain ? `Leading area: ${input.topDomain}` : '',
    'Committed to showing up — not perfection.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function shareOrCopyWeeklyUpdate(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({text});
      return 'shared';
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
