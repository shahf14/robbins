import type {AppLocale} from '@/i18n/config';
import type {LifeDomain} from '@/lib/life-coach/types';
import rawContent from './onboarding-step3-content.json';

type Step3Chip = {
  id: string;
  label: string;
};

type Step3Reflection = {
  matchAny: string[];
  summary: string;
  goal: string;
};

export type Step3DomainContent = {
  title: string;
  introLowest: string;
  introChosen: string;
  painQuestion: string;
  painHint: string;
  painChips: Step3Chip[];
  painPlaceholder: string;
  starterPhrases: string[];
  visionQuestion: string;
  visionHint: string;
  visionChips: Step3Chip[];
  visionPlaceholder: string;
  reflections: Step3Reflection[];
  defaultReflection: {
    summary: string;
    goal: string;
  };
};

const CONTENT = rawContent as Record<LifeDomain, Record<AppLocale, Step3DomainContent>>;

export function getStep3DomainContent(
  domain: LifeDomain,
  locale: AppLocale,
  isLowest: boolean
): Step3DomainContent & {intro: string} {
  const content = CONTENT[domain][locale];
  return {
    ...content,
    intro: isLowest ? content.introLowest : content.introChosen,
  };
}

export function buildStep3Reflection(
  domain: LifeDomain,
  locale: AppLocale,
  selectedPainIds: string[]
): {summary: string; goal: string} | null {
  if (!selectedPainIds.length) return null;

  const {reflections, defaultReflection} = CONTENT[domain][locale];
  for (const rule of reflections) {
    if (rule.matchAny.some((id) => selectedPainIds.includes(id))) {
      return {summary: rule.summary, goal: rule.goal};
    }
  }
  return defaultReflection;
}

export function getPainChipLabel(
  domain: LifeDomain,
  locale: AppLocale,
  chipId: string
): string | null {
  return CONTENT[domain][locale].painChips.find((chip) => chip.id === chipId)?.label ?? null;
}

export function getVisionChipLabel(
  domain: LifeDomain,
  locale: AppLocale,
  chipId: string
): string | null {
  return CONTENT[domain][locale].visionChips.find((chip) => chip.id === chipId)?.label ?? null;
}
