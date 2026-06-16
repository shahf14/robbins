import type {useTranslations} from 'next-intl';
import {
  themedAiInsightKey,
  type EveningResetPainContext,
} from '@/lib/evening-reset/pain-context';
import type {EveningResetSession} from '@/lib/evening-reset-types';

export function generateEveningAiInsight(
  session: Partial<EveningResetSession>,
  t: ReturnType<typeof useTranslations>,
  painContext: EveningResetPainContext | null
): string {
  const hasShortTasks =
    session.blockers?.trim() &&
    (session.blockers.includes('ארוך') ||
      session.blockers.includes('long') ||
      session.blockers.includes('זמן') ||
      session.blockers.includes('time'));

  const hasWin = !!session.biggestWin?.trim();
  const hasBlocker = !!session.blockers?.trim();
  const hasDump = !!session.emotionalDump?.trim();

  if (hasShortTasks) {
    return t('aiInsight.patternShortTasks');
  }
  if (hasBlocker && hasWin) {
    return t('aiInsight.patternMixed');
  }
  if (hasDump) {
    return t('aiInsight.patternEmotional');
  }
  if (hasWin) {
    return t('aiInsight.patternPositive');
  }

  const themedKey = themedAiInsightKey(painContext);
  if (themedKey) {
    return t(themedKey as Parameters<typeof t>[0]);
  }

  return t('aiInsight.patternDefault');
}
