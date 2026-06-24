'use client';

import {useLocale, useTranslations} from 'next-intl';
import {type FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import {loadUserPreferences, saveUserPreferences} from '@/lib/user-preferences';
import {LanguageSwitcher} from './language-switcher';
import {DatabaseTab} from './admin-db/database-tab';
import {
  dbApi,
  DbApiError,
  ensureAdminSession,
  getStoredAdminApiToken,
  getStoredLocalAuthToken,
  type LogLine,
} from './admin-db/use-db-api';
import {dateToYMD} from '@/lib/date-utils';
import {
  AdminBreadcrumbBar,
  AdminButtonLegend,
  AdminEmptyState,
  AdminHelpDrawer,
  AdminSetupChecklist,
  AdminSidebar,
  AdminViewButton,
  AdminActionButton,
  AdminWelcomeDashboard,
  type AdminContentSection,
  type AdminShellTab,
  type BreadcrumbSegment,
} from './admin/admin-shell';
import {AdminAffirmationsPanel} from './admin/admin-affirmations-panel';
import {AdminDomainDefaultGoalsPanel} from './admin/admin-domain-default-goals-panel';
import {AdminGoallessTasksPanel} from './admin/admin-goalless-tasks-panel';
import {AdminIdentitiesPanel} from './admin/admin-identities-panel';
import {recordAdminActivity, type AdminActivityKey} from '@/lib/admin/admin-activity';
type AdminTab = AdminShellTab;
type DatabaseView = 'tables' | 'query';

export function AdminPanel() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = useState<AdminTab>('content');
  const [contentSection, setContentSection] = useState<AdminContentSection>('domain-goals');
  const [databaseView, setDatabaseView] = useState<DatabaseView>('tables');
  const [subCrumb, setSubCrumb] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activityVersion, setActivityVersion] = useState(0);
  const [adminSessionReady, setAdminSessionReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void ensureAdminSession().then((status) => {
        setAdminSessionReady(status.active || status.canBootstrap);
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const bumpActivity = useCallback((key: AdminActivityKey) => {
    recordAdminActivity(key);
    setActivityVersion((value) => value + 1);
  }, []);

  function selectTab(next: AdminTab) {
    setTab(next);
    if (next !== 'database') {
      setSubCrumb(null);
      setDatabaseView('tables');
    }
    setHelpOpen(false);
  }

  function selectContentSection(section: AdminContentSection) {
    setTab('content');
    setContentSection(section);
    setHelpOpen(false);
  }

  const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
    const root: BreadcrumbSegment = {
      label: t('admin.shell.breadcrumbRoot'),
      onClick: () => {
        setTab('content');
        setContentSection('domain-goals');
        setSubCrumb(null);
        setDatabaseView('tables');
      },
    };
    const segments: BreadcrumbSegment[] = [root];

    if (tab === 'content') {
      segments.push({
        label: t('admin.tabs.content'),
        onClick:
          contentSection !== 'domain-goals'
            ? () => setContentSection('domain-goals')
            : undefined,
      });
      segments.push({label: t(`admin.content.sections.${contentSection}`)});
      return segments;
    }

    if (tab === 'database' && subCrumb && databaseView === 'query') {
      segments.push({
        label: t('admin.tabs.database'),
        onClick: () => setDatabaseView('tables'),
      });
      segments.push({label: subCrumb});
      return segments;
    }

    segments.push({label: t(`admin.tabs.${tab}`)});
    return segments;
  }, [contentSection, databaseView, subCrumb, t, tab]);

  const breadcrumbHint =
    tab === 'content'
      ? t(`admin.shell.sectionHint.${contentSection}`)
      : tab === 'identities'
        ? t('admin.shell.tabHint.identities')
        : t(`admin.shell.tabHint.${tab}`);

  return (
    <section className="panel-surface p-6 sm:p-8">
      <div>
        <p className="eyebrow txt-soft">{t('admin.title')}</p>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t('admin.pageTitle')}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{t('admin.subtitle')}</p>
      </div>

      <div className="mt-6 grid gap-4">
        <AdminWelcomeDashboard
          locale={locale}
          activityVersion={activityVersion}
          onGoToTab={selectTab}
          onGoToContentSection={selectContentSection}
        />
        <AdminSetupChecklist
          activityVersion={activityVersion}
          adminSessionReady={adminSessionReady}
          onGoToTab={selectTab}
        />
      </div>

      <div className="admin-shell mt-6">
        <AdminSidebar
          tab={tab}
          contentSection={contentSection}
          onSelectTab={selectTab}
          onSelectContentSection={selectContentSection}
        />

        <div className="admin-shell__main min-w-0">
          <AdminBreadcrumbBar
            segments={breadcrumbSegments}
            hint={breadcrumbHint}
            onOpenHelp={() => setHelpOpen(true)}
          />
          <AdminButtonLegend />
          <div className="mt-4">
            {tab === 'content' && <ContentTab section={contentSection} onActivity={bumpActivity} />}
            {tab === 'identities' && <AdminIdentitiesPanel onActivity={bumpActivity} />}
            {tab === 'logs' && <LogsTab onActivity={bumpActivity} onGoToDatabase={() => selectTab('database')} />}
            {tab === 'settings' && <SettingsTab onActivity={bumpActivity} />}
            {tab === 'database' && (
              <div className="admin-danger-zone">
                <DatabaseTab
                  activeView={databaseView}
                  onActiveViewChange={setDatabaseView}
                  onActivity={bumpActivity}
                  onSubCrumbChange={setSubCrumb}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminHelpDrawer tab={tab} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  );
}

function ContentTab({
  section,
  onActivity,
}: {
  section: AdminContentSection;
  onActivity: (key: AdminActivityKey) => void;
}) {
  if (section === 'domain-goals') return <AdminDomainDefaultGoalsPanel onActivity={onActivity} />;
  if (section === 'goalless-tasks') return <AdminGoallessTasksPanel onActivity={onActivity} />;
  return <AdminAffirmationsPanel onActivity={onActivity} />;
}

type LogEntry = LogLine;

function LogsTab({
  onActivity,
  onGoToDatabase,
}: {
  onActivity: (key: AdminActivityKey) => void;
  onGoToDatabase: () => void;
}) {
  const t = useTranslations('admin.logs');
  const [date, setDate] = useState(() => dateToYMD(new Date()));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasLocalToken, setHasLocalToken] = useState(false);
  const [hasAdminToken, setHasAdminToken] = useState(false);
  const [authErrorStatus, setAuthErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHasLocalToken(Boolean(getStoredLocalAuthToken().trim()));
      setHasAdminToken(Boolean(getStoredAdminApiToken().trim()));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [logsError, logs.length]);

  const fetchLogs = useCallback(async (dateStr: string) => {
    setLoading(true);
    setLogsError(null);
    setAuthErrorStatus(null);
    try {
      const data = await dbApi.listLogs(dateStr);
      setLogs(data.lines ?? []);
      onActivity('logsRefresh');
    } catch (err) {
      setLogs([]);
      if (err instanceof DbApiError) {
        setAuthErrorStatus(err.status);
        if (err.status === 401 || err.status === 403) {
          setLogsError(t('authError'));
        } else if (err.status === 503) {
          setLogsError(t('serverError'));
        } else {
          setLogsError(err.message);
        }
      } else {
        setLogsError(err instanceof Error ? err.message : t('genericError'));
      }
    } finally {
      setLoading(false);
    }
  }, [onActivity, t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchLogs(date), 0);
    return () => window.clearTimeout(timeout);
  }, [date, fetchLogs]);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="focus-ring input-base"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <AdminViewButton onClick={() => void fetchLogs(date)}>{t('refresh')}</AdminViewButton>
        <span className="text-sm text-[var(--muted)]">{t('count', {count: logs.length})}</span>
      </div>

      {logsError ? (
        <div className="mt-4 rounded-[16px] border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-300">{t('loadErrorTitle')}</p>
          <p className="mt-2 text-sm text-red-400">{logsError}</p>
          {authErrorStatus === 401 || authErrorStatus === 403 ? (
            <p className="mt-2 text-sm text-red-300">
              {t('tokenStatus', {
                local: hasLocalToken ? t('tokenOk') : t('tokenMissing'),
                admin: hasAdminToken ? t('tokenOk') : t('tokenMissing'),
              })}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminViewButton onClick={() => void fetchLogs(date)}>{t('retry')}</AdminViewButton>
            <AdminActionButton onClick={onGoToDatabase}>{t('openDatabaseTab')}</AdminActionButton>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {loading ? <p className="text-sm text-[var(--muted)]">{t('loading')}</p> : null}
        {!loading && !logsError && logs.length === 0 ? (
          <AdminEmptyState title={t('emptyTitle')} description={t('noLogsDetail')} />
        ) : null}
        {logs.map((entry, i) => (
          <div key={`log-${i}`} className="panel-surface p-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              {entry.timestamp ? <span>{new Date(entry.timestamp).toLocaleTimeString()}</span> : null}
              {entry.type ? (
                <span className="rounded fill-2 px-2 py-0.5 font-mono">{entry.type}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm">{entry.message ?? entry.raw ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({onActivity}: {onActivity: (key: AdminActivityKey) => void}) {
  const t = useTranslations();
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const saveResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (displayNameRef.current) {
      displayNameRef.current.value = loadUserPreferences().display_name;
    }
    return () => {
      if (saveResetTimeoutRef.current) {
        window.clearTimeout(saveResetTimeoutRef.current);
      }
    };
  }, []);

  function handleSave(e?: FormEvent) {
    e?.preventDefault();
    saveUserPreferences({display_name: displayNameRef.current?.value ?? ''});
    onActivity('settingsSave');
    setSaveState('saved');
    if (saveResetTimeoutRef.current) {
      window.clearTimeout(saveResetTimeoutRef.current);
    }
    saveResetTimeoutRef.current = window.setTimeout(() => {
      setSaveState('idle');
      saveResetTimeoutRef.current = null;
    }, 1800);
  }

  return (
    <div>
      <form className="mt-2 grid max-w-md gap-5" onSubmit={handleSave}>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('settings.displayName')}</span>
          <input
            ref={displayNameRef}
            className="focus-ring input-base"
            maxLength={60}
            placeholder={t('settings.displayNamePlaceholder')}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <AdminActionButton type="submit">{t('settings.save')}</AdminActionButton>
          <span className="text-sm font-semibold text-[var(--blue)]">
            {saveState === 'saved' ? t('settings.saved') : t('settings.localOnly')}
          </span>
        </div>
      </form>

      <div className="mt-8">
        <p className="field-label mb-0 txt-muted">{t('settings.languageTitle')}</p>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t('settings.languageHelp')}</p>
        <div className="mt-4">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
