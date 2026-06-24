'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import type {AppLocale} from '@/i18n/config';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {formatAffirmationTag} from '@/components/affirmation-manager';
import {AdminActionButton, AdminCreateButton, AdminEmptyState, AdminMetaItem, AdminViewButton} from '@/components/admin/admin-shell';
import type {AffirmationItem, AffirmationType, MorningRitualSession} from '@/lib/morning-ritual-types';
import {DEFAULT_AFFIRMATIONS} from '@/lib/default-affirmations';
import {
  buildAffirmationUsageStats,
  buildDuplicateAffirmationIds,
  collectAffirmationTags,
  extractYoutubeVideoId,
  filterAffirmations,
  getAffirmationPairMembers,
  getAffirmationQualityIssues,
  groupAffirmationsIntoPairs,
  mergeAffirmationLibrary,
  mergeAffirmationTags,
  normalizeAffirmationTags,
  parseAffirmationsImport,
  persistableAffirmations,
  renameAffirmationTag,
  resolveAffirmationSource,
  sortAffirmationPairs,
  sortAffirmations,
  type AffirmationLibraryTab,
  type AffirmationPairGroup,
  type AffirmationQualityIssue,
  type AffirmationSortKey,
} from '@/lib/morning-ritual/affirmation-library';
import {fetchRitualContent, fetchSessions, saveAffirmations} from '@/lib/morning-ritual-storage';
import {loadUserPreferences} from '@/lib/user-preferences';
import {scheduleDeferredRitualCommit} from '@/lib/morning-ritual/deferred-ritual-persist';
import {recordAdminActivity, type AdminActivityKey} from '@/lib/admin/admin-activity';

function formatAdminTimestamp(iso: string, locale: AppLocale): string {
  try {
    return new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function resolveAdminActorLabel(): string {
  return loadUserPreferences().display_name?.trim() ?? '';
}

const PAGE_SIZE = 25;

type FilterState = {
  query: string;
  language: string;
  type: string;
  active: string;
  origin: string;
  tag: string;
};

const DEFAULT_FILTERS: FilterState = {
  query: '',
  language: 'all',
  type: 'all',
  active: 'all',
  origin: 'all',
  tag: 'all',
};

export function AdminAffirmationsPanel({onActivity}: {onActivity?: (key: AdminActivityKey) => void}) {
  const t = useTranslations('admin.affirmations');
  const locale = useLocale() as AppLocale;
  const {confirm} = useConfirm();
  const toast = useToast();
  const actorLabel = resolveAdminActorLabel() || t('meta.admin');

  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([]);
  const [usageById, setUsageById] = useState<Map<string, {selectedCount: number; lastSelectedAt: string | null}>>(new Map());
  const [tab, setTab] = useState<AffirmationLibraryTab>('active');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<AffirmationSortKey>('createdAt');
  const [page, setPage] = useState(1);
  const [groupByTag, setGroupByTag] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('');
  const [tagRenameFrom, setTagRenameFrom] = useState('');
  const [tagRenameTo, setTagRenameTo] = useState('');
  const [tagMergeFrom, setTagMergeFrom] = useState('');
  const [tagMergeTo, setTagMergeTo] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<{
    type: AffirmationType;
    title: string;
    textContent: string;
    youtubeUrl: string;
    tags: string;
    language: AppLocale;
    active: boolean;
    weight: number;
    isDraft: boolean;
  }>({
    type: 'text' as AffirmationType,
    title: '',
    textContent: '',
    youtubeUrl: '',
    tags: '',
    language: locale,
    active: true,
    weight: 1,
    isDraft: false,
  });

  const duplicateIds = useMemo(() => buildDuplicateAffirmationIds(affirmations), [affirmations]);
  const allTags = useMemo(() => collectAffirmationTags(affirmations), [affirmations]);

  const filtered = useMemo(
    () => sortAffirmations(filterAffirmations(affirmations, {tab, ...filters}), sort),
    [affirmations, tab, filters, sort]
  );

  const filteredPairs = useMemo(
    () => sortAffirmationPairs(groupAffirmationsIntoPairs(filtered), sort),
    [filtered, sort]
  );

  const totalPages = Math.max(1, Math.ceil(filteredPairs.length / PAGE_SIZE));
  const pagePairs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPairs.slice(start, start + PAGE_SIZE);
  }, [filteredPairs, page]);

  const groupedPairs = useMemo(() => {
    if (!groupByTag) return null;
    const map = new Map<string, AffirmationPairGroup[]>();
    for (const pair of pagePairs) {
      const tags = new Set<string>();
      for (const item of getAffirmationPairMembers(pair)) {
        for (const tag of item.tags) {
          if (tag.trim()) tags.add(tag.toLowerCase());
        }
      }
      const keys = tags.size > 0 ? [...tags] : ['__untagged__'];
      for (const key of keys) {
        const list = map.get(key) ?? [];
        list.push(pair);
        map.set(key, list);
      }
    }
    return map;
  }, [pagePairs, groupByTag]);

  const pageItems = useMemo(() => pagePairs.flatMap((pair) => getAffirmationPairMembers(pair)), [pagePairs]);
  const detailItem = affirmations.find((item) => item.id === detailId) ?? null;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.query.trim()) count++;
    if (filters.language !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.active !== 'all') count++;
    if (filters.origin !== 'all') count++;
    if (filters.tag !== 'all') count++;
    if (sort !== 'createdAt') count++;
    if (groupByTag) count++;
    return count;
  }, [filters, sort, groupByTag]);

  const tabCounts = useMemo(() => {
    const counts: Record<AffirmationLibraryTab, number> = {
      active: 0,
      drafts: 0,
      hidden: 0,
      default: 0,
      custom: 0,
    };
    for (const item of affirmations) {
      if (item.isDraft) counts.drafts += 1;
      if (item.hiddenFromLibrary) counts.hidden += 1;
      if (item.isDefault && !item.hiddenFromLibrary && !item.isDraft) counts.default += 1;
      if (!item.isDefault && !item.isDraft) counts.custom += 1;
      if (item.active && !item.hiddenFromLibrary && !item.isDraft) counts.active += 1;
    }
    return counts;
  }, [affirmations]);

  const persist = useCallback((next: AffirmationItem[]) => {
    setAffirmations(next);
    saveAffirmations(persistableAffirmations(next));
    if (onActivity) onActivity('affirmationsSave');
    else recordAdminActivity('affirmationsSave');
  }, [onActivity]);

  const load = useCallback(async () => {
    const [{affirmations: stored}, sessions] = await Promise.all([
      fetchRitualContent(),
      fetchSessions().catch(() => [] as MorningRitualSession[]),
    ]);
    const merged = mergeAffirmationLibrary(
      stored.length > 0 ? stored : [],
      DEFAULT_AFFIRMATIONS
    );
    setAffirmations(merged.length > 0 ? merged : DEFAULT_AFFIRMATIONS);
    setUsageById(buildAffirmationUsageStats(sessions));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [tab, filters, sort, groupByTag]);

  function togglePairSelected(members: AffirmationItem[]) {
    const ids = members.map((item) => item.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function stampAffirmationPatch(patch: Partial<AffirmationItem>): Partial<AffirmationItem> {
    return {
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: actorLabel,
    };
  }

  function updateItem(id: string, patch: Partial<AffirmationItem>) {
    persist(affirmations.map((item) => (item.id === id ? {...item, ...stampAffirmationPatch(patch)} : item)));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(pageItems.map((item) => item.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function deleteAffirmation(item: AffirmationItem) {
    if (item.isDefault) return;
    const message = t('deleteConfirmMessage');
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message,
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;

    const previous = affirmations;
    const next = affirmations.filter((entry) => entry.id !== item.id);
    setAffirmations(next);
    if (detailId === item.id) setDetailId(null);
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.delete(item.id);
      return copy;
    });

    scheduleDeferredRitualCommit({
      key: 'admin-affirmations',
      commit: () => saveAffirmations(persistableAffirmations(next)),
      undo: () => setAffirmations(previous),
      toast,
      message: t('deletedUndo'),
      undoLabel: t('undo'),
    });
  }

  function hideAffirmation(item: AffirmationItem) {
    updateItem(item.id, {hiddenFromLibrary: true, active: false});
    toast.info(t('hiddenToast'));
  }

  function unhideAffirmation(item: AffirmationItem) {
    updateItem(item.id, {hiddenFromLibrary: false, active: true});
  }

  function startCreate(asDraft: boolean) {
    setEditingId('__new__');
    setDraft({
      type: 'text',
      title: '',
      textContent: '',
      youtubeUrl: '',
      tags: '',
      language: locale,
      active: !asDraft,
      weight: 1,
      isDraft: asDraft,
    });
    setDetailId(null);
  }

  function startEdit(item: AffirmationItem) {
    if (item.isDefault) return;
    setEditingId(item.id);
    setDraft({
      type: item.type,
      title: item.title,
      textContent: item.textContent,
      youtubeUrl: item.youtubeUrl ?? '',
      tags: item.tags.join(', '),
      language: item.language as AppLocale,
      active: item.active,
      weight: item.weight,
      isDraft: Boolean(item.isDraft),
    });
    setDetailId(item.id);
  }

  function saveEdit() {
    const tags = normalizeAffirmationTags(draft.tags);
    const youtubeVideoId =
      draft.type === 'youtube' ? extractYoutubeVideoId(draft.youtubeUrl) : null;

    if (editingId === '__new__') {
      const timestamp = new Date().toISOString();
      const item: AffirmationItem = {
        id: crypto.randomUUID(),
        type: draft.type,
        title: draft.title.trim(),
        textContent: draft.type === 'text' ? draft.textContent.trim() : '',
        youtubeVideoId,
        youtubeUrl: draft.type === 'youtube' ? draft.youtubeUrl.trim() : null,
        tags,
        language: draft.language,
        active: draft.active && !draft.isDraft,
        weight: draft.weight,
        lastUsedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actorLabel,
        isAdminManaged: true,
        isDraft: draft.isDraft,
      };
      persist([item, ...affirmations]);
      setEditingId(null);
      setDetailId(item.id);
      toast.success(t('saved'));
      return;
    }

    if (!editingId) return;
    updateItem(editingId, {
      type: draft.type,
      title: draft.title.trim(),
      textContent: draft.type === 'text' ? draft.textContent.trim() : '',
      youtubeVideoId,
      youtubeUrl: draft.type === 'youtube' ? draft.youtubeUrl.trim() : null,
      tags,
      language: draft.language,
      active: draft.active && !draft.isDraft,
      weight: draft.weight,
      isDraft: draft.isDraft,
    });
    setEditingId(null);
    toast.success(t('saved'));
  }

  function applyBulk(action: 'activate' | 'deactivate' | 'delete' | 'tag') {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (action === 'delete') {
      void (async () => {
        const ok = await confirm({
          title: t('bulkDeleteTitle'),
          message: t('bulkDeleteMessage', {count: ids.length}),
          confirmLabel: t('delete'),
          destructive: true,
        });
        if (!ok) return;
        const deletable = new Set(ids.filter((id) => !affirmations.find((item) => item.id === id)?.isDefault));
        persist(affirmations.filter((item) => !deletable.has(item.id)));
        clearSelection();
      })();
      return;
    }

    if (action === 'tag') {
      const tag = bulkTag.trim().toLowerCase();
      if (!tag) return;
      persist(
        affirmations.map((item) =>
          selectedIds.has(item.id) && !item.tags.includes(tag)
            ? {...item, tags: [...item.tags, tag]}
            : item
        )
      );
      setBulkTag('');
      return;
    }

    persist(
      affirmations.map((item) =>
        selectedIds.has(item.id)
          ? {...item, ...stampAffirmationPatch({active: action === 'activate'})}
          : item
      )
    );
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const imported = parseAffirmationsImport(text);
      if (imported.length === 0) {
        toast.error(t('importEmpty'));
        return;
      }
      const existingIds = new Set(affirmations.map((item) => item.id));
      const merged = [
        ...imported.map((item) => ({...item, id: existingIds.has(item.id) ? crypto.randomUUID() : item.id})),
        ...affirmations,
      ];
      persist(merged);
      toast.success(t('imported', {count: imported.length}));
    } catch {
      toast.error(t('importError'));
    }
  }

  function applyTagRename() {
    persist(renameAffirmationTag(affirmations, tagRenameFrom, tagRenameTo));
    setTagRenameFrom('');
    setTagRenameTo('');
    toast.success(t('tagsUpdated'));
  }

  function applyTagMerge() {
    const sources = tagMergeFrom.split(',').map((tag) => tag.trim()).filter(Boolean);
    persist(mergeAffirmationTags(affirmations, sources, tagMergeTo));
    setTagMergeFrom('');
    setTagMergeTo('');
    toast.success(t('tagsUpdated'));
  }

  const qualityLabel = (issue: AffirmationQualityIssue) => t(`quality.${issue}`);

  const paginationBar =
    !groupByTag && filteredPairs.length > PAGE_SIZE ? (
      <PaginationBar
        page={page}
        totalPages={totalPages}
        label={t('page', {page, total: totalPages})}
        prevLabel={t('prevPage')}
        nextLabel={t('nextPage')}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    ) : null;

  return (
    <div className="admin-affirmations admin-affirmations--split">
      <div className="admin-affirmations__list-col grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{t('title')}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminCreateButton onClick={() => startCreate(false)}>{t('add')}</AdminCreateButton>
            <AdminViewButton onClick={() => startCreate(true)}>{t('addDraft')}</AdminViewButton>
            <AdminViewButton onClick={() => setShowTagManager((value) => !value)}>{t('manageTags')}</AdminViewButton>
            <AdminViewButton onClick={() => importRef.current?.click()}>{t('import')}</AdminViewButton>
            <input
              ref={importRef}
              type="file"
              accept=".json,.csv,text/csv,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="admin-affirmations__tabs flex flex-wrap gap-2">
          {(['active', 'drafts', 'hidden', 'default', 'custom'] as AffirmationLibraryTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-bold ${
                tab === key ? 'border-white/35 bg-white/12 txt-strong' : 'border-white/10 bg-white/[0.03] txt-soft'
              }`}
              onClick={() => setTab(key)}
            >
              {t(`tabs.${key}`)} ({tabCounts[key]})
            </button>
          ))}
        </div>

        <div className="admin-affirmations__filter-bar grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="focus-ring admin-affirmations__input min-w-[12rem] flex-1"
              value={filters.query}
              placeholder={t('searchPlaceholder')}
              onChange={(event) => setFilters((prev) => ({...prev, query: event.target.value}))}
            />
            {activeFilterCount > 0 ? (
              <span className="admin-affirmations__filter-badge">{t('filters.activeCount', {count: activeFilterCount})}</span>
            ) : null}
            <button
              type="button"
              className="focus-ring btn-admin-view shrink-0"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {t('filters.panelTitle')} {filtersOpen ? '▴' : '▾'}
            </button>
          </div>

          {filtersOpen ? (
            <div className="admin-affirmations__filter-panel grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FilterSelect label={t('filters.language')} value={filters.language} onChange={(language) => setFilters((p) => ({...p, language}))} options={[['all', t('all')], ['he', 'עברית'], ['en', 'English']]} />
                <FilterSelect label={t('filters.type')} value={filters.type} onChange={(type) => setFilters((p) => ({...p, type}))} options={[['all', t('all')], ['text', t('type.text')], ['youtube', t('type.youtube')]]} />
                <FilterSelect label={t('filters.active')} value={filters.active} onChange={(active) => setFilters((p) => ({...p, active}))} options={[['all', t('all')], ['active', t('active')], ['inactive', t('inactive')]]} />
                <FilterSelect label={t('filters.origin')} value={filters.origin} onChange={(origin) => setFilters((p) => ({...p, origin}))} options={[['all', t('all')], ['default', t('origin.default')], ['custom', t('origin.custom')], ['admin', t('origin.admin')]]} />
                <FilterSelect label={t('filters.tag')} value={filters.tag} onChange={(tag) => setFilters((p) => ({...p, tag}))} options={[['all', t('all')], ...allTags.map((tag) => [tag, formatAffirmationTag(tag)] as const)]} />
                <FilterSelect label={t('sort.label')} value={sort} onChange={(value) => setSort(value as AffirmationSortKey)} options={[
                  ['createdAt', t('sort.createdAt')],
                  ['lastUsedAt', t('sort.lastUsedAt')],
                  ['title', t('sort.title')],
                  ['type', t('sort.type')],
                  ['language', t('sort.language')],
                  ['weight', t('sort.weight')],
                ]} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input type="checkbox" checked={groupByTag} onChange={(event) => setGroupByTag(event.target.checked)} />
                  {t('groupByTag')}
                </label>
                <span className="text-sm text-[var(--muted)]">
                  {t('showingPairs', {
                    pairs: filteredPairs.length,
                    items: filtered.length,
                    total: affirmations.length,
                  })}
                </span>
                <AdminViewButton onClick={() => setFilters(DEFAULT_FILTERS)}>{t('resetFilters')}</AdminViewButton>
              </div>
            </div>
          ) : null}
        </div>

        {showTagManager ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-bold txt-strong">{t('tagManagerTitle')}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-xs text-[var(--muted)]">{t('renameTag')}</p>
                <input className="focus-ring admin-affirmations__input" value={tagRenameFrom} placeholder={t('fromTag')} onChange={(e) => setTagRenameFrom(e.target.value)} />
                <input className="focus-ring admin-affirmations__input" value={tagRenameTo} placeholder={t('toTag')} onChange={(e) => setTagRenameTo(e.target.value)} />
                <AdminViewButton onClick={applyTagRename}>{t('applyRename')}</AdminViewButton>
              </div>
              <div className="grid gap-2">
                <p className="text-xs text-[var(--muted)]">{t('mergeTags')}</p>
                <input className="focus-ring admin-affirmations__input" value={tagMergeFrom} placeholder={t('mergeFrom')} onChange={(e) => setTagMergeFrom(e.target.value)} />
                <input className="focus-ring admin-affirmations__input" value={tagMergeTo} placeholder={t('mergeTo')} onChange={(e) => setTagMergeTo(e.target.value)} />
                <AdminViewButton onClick={applyTagMerge}>{t('applyMerge')}</AdminViewButton>
              </div>
            </div>
          </div>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <span className="text-sm font-semibold txt-strong">{t('selected', {count: selectedIds.size})}</span>
            <AdminViewButton onClick={() => applyBulk('activate')}>{t('bulkActivate')}</AdminViewButton>
            <AdminViewButton onClick={() => applyBulk('deactivate')}>{t('bulkDeactivate')}</AdminViewButton>
            <input className="focus-ring admin-affirmations__input max-w-[10rem]" value={bulkTag} placeholder={t('bulkTagPlaceholder')} onChange={(e) => setBulkTag(e.target.value)} />
            <AdminViewButton onClick={() => applyBulk('tag')}>{t('bulkAddTag')}</AdminViewButton>
            <AdminActionButton destructive onClick={() => applyBulk('delete')}>{t('bulkDelete')}</AdminActionButton>
            <AdminViewButton onClick={clearSelection}>{t('clearSelection')}</AdminViewButton>
          </div>
        ) : (
          <div className="flex gap-2">
            <AdminViewButton onClick={selectAllVisible}>{t('selectVisible')}</AdminViewButton>
          </div>
        )}

        {filteredPairs.length === 0 ? (
          <AdminEmptyState title={t('emptyTitle')} description={t('emptyDetail')} />
        ) : (
          <>
            {paginationBar}
            <div className="admin-affirmations__list-scroll grid gap-2">
              {groupByTag && groupedPairs ? (
                <div className="grid gap-4">
                  {[...groupedPairs.entries()].map(([tag, pairs]) => (
                    <section key={tag}>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-white/45">
                        {tag === '__untagged__' ? t('untagged') : `#${formatAffirmationTag(tag)}`}
                      </h4>
                      <div className="grid gap-2">
                        {pairs.map((pair) => (
                          <AffirmationPairRow
                            key={pair.key}
                            pair={pair}
                            locale={locale}
                            detailId={detailId}
                            duplicateIds={duplicateIds}
                            qualityLabel={qualityLabel}
                            selectedIds={selectedIds}
                            t={t}
                            usageById={usageById}
                            onDelete={(item) => void deleteAffirmation(item)}
                            onEdit={startEdit}
                            onHide={hideAffirmation}
                            onSelect={setDetailId}
                            onToggleMember={(id) => toggleSelected(id)}
                            onTogglePair={(members) => togglePairSelected(members)}
                            onUnhide={unhideAffirmation}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                pagePairs.map((pair) => (
                  <AffirmationPairRow
                    key={pair.key}
                    pair={pair}
                    locale={locale}
                    detailId={detailId}
                    duplicateIds={duplicateIds}
                    qualityLabel={qualityLabel}
                    selectedIds={selectedIds}
                    t={t}
                    usageById={usageById}
                    onDelete={(item) => void deleteAffirmation(item)}
                    onEdit={startEdit}
                    onHide={hideAffirmation}
                    onSelect={setDetailId}
                    onToggleMember={(id) => toggleSelected(id)}
                    onTogglePair={(members) => togglePairSelected(members)}
                    onUnhide={unhideAffirmation}
                  />
                ))
              )}
            </div>
            {paginationBar}
          </>
        )}
      </div>

      <aside className="admin-affirmations__detail rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {editingId ? (
          <EditPanel
            draft={draft}
            setDraft={setDraft}
            onSave={saveEdit}
            onCancel={() => setEditingId(null)}
            isNew={editingId === '__new__'}
          />
        ) : detailItem ? (
          <DetailPanel
            item={detailItem}
            usage={usageById.get(detailItem.id)}
            issues={getAffirmationQualityIssues(detailItem, duplicateIds)}
            qualityLabel={qualityLabel}
            onEdit={() => startEdit(detailItem)}
            onDelete={() => void deleteAffirmation(detailItem)}
            onHide={() => hideAffirmation(detailItem)}
            onUnhide={() => unhideAffirmation(detailItem)}
          />
        ) : (
          <div className="text-sm text-[var(--muted)]">{t('selectItem')}</div>
        )}
      </aside>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="admin-affirmations__pagination flex flex-wrap items-center gap-3">
      <AdminViewButton disabled={page <= 1} onClick={onPrev}>
        {prevLabel}
      </AdminViewButton>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <AdminViewButton disabled={page >= totalPages} onClick={onNext}>
        {nextLabel}
      </AdminViewButton>
    </div>
  );
}

function AffirmationPairRow({
  pair,
  locale,
  detailId,
  duplicateIds,
  qualityLabel,
  selectedIds,
  t,
  usageById,
  onDelete,
  onEdit,
  onHide,
  onSelect,
  onToggleMember,
  onTogglePair,
  onUnhide,
}: {
  pair: AffirmationPairGroup;
  locale: AppLocale;
  detailId: string | null;
  duplicateIds: Set<string>;
  qualityLabel: (issue: AffirmationQualityIssue) => string;
  selectedIds: Set<string>;
  t: ReturnType<typeof useTranslations<'admin.affirmations'>>;
  usageById: Map<string, {selectedCount: number; lastSelectedAt: string | null}>;
  onDelete: (item: AffirmationItem) => void;
  onEdit: (item: AffirmationItem) => void;
  onHide: (item: AffirmationItem) => void;
  onSelect: (id: string) => void;
  onToggleMember: (id: string) => void;
  onTogglePair: (members: AffirmationItem[]) => void;
  onUnhide: (item: AffirmationItem) => void;
}) {
  const members = getAffirmationPairMembers(pair);
  const hasPairTabs = Boolean(pair.he && pair.en);
  const [localeTab, setLocaleTab] = useState<'he' | 'en'>(pair.he ? 'he' : 'en');

  useEffect(() => {
    if (detailId && pair.he?.id === detailId) setLocaleTab('he');
    if (detailId && pair.en?.id === detailId) setLocaleTab('en');
  }, [detailId, pair.he?.id, pair.en?.id]);

  const activeItem =
    localeTab === 'he'
      ? pair.he ?? pair.en ?? members[0]
      : pair.en ?? pair.he ?? members[0];

  if (!activeItem) return null;

  const issues = getAffirmationQualityIssues(activeItem, duplicateIds);
  const usage = usageById.get(activeItem.id);
  const source = resolveAffirmationSource(activeItem);
  const pairSelected = members.length > 0 && members.every((item) => selectedIds.has(item.id));
  const rowActive = members.some((item) => item.id === detailId);
  const updatedAt = activeItem.updatedAt ?? activeItem.createdAt;
  const updatedBy =
    activeItem.updatedBy ??
    (activeItem.isDefault ? t('meta.system') : activeItem.isAdminManaged ? t('meta.admin') : t('meta.user'));

  return (
    <div
      className={`admin-affirmations__row rounded-xl border p-3 ${
        rowActive ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={pairSelected}
          onChange={() => (members.length > 1 ? onTogglePair(members) : onToggleMember(activeItem.id))}
        />
        <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onSelect(activeItem.id)}>
          <div className="flex flex-wrap items-center gap-2">
            {hasPairTabs ? (
              <span className="admin-affirmations__pair-tabs" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className={`admin-affirmations__pair-tab ${localeTab === 'he' ? 'admin-affirmations__pair-tab--active' : ''}`}
                  onClick={() => {
                    setLocaleTab('he');
                    if (pair.he) onSelect(pair.he.id);
                  }}
                >
                  HE
                </button>
                <button
                  type="button"
                  className={`admin-affirmations__pair-tab ${localeTab === 'en' ? 'admin-affirmations__pair-tab--active' : ''}`}
                  onClick={() => {
                    setLocaleTab('en');
                    if (pair.en) onSelect(pair.en.id);
                  }}
                >
                  EN
                </button>
              </span>
            ) : (
              <span className="admin-affirmations__pair-tab admin-affirmations__pair-tab--active">
                {activeItem.language.toUpperCase()}
              </span>
            )}
            <span className="font-semibold txt-strong">{activeItem.title || t('untitled')}</span>
            {hasPairTabs ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{t('pairBadge')}</span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">
            {activeItem.type === 'youtube' ? activeItem.youtubeUrl : activeItem.textContent}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <AdminMetaItem label={t('filters.type')} value={t(`type.${activeItem.type}`)} />
            <AdminMetaItem label={t('filters.origin')} value={t(`origin.${source}`)} />
            <AdminMetaItem label={t('filters.active')} value={activeItem.active ? t('active') : t('inactive')} />
            {activeItem.isDraft ? <AdminMetaItem label={t('draft')} value={t('yes')} /> : null}
            {activeItem.hiddenFromLibrary ? <AdminMetaItem label={t('hidden')} value={t('yes')} /> : null}
            {usage ? <AdminMetaItem label={t('fields.selectedCount')} value={String(usage.selectedCount)} /> : null}
          </div>
          {activeItem.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <AdminMetaItem
                label={t('filters.tag')}
                value={activeItem.tags.slice(0, 4).map((tag) => `#${formatAffirmationTag(tag)}`).join(', ')}
              />
            </div>
          ) : null}
          {issues.length > 0 ? (
            <p className="mt-2 text-[11px] text-amber-200">{issues.map(qualityLabel).join(' · ')}</p>
          ) : null}
          <p className="admin-affirmations__row-meta mt-2 text-[11px] text-white/40">
            {t('meta.created', {date: formatAdminTimestamp(activeItem.createdAt, locale)})}
            {' · '}
            {t('meta.updated', {date: formatAdminTimestamp(updatedAt, locale), by: updatedBy})}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          {!activeItem.isDefault ? (
            <AdminViewButton className="text-xs" onClick={() => onEdit(activeItem)}>
              {t('edit')}
            </AdminViewButton>
          ) : null}
          {activeItem.isDefault ? (
            activeItem.hiddenFromLibrary ? (
              <AdminViewButton className="text-xs" onClick={() => onUnhide(activeItem)}>
                {t('unhide')}
              </AdminViewButton>
            ) : (
              <AdminViewButton className="text-xs" onClick={() => onHide(activeItem)}>
                {t('hide')}
              </AdminViewButton>
            )
          ) : (
            <AdminActionButton className="text-xs" destructive onClick={() => onDelete(activeItem)}>
              {t('delete')}
            </AdminActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">{label}</span>
      <select className="focus-ring admin-affirmations__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
    </label>
  );
}

function DetailPanel({
  item,
  usage,
  issues,
  qualityLabel,
  onEdit,
  onDelete,
  onHide,
  onUnhide,
}: {
  item: AffirmationItem;
  usage?: {selectedCount: number; lastSelectedAt: string | null};
  issues: AffirmationQualityIssue[];
  qualityLabel: (issue: AffirmationQualityIssue) => string;
  onEdit: () => void;
  onDelete: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const t = useTranslations('admin.affirmations');
  const source = resolveAffirmationSource(item);

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{t('detailTitle')}</p>
        <h4 className="mt-2 text-lg font-black txt-strong">{item.title}</h4>
        <p className="mt-1 text-sm text-[var(--muted)]">{t(`originHelp.${source}`)}</p>
      </div>

      <PreviewCard item={item} />

      <dl className="grid gap-2 text-sm">
        <DetailRow label={t('fields.type')} value={t(`type.${item.type}`)} />
        <DetailRow label={t('fields.language')} value={item.language} />
        <DetailRow label={t('fields.weight')} value={String(item.weight)} />
        <DetailRow label={t('fields.active')} value={item.active ? t('yes') : t('no')} />
        <DetailRow label={t('fields.createdAt')} value={new Date(item.createdAt).toLocaleString()} />
        <DetailRow
          label={t('fields.updatedAt')}
          value={new Date(item.updatedAt ?? item.createdAt).toLocaleString()}
        />
        <DetailRow
          label={t('fields.updatedBy')}
          value={
            item.updatedBy ??
            (item.isDefault ? t('meta.system') : item.isAdminManaged ? t('meta.admin') : t('meta.user'))
          }
        />
        <DetailRow label={t('fields.lastUsedAt')} value={item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : t('never')} />
        {usage ? (
          <>
            <DetailRow label={t('fields.selectedCount')} value={String(usage.selectedCount)} />
            <DetailRow label={t('fields.lastSelectedAt')} value={usage.lastSelectedAt ? new Date(usage.lastSelectedAt).toLocaleString() : t('never')} />
          </>
        ) : null}
      </dl>

      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-xs">#{formatAffirmationTag(tag)}</span>
          ))}
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-sm text-amber-100">
          <p className="font-bold">{t('qualityTitle')}</p>
          <ul className="mt-2 list-disc ps-5">
            {issues.map((issue) => (
              <li key={issue}>{qualityLabel(issue)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!item.isDefault ? <AdminViewButton onClick={onEdit}>{t('edit')}</AdminViewButton> : null}
        {item.isDefault ? (
          item.hiddenFromLibrary ? (
            <AdminViewButton onClick={onUnhide}>{t('unhide')}</AdminViewButton>
          ) : (
            <AdminViewButton onClick={onHide}>{t('hide')}</AdminViewButton>
          )
        ) : (
          <AdminActionButton destructive onClick={onDelete}>{t('delete')}</AdminActionButton>
        )}
      </div>
    </div>
  );
}

function EditPanel({
  draft,
  setDraft,
  onSave,
  onCancel,
  isNew,
}: {
  draft: {
    type: AffirmationType;
    title: string;
    textContent: string;
    youtubeUrl: string;
    tags: string;
    language: AppLocale;
    active: boolean;
    weight: number;
    isDraft: boolean;
  };
  setDraft: Dispatch<
    SetStateAction<{
      type: AffirmationType;
      title: string;
      textContent: string;
      youtubeUrl: string;
      tags: string;
      language: AppLocale;
      active: boolean;
      weight: number;
      isDraft: boolean;
    }>
  >;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const t = useTranslations('admin.affirmations');
  const previewItem: AffirmationItem = {
    id: 'preview',
    type: draft.type,
    title: draft.title,
    textContent: draft.textContent,
    youtubeVideoId: extractYoutubeVideoId(draft.youtubeUrl),
    youtubeUrl: draft.youtubeUrl || null,
    tags: normalizeAffirmationTags(draft.tags),
    language: draft.language,
    active: draft.active,
    weight: draft.weight,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    isDraft: draft.isDraft,
  };

  return (
    <div className="grid gap-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{isNew ? t('createTitle') : t('editTitle')}</p>
      <label className="grid gap-1 text-sm">
        <span>{t('fields.type')}</span>
        <select className="focus-ring admin-affirmations__select" value={draft.type} onChange={(e) => setDraft((d) => ({...d, type: e.target.value as AffirmationType}))}>
          <option value="text">{t('type.text')}</option>
          <option value="youtube">{t('type.youtube')}</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span>{t('fields.title')}</span>
        <input className="focus-ring admin-affirmations__input" value={draft.title} onChange={(e) => setDraft((d) => ({...d, title: e.target.value}))} />
      </label>
      {draft.type === 'text' ? (
        <label className="grid gap-1 text-sm">
          <span>{t('fields.text')}</span>
          <textarea className="focus-ring textarea-base min-h-28" value={draft.textContent} onChange={(e) => setDraft((d) => ({...d, textContent: e.target.value}))} />
        </label>
      ) : (
        <label className="grid gap-1 text-sm">
          <span>{t('fields.youtubeUrl')}</span>
          <input className="focus-ring admin-affirmations__input" value={draft.youtubeUrl} onChange={(e) => setDraft((d) => ({...d, youtubeUrl: e.target.value}))} />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span>{t('fields.tags')}</span>
        <input className="focus-ring admin-affirmations__input" value={draft.tags} onChange={(e) => setDraft((d) => ({...d, tags: e.target.value}))} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span>{t('fields.language')}</span>
          <select className="focus-ring admin-affirmations__select" value={draft.language} onChange={(e) => setDraft((d) => ({...d, language: e.target.value as AppLocale}))}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t('fields.weight')}</span>
          <input type="number" min={1} max={10} className="focus-ring admin-affirmations__input" value={draft.weight} onChange={(e) => setDraft((d) => ({...d, weight: Number(e.target.value) || 1}))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({...d, active: e.target.checked}))} />
        {t('fields.active')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.isDraft} onChange={(e) => setDraft((d) => ({...d, isDraft: e.target.checked, active: e.target.checked ? false : d.active}))} />
        {t('fields.draft')}
      </label>

      <PreviewCard item={previewItem} />

      <div className="flex gap-2">
        <AdminActionButton onClick={onSave}>{t('save')}</AdminActionButton>
        <AdminViewButton onClick={onCancel}>{t('cancel')}</AdminViewButton>
      </div>
    </div>
  );
}

function PreviewCard({item}: {item: AffirmationItem}) {
  const t = useTranslations('admin.affirmations');
  return (
    <div className="rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/8 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{t('previewTitle')}</p>
      <p className="mt-3 text-lg font-black txt-strong">{item.title || t('untitled')}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {item.type === 'youtube' ? item.youtubeUrl : item.textContent}
      </p>
    </div>
  );
}

function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <div className="border-b border-white/6 pb-2">
      <AdminMetaItem label={label} value={value} />
    </div>
  );
}
