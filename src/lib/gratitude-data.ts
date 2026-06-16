import gratitudeData from '@/data/gratitude.json';
import {activeLifeContexts} from '@/lib/life-context-content';
import type {LifeContextStatus} from '@/lib/life-coach/types';

export type GratitudeTriggerKey = keyof typeof gratitudeData.triggers;

const TRIGGER_KEYS: GratitudeTriggerKey[] = [
  'smile',
  'breath',
  'corner',
  'workWin',
  'coffee',
];

type LocaleKey = 'en' | 'he';

type RawTrigger = {
  life_context_include?: string[];
  en: {label: string; prompt: string; starter: string};
  he: {label: string; prompt: string; starter: string};
};

const CONTEXT_TRIGGER_PRIORITY: Partial<
  Record<LifeContextStatus, GratitudeTriggerKey[]>
> = {
  new_parent: ['babyMoment', 'smile', 'cleanSheets', 'breath', 'corner'],
  student: ['studyClarity', 'workWin', 'coffee', 'musicBeat'],
  manager: ['workClosedLoop', 'workWin', 'coffee', 'breath'],
  caregiver: ['selfCareMoment', 'breath', 'corner', 'smile'],
  between_jobs: ['forwardStep', 'workWin', 'coffee', 'breath'],
  other: ['smile', 'breath', 'coffee'],
};

function getRawTrigger(key: GratitudeTriggerKey): RawTrigger {
  return gratitudeData.triggers[key] as RawTrigger;
}

function matchesLifeContext(
  trigger: RawTrigger,
  contexts: LifeContextStatus[]
): boolean {
  const include = trigger.life_context_include;
  if (!include?.length) return true;
  if (contexts.length === 0) return false;
  return include.some((c) => contexts.includes(c as LifeContextStatus));
}

export function getTrigger(key: GratitudeTriggerKey, locale: string) {
  const lang = (locale === 'he' ? 'he' : 'en') as LocaleKey;
  return getRawTrigger(key)[lang];
}

export function getTriggersForLifeContexts(
  locale: string,
  lifeContexts?: LifeContextStatus[] | null
): GratitudeTriggerKey[] {
  const active = activeLifeContexts(lifeContexts);
  if (active.length === 0) {
    return TRIGGER_KEYS;
  }

  const allKeys = Object.keys(gratitudeData.triggers) as GratitudeTriggerKey[];
  const matched = allKeys.filter((key) =>
    matchesLifeContext(getRawTrigger(key), active)
  );

  const priority = new Set<GratitudeTriggerKey>();
  for (const ctx of active) {
    for (const key of CONTEXT_TRIGGER_PRIORITY[ctx] ?? []) {
      priority.add(key);
    }
  }

  const prioritized = [...priority].filter((key) => matched.includes(key));
  const rest = matched.filter((key) => !priority.has(key));
  return [...prioritized, ...rest].slice(0, 6);
}

export function getEntryPlaceholders(locale: string): string[] {
  const lang = (locale === 'he' ? 'he' : 'en') as LocaleKey;
  return gratitudeData.entryPlaceholders[lang];
}
