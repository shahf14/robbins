'use client';

import {useLocale, useTranslations} from 'next-intl';
import {type FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import type {IdentityOption} from '@/lib/morning-ritual-types';
import {
  fetchRitualContent,
  saveIdentities,
} from '@/lib/morning-ritual-storage';
import {loadUserPreferences, saveUserPreferences} from '@/lib/user-preferences';
import {LanguageSwitcher} from './language-switcher';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {scheduleDeferredRitualCommit} from '@/lib/morning-ritual/deferred-ritual-persist';
import {DatabaseTab} from './admin-db/database-tab';
import {dbApi, DbApiError, type LogLine} from './admin-db/use-db-api';
import {dateToYMD} from '@/lib/date-utils';
import {
  AdminActivityBar,
  AdminButtonLegend,
  AdminEmptyState,
  AdminHelpDrawer,
  AdminOverviewCard,
  AdminRiskBadge,
  AdminSetupChecklist,
  AdminTabChrome,
  AdminViewButton,
  AdminActionButton,
  type AdminShellTab,
} from './admin/admin-shell';
import {AdminAffirmationsPanel} from './admin/admin-affirmations-panel';
import {AdminDomainDefaultGoalsPanel} from './admin/admin-domain-default-goals-panel';
import {recordAdminActivity, type AdminActivityKey} from '@/lib/admin/admin-activity';
import {AdminTooltip} from '@/components/admin/admin-tooltip';

type AdminTab = AdminShellTab;

export function AdminPanel() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = useState<AdminTab>('content');
  const [subCrumb, setSubCrumb] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activityVersion, setActivityVersion] = useState(0);

  const bumpActivity = useCallback((key: AdminActivityKey) => {
    recordAdminActivity(key);
    setActivityVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (tab === 'database') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSubCrumb(tab === 'content' ? t('admin.shell.subCrumbs.content') : null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [tab, t]);

  const tabs: {key: AdminTab; label: string; tip?: string}[] = [
    {key: 'content', label: t('admin.tabs.content')},
    {key: 'logs', label: t('admin.tabs.logs')},
    {key: 'settings', label: t('admin.tabs.settings')},
    {key: 'database', label: t('admin.tabs.database'), tip: t('admin.tooltips.tabs.database')},
  ];

  function selectTab(next: AdminTab) {
    setTab(next);
    setSubCrumb(null);
    setHelpOpen(false);
  }

  return (
    <section className="panel-surface p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/6 px-4 py-3">
        <p className="text-sm font-semibold text-amber-200/80">{t('admin.securityNotice')}</p>
      </div>

      <div>
        <p className="eyebrow txt-soft">{t('admin.title')}</p>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t('admin.pageTitle')}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{t('admin.subtitle')}</p>
      </div>

      <div className="mt-6 grid gap-4">
        <AdminSetupChecklist activityVersion={activityVersion} onGoToTab={selectTab} />
        <AdminActivityBar locale={locale} activityVersion={activityVersion} />
        <AdminOverviewCard activeTab={tab} onSelectTab={selectTab} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[color:var(--color-border)] pb-3">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`focus-ring flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === item.key ? 'fill-3 txt-strong' : 'txt-soft hover:txt-strong'
            }`}
            onClick={() => selectTab(item.key)}
            title={item.tip}
          >
            <span>{item.label}</span>
            {item.tip ? <AdminTooltip tip={item.tip} className="ms-1" /> : null}
            <AdminRiskBadge tab={item.key} />
          </button>
        ))}
      </div>

      <div className="mt-6">
        <AdminTabChrome tab={tab} subCrumb={subCrumb} onOpenHelp={() => setHelpOpen(true)} />
        <AdminButtonLegend />
        <div className="mt-4">
          {tab === 'content' && <ContentTab locale={locale} />}
          {tab === 'logs' && <LogsTab onActivity={bumpActivity} />}
          {tab === 'settings' && <SettingsTab onActivity={bumpActivity} />}
          {tab === 'database' && (
            <DatabaseTab onActivity={bumpActivity} onSubCrumbChange={setSubCrumb} />
          )}
        </div>
      </div>

      <AdminHelpDrawer tab={tab} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  );
}

function ContentTab({locale: _locale}: {locale: AppLocale}) {
  const t = useTranslations();
  const tRitual = useTranslations('morningRitual');
  const {confirm} = useConfirm();
  const toast = useToast();

  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [newIdentity, setNewIdentity] = useState('');

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchRitualContent().then(({identities: savedIdentities}) => {
        if (cancelled) return;
        setIdentities(savedIdentities);
      }).catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  function addIdentity(e: FormEvent) {
    e.preventDefault();
    if (!newIdentity.trim()) return;
    const item: IdentityOption = {
      id: crypto.randomUUID(),
      text: newIdentity.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...identities];
    setIdentities(next);
    saveIdentities(next);
    setNewIdentity('');
  }

  async function deleteIdentity(id: string) {
    const ok = await confirm({
      title: t('admin.content.deleteIdentityConfirmTitle'),
      message: t('admin.content.deleteIdentityConfirmMessage'),
      confirmLabel: t('admin.content.deleteIdentity'),
      destructive: true,
    });
    if (!ok) return;
    const previous = identities;
    const next = identities.filter((i) => i.id !== id);
    setIdentities(next);
    scheduleDeferredRitualCommit({
      key: 'admin-identities',
      commit: () => saveIdentities(next),
      undo: () => setIdentities(previous),
      toast,
      message: tRitual('identity.deletedUndo'),
      undoLabel: tRitual('common.undo'),
    });
  }

  return (
    <div className="grid gap-8">
      <AdminDomainDefaultGoalsPanel />
      <AdminAffirmationsPanel />

      <div>
        <h3 className="text-lg font-bold">{t('admin.content.identitiesTitle')}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('admin.content.identitiesDescription')}</p>

        <form className="mt-4 flex gap-2" onSubmit={addIdentity}>
          <input
            className="focus-ring input-base flex-1"
            value={newIdentity}
            placeholder={t('admin.content.identityPlaceholder')}
            onChange={(e) => setNewIdentity(e.target.value)}
          />
          <AdminActionButton className="shrink-0 disabled:opacity-60" type="submit" disabled={!newIdentity.trim()}>
            {t('admin.content.addIdentity')}
          </AdminActionButton>
        </form>

        <div className="mt-3 grid gap-2">
          {identities.length === 0 ? (
            <AdminEmptyState
              title={t('admin.content.emptyIdentitiesTitle')}
              description={t('admin.content.emptyIdentitiesDetail')}
            />
          ) : null}
          {identities.map((identity) => (
            <div key={identity.id} className="panel-surface flex items-center justify-between gap-3 p-3">
              <p className="min-w-0 truncate text-sm">{identity.text}</p>
              <AdminActionButton
                className="shrink-0 text-xs"
                destructive
                onClick={() => void deleteIdentity(identity.id)}
              >
                {t('admin.content.deleteIdentity')}
              </AdminActionButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type LogEntry = LogLine;

function LogsTab({onActivity}: {onActivity: (key: AdminActivityKey) => void}) {
  const t = useTranslations('admin.logs');
  const [date, setDate] = useState(() => dateToYMD(new Date()));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (dateStr: string) => {
    setLoading(true);
    setLogsError(null);
    try {
      const data = await dbApi.listLogs(dateStr);
      setLogs(data.lines ?? []);
      onActivity('logsRefresh');
    } catch (err) {
      setLogs([]);
      if (err instanceof DbApiError) {
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
          <AdminViewButton className="mt-4" onClick={() => void fetchLogs(date)}>
            {t('retry')}
          </AdminViewButton>
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
