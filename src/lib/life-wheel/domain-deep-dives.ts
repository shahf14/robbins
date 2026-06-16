import type {AppLocale} from '@/i18n/config';
import type {LifeDomain} from '@/lib/life-coach/types';
import raw from './domain-deep-dives.json';

export type DomainDeepDiveContent = {
  opening: string;
  whyImportant: string;
  includes: string[];
  score1: string;
  score10: string;
  selfCheck: string;
};

type LocaleBlock = Record<AppLocale, DomainDeepDiveContent>;
type DomainDeepDiveMap = Record<LifeDomain, LocaleBlock>;

const DOMAIN_DEEP_DIVES = raw as DomainDeepDiveMap;

export function getDomainDeepDive(domain: LifeDomain, locale: AppLocale): DomainDeepDiveContent {
  return DOMAIN_DEEP_DIVES[domain][locale];
}
