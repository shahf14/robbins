import type {AppLocale} from '@/i18n/config';
import type {CoachingStyle} from '@/lib/user-preferences';

type TemplatePair = {sentence: string; action: string};

function intensify(pair: TemplatePair, locale: AppLocale): TemplatePair {
  // Only inject the "— let's win" flourish when the sentence has no em-dash of
  // its own, otherwise we get an awkward double em-dash.
  const hasDash = pair.sentence.includes('—');
  if (locale === 'he') {
    const sentence = pair.sentence.replace('צעד אחד', 'צעד אחד חזק');
    return {
      sentence: hasDash ? sentence : sentence.replace('היום', 'היום — בוא ננצח'),
      action: pair.action.replace('התחלה:', 'קדימה:').replace('Start with', 'Go:'),
    };
  }
  const sentence = pair.sentence.replace('one step', 'one bold step');
  return {
    sentence: hasDash ? sentence : sentence.replace('Today', 'Today — let\'s win'),
    action: pair.action.replace('Start with', 'Go —').replace('Start:', 'Move:'),
  };
}

function soften(pair: TemplatePair, locale: AppLocale): TemplatePair {
  if (locale === 'he') {
    return {
      sentence: pair.sentence.replace('ננצח', 'נתקדם ברכות').replace('מומנטום', 'קצב נעים'),
      action: pair.action.replace('קדימה', 'בנחת').replace('רק', 'רק אם מתאים —'),
    };
  }
  return {
    sentence: pair.sentence.replace('win with', 'ease into').replace('Momentum', 'A gentle pace'),
    action: pair.action.replace('Go —', 'Gently —').replace('Just', 'Only if it fits —'),
  };
}

function directify(pair: TemplatePair, locale: AppLocale): TemplatePair {
  // Direct tone = clipped, no fluff. Turn the em-dash aside into a short second
  // sentence rather than dropping it — the clause after the dash often carries
  // the actionable half of the message.
  const directSentence = pair.sentence.replace(/\s*—\s*/g, '. ');
  if (locale === 'he') {
    return {
      sentence: directSentence,
      action: pair.action.replace('בוא ', '').replace('Let\'s ', ''),
    };
  }
  return {
    sentence: directSentence,
    action: pair.action.replace(/^Start with /i, '').replace(/^Open /i, ''),
  };
}

export function applyCoachToneToMessage(
  pair: TemplatePair,
  tone: CoachingStyle,
  locale: AppLocale
): TemplatePair {
  if (tone === 'motivational') return intensify(pair, locale);
  if (tone === 'direct') return directify(pair, locale);
  if (tone === 'supportive') return soften(pair, locale);
  return pair;
}
