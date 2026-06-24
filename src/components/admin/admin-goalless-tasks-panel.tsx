'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useMemo, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import type {AdminActivityKey} from '@/lib/admin/admin-activity';
import {recordAdminActivity} from '@/lib/admin/admin-activity';
import {
  duplicateCuratedTask,
  exportCuratedTasksForDomain,
  isCuratedTaskVisibleInPicker,
  loadCuratedTaskLibrary,
  newCuratedTask,
  resetCuratedTasksForDomain,
  saveCuratedTaskLibrary,
  type AdminCuratedTask,
  type CuratedTaskStatus,
} from '@/lib/life-coach/curated-task-library';
import {LIFE_DOMAINS, type LifeDomain} from '@/lib/life-coach/types';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {
  AdminActionButton,
  AdminCreateButton,
  AdminEmptyState,
  AdminMetaItem,
  AdminPrimaryButton,
  AdminViewButton,
} from '@/components/admin/admin-shell';

const STATUSES: CuratedTaskStatus[] = ['draft', 'published', 'archived'];
const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;

export function AdminGoallessTasksPanel({onActivity}: {onActivity?: (key: AdminActivityKey) => void}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const {confirm} = useConfirm();

  const [tasks, setTasks] = useState<AdminCuratedTask[]>([]);
  const [domain, setDomain] = useState<LifeDomain>('health');
  const [statusFilter, setStatusFilter] = useState<CuratedTaskStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCuratedTask | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setTasks(loadCuratedTaskLibrary()), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((task) => task.world === domain)
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => {
        if (!q) return true;
        return [task.id, task.title.he, task.title.en, task.description.he, task.description.en, task.type, ...task.tags]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [tasks, domain, statusFilter, query]);

  const selected = tasks.find((task) => task.id === selectedId) ?? filtered[0] ?? null;
  const publishedCount = tasks.filter((task) => task.world === domain && isCuratedTaskVisibleInPicker(task)).length;

  function notifySave() {
    if (onActivity) onActivity('goallessTasksSave');
    else recordAdminActivity('goallessTasksSave');
  }

  function persist(next: AdminCuratedTask[]) {
    setTasks(next);
    saveCuratedTaskLibrary(next);
    notifySave();
  }

  function saveTask(task: AdminCuratedTask) {
    const timestamp = new Date().toISOString();
    const nextTask = {...task, updatedAt: timestamp, isAdminManaged: true};
    const exists = tasks.some((item) => item.id === task.id);
    persist(exists ? tasks.map((item) => (item.id === task.id ? nextTask : item)) : [nextTask, ...tasks]);
    setSelectedId(nextTask.id);
    setEditing(null);
    toast.success(t('admin.goallessTasks.savedToast'));
  }

  function startCreate() {
    const task = newCuratedTask(domain);
    setEditing(task);
    setSelectedId(task.id);
  }

  function startEdit(task: AdminCuratedTask) {
    setEditing({...task});
    setSelectedId(task.id);
  }

  async function removeTask(task: AdminCuratedTask) {
    const ok = await confirm({
      title: t('admin.goallessTasks.deleteConfirmTitle'),
      message: t('admin.goallessTasks.deleteConfirmMessage'),
      confirmLabel: t('admin.goallessTasks.delete'),
      destructive: true,
    });
    if (!ok) return;
    if (task.isDefault) {
      persist(tasks.map((item) => (item.id === task.id ? {...item, hiddenFromLibrary: true, status: 'archived', updatedAt: new Date().toISOString()} : item)));
    } else {
      persist(tasks.filter((item) => item.id !== task.id));
    }
    if (selectedId === task.id) setSelectedId(null);
    setEditing(null);
    toast.success(t('admin.goallessTasks.deletedToast'));
  }

  async function resetDomain() {
    const ok = await confirm({
      title: t('admin.goallessTasks.resetConfirmTitle'),
      message: t('admin.goallessTasks.resetConfirmMessage'),
      confirmLabel: t('admin.goallessTasks.reset'),
      destructive: true,
    });
    if (!ok) return;
    const next = resetCuratedTasksForDomain(tasks, domain);
    setTasks(next);
    saveCuratedTaskLibrary(next);
    setEditing(null);
    notifySave();
    toast.success(t('admin.goallessTasks.resetToast'));
  }

  function exportDomainJson() {
    const payload = exportCuratedTasksForDomain(tasks, domain);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${domain}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.goallessTasks.exportToast'));
  }

  return (
    <section className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black txt-strong">{t('admin.goallessTasks.title')}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-[var(--muted)]">{t('admin.goallessTasks.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminViewButton onClick={exportDomainJson}>{t('admin.goallessTasks.export')}</AdminViewButton>
          <AdminCreateButton onClick={startCreate}>{t('admin.goallessTasks.add')}</AdminCreateButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LIFE_DOMAINS.map((item) => (
          <button
            key={item}
            type="button"
            className={`focus-ring rounded-full border px-3 py-1.5 text-sm font-semibold ${
              domain === item ? 'border-[var(--blue)] bg-[var(--blue)]/15 text-[var(--blue)]' : 'border-white/10'
            }`}
            onClick={() => {
              setDomain(item);
              setSelectedId(null);
              setEditing(null);
            }}
          >
            {t(`lifeCoach.domains.${item}.short`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="focus-ring input-base min-w-[12rem] flex-1"
          value={query}
          placeholder={t('admin.goallessTasks.searchPlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="focus-ring input-base"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CuratedTaskStatus | 'all')}
        >
          <option value="all">{t('admin.goallessTasks.statusAll')}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`admin.goallessTasks.statuses.${status}`)}
            </option>
          ))}
        </select>
        <span className="text-sm text-[var(--muted)]">
          {t('admin.goallessTasks.publishedCount', {count: publishedCount})}
        </span>
      </div>

      <div className="admin-affirmations admin-affirmations--split gap-4">
        <div className="grid min-w-0 gap-2">
          {filtered.length === 0 ? (
            <AdminEmptyState
              title={t('admin.goallessTasks.emptyTitle')}
              description={t('admin.goallessTasks.emptyDetail')}
              actionLabel={t('admin.goallessTasks.add')}
              onAction={startCreate}
            />
          ) : null}
          {filtered.map((task) => {
            const active = selected?.id === task.id;
            const title = task.title[locale] || task.title.he || task.title.en;
            return (
              <button
                key={task.id}
                type="button"
                className={`panel-surface w-full p-3 text-start ${active ? 'ring-1 ring-[var(--blue)]/40' : ''}`}
                onClick={() => {
                  setSelectedId(task.id);
                  setEditing(null);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold txt-strong">{title || t('admin.goallessTasks.untitled')}</p>
                  {task.isDefault ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {t('admin.goallessTasks.builtinBadge')}
                    </span>
                  ) : null}
                  {task.hiddenFromLibrary ? (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                      {t('admin.goallessTasks.hiddenBadge')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <AdminMetaItem label={t('admin.goallessTasks.statusLabel')} value={t(`admin.goallessTasks.statuses.${task.status}`)} />
                  <AdminMetaItem label={t('admin.goallessTasks.minutesLabel')} value={task.durationMinutes} />
                  <AdminMetaItem label={t('admin.goallessTasks.difficultyLabel')} value={task.difficulty} />
                </div>
              </button>
            );
          })}
        </div>

        <aside className="admin-affirmations__detail panel-surface sticky top-24 p-4">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">{t('admin.goallessTasks.selectHint')}</p>
          ) : editing ? (
            <TaskEditor
              task={editing}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSave={() => saveTask(editing)}
            />
          ) : (
            <TaskPreview
              task={selected}
              locale={locale}
              onEdit={() => startEdit(selected)}
              onDuplicate={() => {
                const copy = duplicateCuratedTask(selected, domain);
                setEditing(copy);
                setSelectedId(copy.id);
              }}
              onDelete={() => void removeTask(selected)}
              onReset={() => void resetDomain()}
            />
          )}
        </aside>
      </div>
    </section>
  );
}

function TaskPreview({
  task,
  locale,
  onEdit,
  onDuplicate,
  onDelete,
  onReset,
}: {
  task: AdminCuratedTask;
  locale: AppLocale;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-4">
      <div>
        <h4 className="text-base font-black txt-strong">{task.title[locale] || task.title.he || task.title.en}</h4>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          {task.description[locale] || task.description.he || task.description.en}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <AdminMetaItem label={t('admin.goallessTasks.idLabel')} value={task.id} />
        <AdminMetaItem label={t('admin.goallessTasks.typeLabel')} value={task.type} />
        <AdminMetaItem label={t('admin.goallessTasks.energyLabel')} value={task.energy} />
        <AdminMetaItem label={t('admin.goallessTasks.tagsLabel')} value={task.tags.join(', ') || '—'} />
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminPrimaryButton onClick={onEdit}>{t('admin.goallessTasks.edit')}</AdminPrimaryButton>
        <AdminViewButton onClick={onDuplicate}>{t('admin.goallessTasks.duplicate')}</AdminViewButton>
        <AdminActionButton destructive onClick={onDelete}>{t('admin.goallessTasks.delete')}</AdminActionButton>
        <AdminViewButton onClick={onReset}>{t('admin.goallessTasks.reset')}</AdminViewButton>
      </div>
    </div>
  );
}

function TaskEditor({
  task,
  onChange,
  onCancel,
  onSave,
}: {
  task: AdminCuratedTask;
  onChange: (task: AdminCuratedTask) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useTranslations();

  function update(patch: Partial<AdminCuratedTask>) {
    onChange({...task, ...patch});
  }

  function updateLocalized(field: 'title' | 'description', lang: 'he' | 'en', value: string) {
    onChange({...task, [field]: {...task[field], [lang]: value}});
  }

  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('admin.goallessTasks.titleHe')}</span>
        <input className="focus-ring input-base" value={task.title.he} onChange={(e) => updateLocalized('title', 'he', e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('admin.goallessTasks.titleEn')}</span>
        <input className="focus-ring input-base" value={task.title.en} onChange={(e) => updateLocalized('title', 'en', e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('admin.goallessTasks.descriptionHe')}</span>
        <textarea className="focus-ring input-base min-h-20" value={task.description.he} onChange={(e) => updateLocalized('description', 'he', e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('admin.goallessTasks.descriptionEn')}</span>
        <textarea className="focus-ring input-base min-h-20" value={task.description.en} onChange={(e) => updateLocalized('description', 'en', e.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.domainLabel')}</span>
          <select className="focus-ring input-base" value={task.world} onChange={(e) => update({world: e.target.value as LifeDomain})}>
            {LIFE_DOMAINS.map((item) => (
              <option key={item} value={item}>{t(`lifeCoach.domains.${item}.short`)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.statusLabel')}</span>
          <select className="focus-ring input-base" value={task.status} onChange={(e) => update({status: e.target.value as CuratedTaskStatus})}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{t(`admin.goallessTasks.statuses.${status}`)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.minutesLabel')}</span>
          <input type="number" min={1} max={120} className="focus-ring input-base" value={task.durationMinutes} onChange={(e) => update({durationMinutes: Math.max(1, Math.min(120, e.target.valueAsNumber || 1))})} />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.difficultyLabel')}</span>
          <select className="focus-ring input-base" value={task.difficulty} onChange={(e) => update({difficulty: Number(e.target.value) as 1 | 2 | 3})}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.energyLabel')}</span>
          <select className="focus-ring input-base" value={task.energy} onChange={(e) => update({energy: e.target.value as AdminCuratedTask['energy']})}>
            {ENERGY_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('admin.goallessTasks.typeLabel')}</span>
          <input className="focus-ring input-base" value={task.type} onChange={(e) => update({type: e.target.value})} />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="field-label mb-0">{t('admin.goallessTasks.tagsLabel')}</span>
        <input
          className="focus-ring input-base"
          value={task.tags.join(', ')}
          onChange={(e) => update({tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean)})}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={task.repeatable} onChange={(e) => update({repeatable: e.target.checked})} />
        {t('admin.goallessTasks.repeatableLabel')}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(task.hiddenFromLibrary)} onChange={(e) => update({hiddenFromLibrary: e.target.checked})} />
        {t('admin.goallessTasks.hiddenLabel')}
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <AdminViewButton onClick={onCancel}>{t('admin.goallessTasks.cancel')}</AdminViewButton>
        <AdminPrimaryButton
          disabled={!task.title.he.trim() && !task.title.en.trim()}
          onClick={onSave}
        >
          {t('admin.goallessTasks.save')}
        </AdminPrimaryButton>
      </div>
      <p className="text-xs text-[var(--muted)]">{t('admin.goallessTasks.localNote')}</p>
    </div>
  );
}
