'use client';

import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {useLocale} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {LIFE_DOMAINS, type LifeDomain} from '@/lib/life-coach/types';
import {
  duplicateDomainDefaultGoal,
  loadDomainDefaultGoals,
  saveDomainDefaultGoals,
  validateDomainDefaultGoal,
  type DomainDefaultGoal,
  type DomainDefaultGoalIssue,
  type DomainDefaultGoalStatus,
} from '@/lib/domain-default-goals';
import {AdminActionButton, AdminEmptyState, AdminViewButton} from '@/components/admin/admin-shell';

const GOAL_STATUSES: DomainDefaultGoalStatus[] = ['draft', 'needs_review', 'published', 'archived'];

const DOMAIN_LABELS: Record<AppLocale, Record<LifeDomain, string>> = {
  he: {
    health: 'בריאות',
    time: 'זמן',
    wealth: 'כסף',
    career: 'קריירה',
    relationships: 'מערכות יחסים',
    mind: 'מיינד',
    spirit: 'רוח',
    house_family: 'בית ומשפחה',
  },
  en: {
    health: 'Health',
    time: 'Time',
    wealth: 'Wealth',
    career: 'Career',
    relationships: 'Relationships',
    mind: 'Mind',
    spirit: 'Spirit',
    house_family: 'House & family',
  },
};

const COPY = {
  he: {
    title: 'יעדי ברירת מחדל לפי עולם',
    description: 'עריכת יעדי פתיחה לכל עולם בלי לגעת בקבצי JSON. כרגע נשמר מקומית באדמין ומוכן לחיבור DB/publish.',
    add: 'יעד חדש',
    duplicate: 'שכפל',
    edit: 'עריכה',
    archive: 'ארכוב',
    save: 'שמור',
    cancel: 'ביטול',
    publish: 'פרסם',
    unarchive: 'החזר לפעילים',
    deleteStep: 'מחק צעד',
    moveUp: 'למעלה',
    moveDown: 'למטה',
    domain: 'עולם',
    status: 'סטטוס',
    locale: 'שפה',
    category: 'קטגוריה',
    titleField: 'כותרת',
    descriptionField: 'תיאור',
    successMetric: 'מדד הצלחה',
    milestones: 'אבני דרך',
    milestone30: '30 יום',
    milestone60: '60 יום',
    milestone90: '90 יום',
    babySteps: 'צעדים ראשונים',
    tags: 'תגיות',
    risk: 'סיכון',
    preview: 'תצוגה מקדימה',
    quality: 'בדיקת איכות',
    noIssues: 'נראה מוכן לשימוש',
    empty: 'אין יעדים בפילטר הזה',
    all: 'הכל',
    activeOnly: 'פעילים בלבד',
    clearFilters: 'נקה פילטרים',
    select: 'בחר',
    selected: 'נבחרו',
    bulkPublish: 'פרסם נבחרים',
    bulkReview: 'העבר לבדיקה',
    bulkArchive: 'ארכב נבחרים',
    sort: 'מיון',
    sortUpdated: 'עודכנו לאחרונה',
    sortQuality: 'איכות',
    sortStatus: 'סטטוס',
    sortTitle: 'שם',
    allLanguages: 'כל השפות',
    originalDefault: 'ברירת מחדל מקורית',
    unsaved: 'יש שינויים לא שמורים',
    active: 'פעיל',
    inactive: 'לא פעיל',
    ready: 'מוכן',
    needsWork: 'דורש השלמה',
    missingContent: 'חסר תוכן',
    domainSummary: 'סיכום עולם',
    goals: 'יעדים',
    published: 'מפורסמים',
    needsReview: 'לבדיקה',
    drafts: 'טיוטות',
    showUserPreview: 'כך המשתמש יראה את היעד',
    editSections: {
      basics: 'מידע בסיסי',
      success: 'מדדי הצלחה',
      roadmap: 'אבני דרך',
      steps: 'צעדים ראשונים',
      publishing: 'פרסום ובקרה',
    },
    confirmDiscard: 'יש שינויים שלא נשמרו. לצאת בלי לשמור?',
    search: 'חיפוש לפי כותרת, קטגוריה או תגית',
    statuses: {draft: 'טיוטה', needs_review: 'דורש בדיקה', published: 'מפורסם', archived: 'בארכיון'},
    issues: {
      missing_title: 'חסרה כותרת',
      missing_description: 'חסר תיאור',
      missing_success_metric: 'חסר מדד הצלחה',
      missing_milestones: 'חסרות אבני דרך 30/60',
      missing_baby_steps: 'חסר לפחות צעד ראשון אחד',
      too_many_baby_steps: 'יותר מדי צעדים ראשונים',
      missing_tags: 'חסרות תגיות',
    },
  },
  en: {
    title: 'Default goals by domain',
    description: 'Edit starter goals for every domain without touching JSON. Currently saved locally in Admin and ready for DB/publish wiring.',
    add: 'New goal',
    duplicate: 'Duplicate',
    edit: 'Edit',
    archive: 'Archive',
    save: 'Save',
    cancel: 'Cancel',
    publish: 'Publish',
    unarchive: 'Restore',
    deleteStep: 'Delete step',
    moveUp: 'Up',
    moveDown: 'Down',
    domain: 'Domain',
    status: 'Status',
    locale: 'Language',
    category: 'Category',
    titleField: 'Title',
    descriptionField: 'Description',
    successMetric: 'Success metric',
    milestones: 'Milestones',
    milestone30: '30 days',
    milestone60: '60 days',
    milestone90: '90 days',
    babySteps: 'Starter steps',
    tags: 'Tags',
    risk: 'Risk',
    preview: 'Preview',
    quality: 'Quality check',
    noIssues: 'Looks ready to use',
    empty: 'No goals match this filter',
    all: 'All',
    activeOnly: 'Active only',
    clearFilters: 'Clear filters',
    select: 'Select',
    selected: 'selected',
    bulkPublish: 'Publish selected',
    bulkReview: 'Move to review',
    bulkArchive: 'Archive selected',
    sort: 'Sort',
    sortUpdated: 'Recently updated',
    sortQuality: 'Quality',
    sortStatus: 'Status',
    sortTitle: 'Name',
    allLanguages: 'All languages',
    originalDefault: 'Original default',
    unsaved: 'Unsaved changes',
    active: 'Active',
    inactive: 'Inactive',
    ready: 'Ready',
    needsWork: 'Needs work',
    missingContent: 'Missing content',
    domainSummary: 'Domain summary',
    goals: 'goals',
    published: 'published',
    needsReview: 'needs review',
    drafts: 'drafts',
    showUserPreview: 'How users will see this goal',
    editSections: {
      basics: 'Basics',
      success: 'Success metric',
      roadmap: 'Milestones',
      steps: 'Starter steps',
      publishing: 'Publishing and review',
    },
    confirmDiscard: 'You have unsaved changes. Leave without saving?',
    search: 'Search by title, category, or tag',
    statuses: {draft: 'Draft', needs_review: 'Needs review', published: 'Published', archived: 'Archived'},
    issues: {
      missing_title: 'Missing title',
      missing_description: 'Missing description',
      missing_success_metric: 'Missing success metric',
      missing_milestones: 'Missing 30/60 milestones',
      missing_baby_steps: 'Add at least one starter step',
      too_many_baby_steps: 'Too many starter steps',
      missing_tags: 'Missing tags',
    },
  },
} as const;

type DomainGoalsCopy = (typeof COPY)[keyof typeof COPY];
type LocaleFilter = AppLocale | 'all';
type SortMode = 'updated' | 'quality' | 'status' | 'title';

function newGoal(domain: LifeDomain, locale: AppLocale): DomainDefaultGoal {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    domain,
    category: '',
    status: 'draft',
    riskLevel: domain === 'health' ? 'high' : 'medium',
    active: false,
    locale,
    title: '',
    description: '',
    successMetric: '',
    milestone30: '',
    milestone60: '',
    milestone90: '',
    babySteps: [''],
    tags: [],
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function qualityScore(goal: DomainDefaultGoal): number {
  return 7 - validateDomainDefaultGoal(goal).length;
}

function qualityLabel(issueCount: number, copy: DomainGoalsCopy): string {
  if (issueCount === 0) return copy.ready;
  if (issueCount <= 2) return copy.needsWork;
  return copy.missingContent;
}

export function AdminDomainDefaultGoalsPanel() {
  const locale = useLocale() as AppLocale;
  const copy = COPY[locale] ?? COPY.en;
  const labels = DOMAIN_LABELS[locale] ?? DOMAIN_LABELS.en;
  const [goals, setGoals] = useState<DomainDefaultGoal[]>([]);
  const [domain, setDomain] = useState<LifeDomain>('health');
  const [status, setStatus] = useState<DomainDefaultGoalStatus | 'all'>('all');
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [editing, setEditing] = useState<DomainDefaultGoal | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setGoals(loadDomainDefaultGoals());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = goals.filter((goal) => {
      if (goal.domain !== domain) return false;
      if (status !== 'all' && goal.status !== status) return false;
      if (localeFilter !== 'all' && goal.locale !== localeFilter) return false;
      if (activeOnly && !goal.active) return false;
      if (!q) return true;
      return [goal.title, goal.category, goal.locale, ...goal.tags].join(' ').toLowerCase().includes(q);
    });
    return [...matches].sort((a, b) => {
      if (sortMode === 'quality') return qualityScore(a) - qualityScore(b);
      if (sortMode === 'status') return a.status.localeCompare(b.status);
      if (sortMode === 'title') return a.title.localeCompare(b.title, locale);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [goals, domain, status, localeFilter, query, activeOnly, sortMode, locale]);

  const domainStats = useMemo(() => {
    return LIFE_DOMAINS.reduce((stats, item) => {
      const domainGoals = goals.filter((goal) => goal.domain === item);
      stats[item] = {
        total: domainGoals.length,
        published: domainGoals.filter((goal) => goal.status === 'published').length,
        needsReview: domainGoals.filter((goal) => goal.status === 'needs_review').length,
        drafts: domainGoals.filter((goal) => goal.status === 'draft').length,
      };
      return stats;
    }, {} as Record<LifeDomain, {total: number; published: number; needsReview: number; drafts: number}>);
  }, [goals]);

  const selectedStats = domainStats[domain] ?? {total: 0, published: 0, needsReview: 0, drafts: 0};

  const selected = goals.find((goal) => goal.id === selectedId) ?? filtered[0] ?? null;
  const checkedVisibleCount = filtered.filter((goal) => checkedIds.has(goal.id)).length;
  const hasUnsavedChanges = editing ? JSON.stringify(editing) !== editingSnapshot : false;

  function persist(next: DomainDefaultGoal[]) {
    setGoals(next);
    saveDomainDefaultGoals(next);
  }

  function saveGoal(goal: DomainDefaultGoal) {
    const timestamp = new Date().toISOString();
    const exists = goals.some((entry) => entry.id === goal.id);
    const nextGoal = {...goal, updatedAt: timestamp, version: exists ? goal.version + 1 : goal.version};
    persist(exists ? goals.map((entry) => entry.id === goal.id ? nextGoal : entry) : [nextGoal, ...goals]);
    setSelectedId(nextGoal.id);
    setEditing(null);
    setEditingSnapshot(null);
  }

  function duplicateGoal(goal: DomainDefaultGoal) {
    const copyGoal = duplicateDomainDefaultGoal(goal);
    persist([copyGoal, ...goals]);
    setEditing(copyGoal);
    setEditingSnapshot(JSON.stringify(copyGoal));
    setSelectedId(copyGoal.id);
  }

  function archiveGoal(goal: DomainDefaultGoal) {
    persist(goals.map((entry) => entry.id === goal.id ? {...entry, status: 'archived', active: false, updatedAt: new Date().toISOString()} : entry));
  }

  function startEditing(goal: DomainDefaultGoal) {
    setEditing(goal);
    setEditingSnapshot(JSON.stringify(goal));
  }

  function cancelEditing() {
    if (hasUnsavedChanges && !window.confirm(copy.confirmDiscard)) return;
    setEditing(null);
    setEditingSnapshot(null);
  }

  function clearFilters() {
    setQuery('');
    setStatus('all');
    setLocaleFilter('all');
    setActiveOnly(false);
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkUpdate(patch: Partial<DomainDefaultGoal>) {
    const timestamp = new Date().toISOString();
    persist(goals.map((goal) => (
      checkedIds.has(goal.id)
        ? {...goal, ...patch, updatedAt: timestamp, version: goal.version + 1}
        : goal
    )));
    setCheckedIds(new Set());
  }

  return (
    <section className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black txt-strong">{copy.title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-[var(--muted)]">{copy.description}</p>
        </div>
        <AdminActionButton onClick={() => startEditing(newGoal(domain, locale))}>{copy.add}</AdminActionButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {LIFE_DOMAINS.map((item) => (
          <button
            key={item}
            type="button"
            className={`focus-ring rounded-full border px-3 py-2 text-xs font-bold ${domain === item ? 'border-white/35 bg-white/12 txt-strong' : 'border-white/10 bg-white/[0.03] txt-soft'}`}
            onClick={() => {
              setDomain(item);
              setCheckedIds(new Set());
            }}
          >
            <span>{labels[item]}</span>
            <span className="ms-2 text-white/45">
              {domainStats[item]?.published ?? 0}/{domainStats[item]?.total ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{copy.domainSummary}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <SummaryStat label={copy.goals} value={selectedStats.total} />
          <SummaryStat label={copy.published} value={selectedStats.published} />
          <SummaryStat label={copy.needsReview} value={selectedStats.needsReview} />
          <SummaryStat label={copy.drafts} value={selectedStats.drafts} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusChip active={status === 'all'} label={copy.all} onClick={() => setStatus('all')} />
        {GOAL_STATUSES.map((item) => (
          <StatusChip key={item} active={status === item} label={copy.statuses[item]} onClick={() => setStatus(item)} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_11rem_11rem_auto]">
        <input className="focus-ring input-base" value={query} placeholder={copy.search} onChange={(e) => setQuery(e.target.value)} />
        <select className="focus-ring select-base" value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value as LocaleFilter)}>
          <option value="all">{copy.allLanguages}</option>
          <option value="he">עברית</option>
          <option value="en">English</option>
        </select>
        <select className="focus-ring select-base" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label={copy.sort}>
          <option value="updated">{copy.sortUpdated}</option>
          <option value="quality">{copy.sortQuality}</option>
          <option value="status">{copy.sortStatus}</option>
          <option value="title">{copy.sortTitle}</option>
        </select>
        <label className="flex items-center gap-2 text-sm txt-soft">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          {copy.activeOnly}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span>{filtered.length} {copy.goals}</span>
          {checkedVisibleCount > 0 ? <span>· {checkedVisibleCount} {copy.selected}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminViewButton onClick={clearFilters}>{copy.clearFilters}</AdminViewButton>
          {checkedVisibleCount > 0 ? (
            <>
              <AdminViewButton onClick={() => bulkUpdate({status: 'needs_review', active: false})}>{copy.bulkReview}</AdminViewButton>
              <AdminActionButton onClick={() => bulkUpdate({status: 'published', active: true})}>{copy.bulkPublish}</AdminActionButton>
              <AdminActionButton destructive onClick={() => bulkUpdate({status: 'archived', active: false})}>{copy.bulkArchive}</AdminActionButton>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
        <div className="grid content-start gap-2">
          {filtered.length === 0 ? (
            <div className="grid gap-3">
              <AdminEmptyState title={copy.empty} description={copy.description} />
              <AdminViewButton className="justify-self-start" onClick={clearFilters}>{copy.clearFilters}</AdminViewButton>
            </div>
          ) : null}
          {filtered.map((goal) => {
            const issues = validateDomainDefaultGoal(goal);
            const quality = qualityLabel(issues.length, copy);
            return (
              <div
                key={goal.id}
                className={`focus-ring rounded-2xl border p-4 text-start ${selected?.id === goal.id ? 'border-white/35 bg-white/10' : 'border-white/10 bg-white/[0.02]'}`}
                onClick={() => setSelectedId(goal.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedId(goal.id);
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="mb-2 flex w-max items-center gap-2 text-xs text-white/45" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checkedIds.has(goal.id)} onChange={() => toggleChecked(goal.id)} />
                      {copy.select}
                    </label>
                    <h4 className="font-black txt-strong">{goal.title || copy.titleField}</h4>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{goal.description || copy.descriptionField}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${issues.length ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'}`}>
                    {quality}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                  <span>{goal.locale}</span>
                  <span>{copy.statuses[goal.status]}</span>
                  <span>{goal.active ? copy.active : copy.inactive}</span>
                  {goal.isDefault ? <span>{copy.originalDefault}</span> : null}
                  <span>{goal.category || copy.category}</span>
                  <span>v{goal.version}</span>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/15 p-4">
          {editing ? (
            <GoalEditor
              goal={editing}
              copy={copy}
              labels={labels}
              hasUnsavedChanges={hasUnsavedChanges}
              onChange={setEditing}
              onSave={saveGoal}
              onCancel={cancelEditing}
            />
          ) : selected ? (
            <GoalDetail
              goal={selected}
              copy={copy}
              labels={labels}
              onEdit={() => startEditing(selected)}
              onDuplicate={() => duplicateGoal(selected)}
              onArchive={() => archiveGoal(selected)}
              onPublish={() => saveGoal({...selected, status: 'published', active: true})}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{copy.empty}</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function GoalDetail({
  goal,
  copy,
  labels,
  onEdit,
  onDuplicate,
  onArchive,
  onPublish,
}: {
  goal: DomainDefaultGoal;
  copy: DomainGoalsCopy;
  labels: Record<LifeDomain, string>;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onPublish: () => void;
}) {
  const issues = validateDomainDefaultGoal(goal);
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{labels[goal.domain]} · {goal.locale}</p>
        <h4 className="mt-2 text-xl font-black txt-strong">{goal.title}</h4>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{goal.description}</p>
      </div>
      <Preview goal={goal} copy={copy} />
      <Quality issues={issues} copy={copy} />
      <div className="grid gap-2 text-sm">
        <DetailRow label={copy.successMetric} value={goal.successMetric} />
        <DetailRow label={copy.category} value={goal.category} />
        <DetailRow label={copy.status} value={copy.statuses[goal.status]} />
        <DetailRow label={copy.risk} value={goal.riskLevel} />
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminViewButton onClick={onEdit}>{copy.edit}</AdminViewButton>
        <AdminViewButton onClick={onDuplicate}>{copy.duplicate}</AdminViewButton>
        <AdminActionButton onClick={onPublish}>{copy.publish}</AdminActionButton>
        <AdminActionButton destructive onClick={onArchive}>{copy.archive}</AdminActionButton>
      </div>
    </div>
  );
}

function GoalEditor({
  goal,
  copy,
  labels,
  hasUnsavedChanges,
  onChange,
  onSave,
  onCancel,
}: {
  goal: DomainDefaultGoal;
  copy: DomainGoalsCopy;
  labels: Record<LifeDomain, string>;
  hasUnsavedChanges: boolean;
  onChange: (goal: DomainDefaultGoal) => void;
  onSave: (goal: DomainDefaultGoal) => void;
  onCancel: () => void;
}) {
  function patch(patchValue: Partial<DomainDefaultGoal>) {
    onChange({...goal, ...patchValue});
  }

  function updateStep(index: number, value: string) {
    patch({babySteps: goal.babySteps.map((step, i) => i === index ? value : step)});
  }

  function deleteStep(index: number) {
    const next = goal.babySteps.filter((_, i) => i !== index);
    patch({babySteps: next.length > 0 ? next : ['']});
  }

  function moveStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= goal.babySteps.length) return;
    const next = [...goal.babySteps];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    patch({babySteps: next});
  }

  const issues = validateDomainDefaultGoal(goal);
  return (
    <div className="grid gap-4">
      {hasUnsavedChanges ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">
          {copy.unsaved}
        </div>
      ) : null}

      <EditorSection title={copy.editSections.basics}>
        <label className="grid gap-1 text-sm">
          <span>{copy.domain}</span>
          <select className="focus-ring select-base" value={goal.domain} onChange={(e) => patch({domain: e.target.value as LifeDomain})}>
            {LIFE_DOMAINS.map((domain) => <option key={domain} value={domain}>{labels[domain]}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>{copy.locale}</span>
            <select className="focus-ring select-base" value={goal.locale} onChange={(e) => patch({locale: e.target.value as AppLocale})}>
              <option value="he">עברית</option>
              <option value="en">English</option>
            </select>
          </label>
          <Field label={copy.category} value={goal.category} onChange={(category) => patch({category})} />
        </div>
        <Field label={copy.titleField} value={goal.title} onChange={(title) => patch({title})} />
        <TextField label={copy.descriptionField} value={goal.description} onChange={(description) => patch({description})} />
      </EditorSection>

      <EditorSection title={copy.editSections.success}>
        <TextField label={copy.successMetric} value={goal.successMetric} onChange={(successMetric) => patch({successMetric})} />
      </EditorSection>

      <EditorSection title={copy.editSections.roadmap}>
        <Field label={copy.milestone30} value={goal.milestone30} onChange={(milestone30) => patch({milestone30})} />
        <Field label={copy.milestone60} value={goal.milestone60} onChange={(milestone60) => patch({milestone60})} />
        <Field label={copy.milestone90} value={goal.milestone90} onChange={(milestone90) => patch({milestone90})} />
      </EditorSection>

      <EditorSection title={copy.editSections.steps}>
        {goal.babySteps.map((step, index) => (
          <div key={`step-${index}`} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input className="focus-ring input-base" value={step} onChange={(e) => updateStep(index, e.target.value)} />
            <div className="flex gap-1">
              <AdminViewButton className="px-2 text-xs" onClick={() => moveStep(index, -1)} disabled={index === 0}>{copy.moveUp}</AdminViewButton>
              <AdminViewButton className="px-2 text-xs" onClick={() => moveStep(index, 1)} disabled={index === goal.babySteps.length - 1}>{copy.moveDown}</AdminViewButton>
              <AdminActionButton className="px-2 text-xs" destructive onClick={() => deleteStep(index)}>{copy.deleteStep}</AdminActionButton>
            </div>
          </div>
        ))}
        <AdminViewButton onClick={() => patch({babySteps: [...goal.babySteps, '']})}>+ {copy.babySteps}</AdminViewButton>
      </EditorSection>

      <EditorSection title={copy.editSections.publishing}>
        <Field label={copy.tags} value={goal.tags.join(', ')} onChange={(tags) => patch({tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean)})} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>{copy.status}</span>
            <select className="focus-ring select-base" value={goal.status} onChange={(e) => patch({status: e.target.value as DomainDefaultGoalStatus})}>
              {GOAL_STATUSES.map((status) => <option key={status} value={status}>{copy.statuses[status]}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>{copy.risk}</span>
            <select className="focus-ring select-base" value={goal.riskLevel} onChange={(e) => patch({riskLevel: e.target.value as DomainDefaultGoal['riskLevel']})}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="flex items-center gap-2 txt-soft">
            <input type="checkbox" checked={goal.active} onChange={(e) => patch({active: e.target.checked})} />
            {copy.active}
          </span>
        </label>
      </EditorSection>

      <Preview goal={goal} copy={copy} />
      <Quality issues={issues} copy={copy} />
      <div className="flex flex-wrap gap-2">
        <AdminActionButton onClick={() => onSave(goal)}>{copy.save}</AdminActionButton>
        <AdminViewButton onClick={onCancel}>{copy.cancel}</AdminViewButton>
      </div>
    </div>
  );
}

function Field({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <input className="focus-ring input-base" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SummaryStat({label, value}: {label: string; value: number}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-bold text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black txt-strong">{value}</p>
    </div>
  );
}

function StatusChip({active, label, onClick}: {active: boolean; label: string; onClick: () => void}) {
  return (
    <button
      type="button"
      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-bold ${
        active ? 'border-white/35 bg-white/12 txt-strong' : 'border-white/10 bg-white/[0.03] txt-soft'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EditorSection({title, children}: {title: string; children: ReactNode}) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <legend className="px-1 text-sm font-black txt-strong">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextField({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <textarea className="focus-ring textarea-base min-h-20" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Preview({goal, copy}: {goal: DomainDefaultGoal; copy: DomainGoalsCopy}) {
  return (
    <div className="rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/8 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">{copy.preview}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{copy.showUserPreview}</p>
      <h4 className="mt-2 text-lg font-black txt-strong">{goal.title || copy.titleField}</h4>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{goal.description || copy.descriptionField}</p>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
        <p className="text-xs font-bold text-white/45">{copy.successMetric}</p>
        <p className="mt-1 text-sm font-bold txt-strong">{goal.successMetric || copy.successMetric}</p>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <MilestonePreview label={copy.milestone30} value={goal.milestone30} />
        <MilestonePreview label={copy.milestone60} value={goal.milestone60} />
        <MilestonePreview label={copy.milestone90} value={goal.milestone90} />
      </div>
      <ol className="mt-3 grid gap-1 text-sm text-[var(--muted)]">
        {goal.babySteps.filter(Boolean).slice(0, 3).map((step) => <li key={step}>• {step}</li>)}
      </ol>
    </div>
  );
}

function MilestonePreview({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-bold text-white/45">{label}</p>
      <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{value || '—'}</p>
    </div>
  );
}

function Quality({issues, copy}: {issues: DomainDefaultGoalIssue[]; copy: DomainGoalsCopy}) {
  return (
    <div className={`rounded-2xl border p-3 text-sm ${issues.length ? 'border-amber-300/20 bg-amber-400/8 text-amber-100' : 'border-emerald-300/20 bg-emerald-400/8 text-emerald-100'}`}>
      <p className="font-bold">{copy.quality}</p>
      {issues.length === 0 ? <p className="mt-1">{copy.noIssues}</p> : (
        <ul className="mt-2 list-disc ps-5">
          {issues.map((issue) => <li key={issue}>{copy.issues[issue]}</li>)}
        </ul>
      )}
    </div>
  );
}

function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/6 pb-2">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-end font-medium txt-soft">{value}</dd>
    </div>
  );
}
