import {DEFAULT_AFFIRMATIONS} from '@/lib/default-affirmations';
import type {AffirmationItem, MorningRitualSession} from '@/lib/morning-ritual-types';

export type AffirmationLibraryTab = 'active' | 'drafts' | 'hidden' | 'default' | 'custom';

export type AffirmationSortKey =
  | 'createdAt'
  | 'lastUsedAt'
  | 'title'
  | 'type'
  | 'language'
  | 'weight';

export type AffirmationSourceKind = 'default' | 'custom' | 'admin';

export type AffirmationUsageStats = {
  selectedCount: number;
  lastSelectedAt: string | null;
};

export type AffirmationQualityIssue =
  | 'too_short'
  | 'duplicate'
  | 'no_tags'
  | 'no_language'
  | 'bad_youtube_url'
  | 'missing_title';

export function resolveAffirmationSource(item: AffirmationItem): AffirmationSourceKind {
  if (item.isDefault) return 'default';
  if (item.isAdminManaged) return 'admin';
  return 'custom';
}

export function isAffirmationVisibleInRitual(item: AffirmationItem): boolean {
  return item.active && !item.hiddenFromLibrary && !item.isDraft;
}

export function mergeAffirmationLibrary(
  stored: AffirmationItem[],
  defaults: AffirmationItem[] = DEFAULT_AFFIRMATIONS
): AffirmationItem[] {
  const hiddenIds = new Set(
    stored.filter((item) => item.hiddenFromLibrary).map((item) => item.id)
  );
  const custom = stored.filter((item) => !item.isDefault);
  const customIds = new Set(custom.map((item) => item.id));

  const mergedDefaults = defaults
    .filter((item) => !customIds.has(item.id))
    .map((item) => ({
      ...item,
      hiddenFromLibrary: hiddenIds.has(item.id),
    }));

  return [...custom, ...mergedDefaults];
}

export function persistableAffirmations(all: AffirmationItem[]): AffirmationItem[] {
  const custom = all.filter((item) => !item.isDefault);
  const hiddenMarkers = all
    .filter((item) => item.isDefault && item.hiddenFromLibrary)
    .map((item) => ({...item, active: false}));
  return [...custom, ...hiddenMarkers];
}

export function matchesAffirmationTab(item: AffirmationItem, tab: AffirmationLibraryTab): boolean {
  switch (tab) {
    case 'drafts':
      return Boolean(item.isDraft);
    case 'hidden':
      return Boolean(item.hiddenFromLibrary);
    case 'default':
      return Boolean(item.isDefault) && !item.hiddenFromLibrary && !item.isDraft;
    case 'custom':
      return !item.isDefault && !item.isDraft;
    case 'active':
    default:
      return isAffirmationVisibleInRitual(item);
  }
}

export function filterAffirmations(
  items: AffirmationItem[],
  input: {
    tab: AffirmationLibraryTab;
    query: string;
    language: string;
    type: string;
    active: string;
    origin: string;
    tag: string;
  }
): AffirmationItem[] {
  const q = input.query.trim().toLowerCase();

  return items.filter((item) => {
    if (!matchesAffirmationTab(item, input.tab)) return false;
    if (input.language !== 'all' && item.language !== input.language) return false;
    if (input.type !== 'all' && item.type !== input.type) return false;
    if (input.active === 'active' && !item.active) return false;
    if (input.active === 'inactive' && item.active) return false;
    if (input.origin === 'default' && !item.isDefault) return false;
    if (input.origin === 'custom' && item.isDefault) return false;
    if (input.origin === 'admin' && !item.isAdminManaged) return false;
    if (input.tag !== 'all' && !item.tags.some((tag) => tag.toLowerCase() === input.tag.toLowerCase())) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      item.title,
      item.textContent,
      item.youtubeUrl ?? '',
      item.language,
      item.type,
      ...item.tags,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function sortAffirmations(items: AffirmationItem[], sort: AffirmationSortKey): AffirmationItem[] {
  return [...items].sort((a, b) => compareAffirmations(a, b, sort));
}

export function compareAffirmations(
  a: AffirmationItem,
  b: AffirmationItem,
  sort: AffirmationSortKey
): number {
  switch (sort) {
    case 'title':
      return a.title.localeCompare(b.title, undefined, {sensitivity: 'base'});
    case 'type':
      return a.type.localeCompare(b.type);
    case 'language':
      return a.language.localeCompare(b.language);
    case 'weight':
      return b.weight - a.weight || a.title.localeCompare(b.title);
    case 'lastUsedAt': {
      const aTime = a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0;
      const bTime = b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0;
      return bTime - aTime;
    }
    case 'createdAt':
    default:
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  }
}

export type AffirmationPairGroup = {
  key: string;
  he: AffirmationItem | null;
  en: AffirmationItem | null;
  extras: AffirmationItem[];
};

export function getAffirmationPairKey(item: AffirmationItem): string {
  const match = item.id.match(/^(.+)-(he|en)$/);
  if (match) return match[1];
  return item.id;
}

export function groupAffirmationsIntoPairs(items: AffirmationItem[]): AffirmationPairGroup[] {
  const map = new Map<string, AffirmationPairGroup>();

  for (const item of items) {
    const key = getAffirmationPairKey(item);
    const group = map.get(key) ?? {key, he: null, en: null, extras: []};

    if (item.language === 'he') {
      if (group.he) group.extras.push(item);
      else group.he = item;
    } else if (item.language === 'en') {
      if (group.en) group.extras.push(item);
      else group.en = item;
    } else {
      group.extras.push(item);
    }

    map.set(key, group);
  }

  return [...map.values()];
}

export function getAffirmationPairRepresentative(pair: AffirmationPairGroup): AffirmationItem {
  return pair.he ?? pair.en ?? pair.extras[0];
}

export function getAffirmationPairMembers(pair: AffirmationPairGroup): AffirmationItem[] {
  return [pair.he, pair.en, ...pair.extras].filter((item): item is AffirmationItem => Boolean(item));
}

export function sortAffirmationPairs(
  pairs: AffirmationPairGroup[],
  sort: AffirmationSortKey
): AffirmationPairGroup[] {
  return [...pairs].sort((a, b) =>
    compareAffirmations(
      getAffirmationPairRepresentative(a),
      getAffirmationPairRepresentative(b),
      sort
    )
  );
}

export function collectAffirmationTags(items: AffirmationItem[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) {
      if (tag.trim()) tags.add(tag.toLowerCase());
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function normalizeAffirmationTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export function isValidYoutubeUrl(url: string): boolean {
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))[a-zA-Z0-9_-]{11}/.test(url);
}

export function extractYoutubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function normalizeAffirmationText(item: AffirmationItem): string {
  const body = item.type === 'youtube' ? item.youtubeUrl ?? '' : item.textContent;
  return body.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildDuplicateAffirmationIds(items: AffirmationItem[]): Set<string> {
  const buckets = new Map<string, string[]>();
  for (const item of items) {
    const key = `${item.language}:${item.type}:${normalizeAffirmationText(item)}`;
    if (!key.endsWith(':')) {
      const list = buckets.get(key) ?? [];
      list.push(item.id);
      buckets.set(key, list);
    }
  }

  const duplicates = new Set<string>();
  for (const ids of buckets.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicates.add(id);
    }
  }
  return duplicates;
}

export function getAffirmationQualityIssues(
  item: AffirmationItem,
  duplicateIds: Set<string>
): AffirmationQualityIssue[] {
  const issues: AffirmationQualityIssue[] = [];
  if (!item.title.trim()) issues.push('missing_title');
  if (!item.language?.trim()) issues.push('no_language');
  if (item.tags.length === 0) issues.push('no_tags');
  if (item.type === 'text' && item.textContent.trim().length < 12) issues.push('too_short');
  if (item.type === 'youtube' && item.youtubeUrl && !isValidYoutubeUrl(item.youtubeUrl)) {
    issues.push('bad_youtube_url');
  }
  if (duplicateIds.has(item.id)) issues.push('duplicate');
  return issues;
}

export function buildAffirmationUsageStats(
  sessions: MorningRitualSession[]
): Map<string, AffirmationUsageStats> {
  const map = new Map<string, AffirmationUsageStats>();
  for (const session of sessions) {
    const id = session.selectedAffirmationId;
    if (!id) continue;
    const current = map.get(id) ?? {selectedCount: 0, lastSelectedAt: null};
    current.selectedCount += 1;
    if (session.completedAt) {
      if (!current.lastSelectedAt || session.completedAt > current.lastSelectedAt) {
        current.lastSelectedAt = session.completedAt;
      }
    }
    map.set(id, current);
  }
  return map;
}

export function groupAffirmationsByTag(items: AffirmationItem[]): Map<string, AffirmationItem[]> {
  const groups = new Map<string, AffirmationItem[]>();
  const untagged: AffirmationItem[] = [];

  for (const item of items) {
    if (item.tags.length === 0) {
      untagged.push(item);
      continue;
    }
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      const list = groups.get(key) ?? [];
      if (!list.some((entry) => entry.id === item.id)) list.push(item);
      groups.set(key, list);
    }
  }

  if (untagged.length > 0) groups.set('__untagged__', untagged);
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function exportAffirmationsJson(items: AffirmationItem[]): string {
  return JSON.stringify({version: 1, exportedAt: new Date().toISOString(), affirmations: items}, null, 2);
}

export function exportAffirmationsCsv(items: AffirmationItem[]): string {
  const header = [
    'id',
    'title',
    'type',
    'textContent',
    'youtubeUrl',
    'tags',
    'language',
    'active',
    'weight',
    'isDefault',
    'hiddenFromLibrary',
    'isDraft',
    'isAdminManaged',
    'createdAt',
    'lastUsedAt',
  ];
  const rows = items.map((item) =>
    [
      item.id,
      item.title,
      item.type,
      item.textContent,
      item.youtubeUrl ?? '',
      item.tags.join('|'),
      item.language,
      String(item.active),
      String(item.weight),
      String(Boolean(item.isDefault)),
      String(Boolean(item.hiddenFromLibrary)),
      String(Boolean(item.isDraft)),
      String(Boolean(item.isAdminManaged)),
      item.createdAt,
      item.lastUsedAt ?? '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function parseAffirmationsImport(raw: string): AffirmationItem[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as {affirmations?: AffirmationItem[]} | AffirmationItem[];
    const list = Array.isArray(parsed) ? parsed : parsed.affirmations;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeImportedAffirmation);
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((cell) => cell.replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    const record = Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
    return normalizeImportedAffirmation({
      id: record.id || crypto.randomUUID(),
      type: (record.type as AffirmationItem['type']) || 'text',
      title: record.title || '',
      textContent: record.textContent || '',
      youtubeVideoId: extractYoutubeVideoId(record.youtubeUrl || ''),
      youtubeUrl: record.youtubeUrl || null,
      tags: (record.tags || '').split('|').map((tag) => tag.trim()).filter(Boolean),
      language: record.language || 'he',
      active: record.active !== 'false',
      weight: Number(record.weight) || 1,
      lastUsedAt: record.lastUsedAt || null,
      createdAt: record.createdAt || new Date().toISOString(),
      isDefault: record.isDefault === 'true',
      hiddenFromLibrary: record.hiddenFromLibrary === 'true',
      isDraft: record.isDraft === 'true',
      isAdminManaged: record.isAdminManaged === 'true',
    });
  });
}

function normalizeImportedAffirmation(item: AffirmationItem): AffirmationItem {
  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    tags: normalizeAffirmationTags(item.tags.join(',')),
    weight: Math.max(1, Math.min(10, item.weight || 1)),
    createdAt: item.createdAt || new Date().toISOString(),
    isDefault: Boolean(item.isDefault),
    hiddenFromLibrary: Boolean(item.hiddenFromLibrary),
    isDraft: Boolean(item.isDraft),
    isAdminManaged: item.isAdminManaged ?? true,
  };
}

export function renameAffirmationTag(items: AffirmationItem[], from: string, to: string): AffirmationItem[] {
  const source = from.trim().toLowerCase();
  const target = to.trim().toLowerCase();
  if (!source || !target || source === target) return items;
  return items.map((item) => ({
    ...item,
    tags: [...new Set(item.tags.map((tag) => (tag.toLowerCase() === source ? target : tag.toLowerCase())))],
  }));
}

export function mergeAffirmationTags(items: AffirmationItem[], fromTags: string[], toTag: string): AffirmationItem[] {
  const sources = new Set(fromTags.map((tag) => tag.toLowerCase()));
  const target = toTag.trim().toLowerCase();
  if (!target) return items;
  return items.map((item) => {
    if (!item.tags.some((tag) => sources.has(tag.toLowerCase()))) return item;
    const next = item.tags.filter((tag) => !sources.has(tag.toLowerCase()));
    if (!next.includes(target)) next.push(target);
    return {...item, tags: next};
  });
}
