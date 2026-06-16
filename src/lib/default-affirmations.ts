import type {AffirmationItem} from './morning-ritual-types';
import affirmationsData from '@/data/affirmations.json';

type RawAffirmation = (typeof affirmationsData.affirmations)[number] & {
  life_context_include?: string[];
};

function makeDefault(entry: RawAffirmation, lang: 'he' | 'en'): AffirmationItem {
  return {
    id: `${entry.id}-${lang}`,
    type: 'text',
    title: lang === 'he' ? entry.title_he : entry.title_en,
    textContent: lang === 'he' ? entry.text_he : entry.text_en,
    youtubeVideoId: null,
    youtubeUrl: null,
    tags: entry.tags,
    language: lang,
    active: true,
    weight: 1,
    lastUsedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    isDefault: true,
    lifeContextInclude: entry.life_context_include as AffirmationItem['lifeContextInclude'],
  };
}

export const DEFAULT_AFFIRMATIONS: AffirmationItem[] =
  affirmationsData.affirmations.flatMap((entry) => [
    makeDefault(entry, 'he'),
    makeDefault(entry, 'en'),
  ]);
