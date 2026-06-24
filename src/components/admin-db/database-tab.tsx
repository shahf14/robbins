'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {
  dbApi,
  DbApiError,
  ensureAdminSession,
  getStoredAdminApiToken,
  getStoredLocalAuthToken,
  setStoredAdminApiToken,
  setStoredLocalAuthToken,
  type TableSummary,
} from './use-db-api';
import {verifyLocalAuthToken} from '@/lib/auth/verify-local-token';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {parseJsonArrayOr} from '@/lib/safe-json';
import {TableBrowser} from './table-browser';
import {SqlEditor} from './sql-editor';
import {AdminActionButton, AdminEmptyState, AdminViewButton} from '@/components/admin/admin-shell';
import type {AdminActivityKey} from '@/lib/admin/admin-activity';

type View = 'tables' | 'query';

function readLocalStorageArray(key: string): unknown[] {
  try {
    const value = window.localStorage.getItem(key);
    return parseJsonArrayOr<unknown>(value);
  } catch {
    return [];
  }
}

export function DatabaseTab({
  onActivity,
  onSubCrumbChange,
  activeView,
  onActiveViewChange,
}: {
  onActivity: (key: AdminActivityKey) => void;
  onSubCrumbChange: (segment: string | null) => void;
  activeView?: View;
  onActiveViewChange?: (view: View) => void;
}) {
  const t = useTranslations('admin.database');
  const {confirm} = useConfirm();
  const [internalView, setInternalView] = useState<View>('tables');
  const view = activeView ?? internalView;
  const setView = useCallback(
    (next: View) => {
      if (onActiveViewChange) {
        onActiveViewChange(next);
      } else {
        setInternalView(next);
      }
    },
    [onActiveViewChange],
  );
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{synced: Record<string, number>} | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [adminApiToken, setAdminApiToken] = useState(() => getStoredAdminApiToken());
  const [localAuthToken, setLocalAuthToken] = useState(() => getStoredLocalAuthToken());
  const [savingTokens, setSavingTokens] = useState(false);

  useEffect(() => {
    onSubCrumbChange(view === 'tables' ? t('tablesView') : t('queryView'));
  }, [onSubCrumbChange, t, view]);

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    setTablesError(null);
    try {
      await ensureAdminSession();
      const res = await dbApi.listTables();
      setTables(res.tables);
      onActivity('dbConnectionOk');
      return res.tables;
    } catch (err) {
      setTables([]);
      if (err instanceof DbApiError) {
        if (err.status === 401 || err.status === 403) {
          setTablesError(t('authError'));
        } else if (err.status === 503) {
          setTablesError(err.message || t('serverError'));
        } else {
          setTablesError(err.message);
        }
      } else {
        setTablesError(err instanceof Error ? err.message : t('genericError'));
      }
      return [];
    } finally {
      setLoadingTables(false);
    }
  }, [onActivity, t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchTables(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchTables]);

  async function saveTokens() {
    setSavingTokens(true);
    setTablesError(null);

    const trimmedLocal = localAuthToken.trim();
    if (trimmedLocal) {
      const result = await verifyLocalAuthToken(trimmedLocal, {notifyOnUnauthorized: false});
      if (!result.ok) {
        setSavingTokens(false);
        if (result.reason === 'missing' || result.reason === 'unauthorized') {
          setTablesError(t('localTokenRejected'));
        } else if (result.reason === 'offline') {
          setTablesError(t('localTokenOffline'));
        } else {
          setTablesError(t('localTokenVerifyFailed'));
        }
        return;
      }
    }

    setStoredAdminApiToken(adminApiToken);
    setStoredLocalAuthToken(localAuthToken);
    onActivity('tokenSave');
    setSavingTokens(false);
    try {
      await dbApi.establishAdminSession();
    } catch {
      // Session cookie is optional when the admin API token header is sent.
    }
    void fetchTables();
  }

  async function handleSyncLocalStorage() {
    const checkins = readLocalStorageArray('daily_checkins');
    const rituals = readLocalStorageArray('morning_ritual_sessions');

    const ok = await confirm({
      title: 'Import legacy localStorage?',
      message: `This upserts records by ID and overwrites matching server rows. Up to 1,000 check-ins and 1,000 ritual sessions can be imported. This browser has ${checkins.length} check-ins and ${rituals.length} ritual sessions.`,
      confirmLabel: 'Import',
      destructive: true,
    });
    if (!ok) return;

    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await dbApi.syncLocalStorage({
        checkins,
        morning_rituals: rituals,
      });
      setSyncResult({synced: res.synced});
      onActivity('dbSync');
      await fetchTables();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const totalRows = tables.reduce((s, table) => s + table.row_count, 0);

  return (
    <div className="grid min-w-0 gap-6">
      <p className="admin-danger-zone__label">{t('dangerZoneLabel')}</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h2 className="mt-1 text-xl font-black txt-strong">{t('title')}</h2>
          <p className="mt-1 text-sm txt-muted">
            {loadingTables
              ? t('loading')
              : t('tableSummary', {tables: tables.length, rows: totalRows.toLocaleString()})}
          </p>
        </div>

        <AdminActionButton destructive disabled={syncing} onClick={() => void handleSyncLocalStorage()}>
          {syncing ? t('importing') : t('import')}
        </AdminActionButton>
      </div>

      <div className="grid gap-3 rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4">
        <div>
          <p className="text-sm font-bold txt-strong">{t('tokenTitle')}</p>
          <p className="mt-1 text-xs txt-muted">{t('tokenHelp')}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="focus-ring input-base text-sm"
            type="password"
            value={localAuthToken}
            placeholder="LOCAL_AUTH_TOKEN"
            autoComplete="off"
            onChange={(event) => setLocalAuthToken(event.target.value)}
          />
          <input
            className="focus-ring input-base text-sm"
            type="password"
            value={adminApiToken}
            placeholder="ADMIN_API_TOKEN"
            autoComplete="off"
            onChange={(event) => setAdminApiToken(event.target.value)}
          />
          <AdminActionButton disabled={savingTokens} onClick={() => void saveTokens()}>
            {savingTokens ? t('checking') : t('saveTokens')}
          </AdminActionButton>
        </div>
      </div>

      {syncResult ? (
        <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-400">{t('syncComplete')}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(syncResult.synced).map(([key, count]) => (
              <span key={key} className="rounded-full fill-2 px-3 py-1 text-xs txt-soft">
                {key}: <strong className="txt-strong">{count}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {syncError ? (
        <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {syncError}
        </div>
      ) : null}
      {tablesError ? (
        <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-300">{t('loadErrorTitle')}</p>
          <p className="mt-2 text-sm text-red-400">{tablesError}</p>
          <AdminViewButton className="mt-4" onClick={() => void fetchTables()}>
            {t('retry')}
          </AdminViewButton>
        </div>
      ) : null}

      <div className="flex gap-2 self-start rounded-full border border-[color:var(--color-border)] fill-1 p-1">
        {(['tables', 'query'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
              view === v ? 'fill-3 txt-strong' : 'txt-muted hover:txt-strong'
            }`}
          >
            {v === 'tables' ? t('tablesView') : t('queryView')}
          </button>
        ))}
      </div>

      {view === 'tables' ? (
        loadingTables ? (
          <p className="text-sm txt-muted">{t('loadingTables')}</p>
        ) : tablesError ? null : tables.length === 0 ? (
          <AdminEmptyState title={t('noTablesTitle')} description={t('noTablesDetail')} />
        ) : (
          <TableBrowser tables={tables} onRefresh={fetchTables} />
        )
      ) : null}

      {view === 'query' ? <SqlEditor /> : null}
    </div>
  );
}
