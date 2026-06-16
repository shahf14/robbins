'use client';

import {useCallback, useEffect, useState} from 'react';
import {
  dbApi,
  getStoredAdminApiToken,
  getStoredLocalAuthToken,
  setStoredAdminApiToken,
  setStoredLocalAuthToken,
  type TableSummary,
} from './use-db-api';
import {parseJsonArrayOr} from '@/lib/safe-json';
import {TableBrowser} from './table-browser';
import {SqlEditor} from './sql-editor';

type View = 'tables' | 'query';

function readLocalStorageArray(key: string): unknown[] {
  try {
    const value = window.localStorage.getItem(key);
    return parseJsonArrayOr<unknown>(value);
  } catch {
    return [];
  }
}

export function DatabaseTab() {
  const [view, setView] = useState<View>('tables');
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{synced: Record<string, number>} | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [adminApiToken, setAdminApiToken] = useState(() => getStoredAdminApiToken());
  const [localAuthToken, setLocalAuthToken] = useState(() => getStoredLocalAuthToken());

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await dbApi.listTables();
      setTables(res.tables);
      return res.tables;
    } catch {
      setTables([]);
      return [];
    } finally {
      setLoadingTables(false);
    }
  }, []);

  // On mount: load tables
  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchTables(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchTables]);

  function saveTokens() {
    setStoredAdminApiToken(adminApiToken);
    setStoredLocalAuthToken(localAuthToken);
    void fetchTables();
  }

  async function handleSyncLocalStorage() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const checkins = readLocalStorageArray('daily_checkins');
      const rituals = readLocalStorageArray('morning_ritual_sessions');

      const res = await dbApi.syncLocalStorage({
        checkins,
        morning_rituals: rituals,
      });
      setSyncResult({synced: res.synced});
      await fetchTables();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Database</p>
          <h2 className="mt-1 text-xl font-black text-white">Local SQLite — life-coach.db</h2>
          <p className="mt-1 text-sm text-white/50">
            {loadingTables
              ? 'Loading…'
              : `${tables.length} tables · ${tables.reduce((s, t) => s + t.row_count, 0).toLocaleString()} total rows`}
          </p>
        </div>

        {/* Sync buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="focus-ring btn-primary text-sm"
            disabled={syncing}
            onClick={handleSyncLocalStorage}
          >
            {syncing ? '⟳ Importing…' : '⬆ Import legacy localStorage'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[18px] border border-white/10 bg-white/3 p-4">
        <div>
          <p className="text-sm font-bold text-white">Admin access token</p>
          <p className="mt-1 text-xs text-white/45">
            Stored in this browser tab session only. Production DB routes require ADMIN_API_TOKEN.
          </p>
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
          <button
            type="button"
            className="focus-ring btn-secondary text-sm"
            onClick={saveTokens}
          >
            Save tokens
          </button>
        </div>
      </div>

      {/* Sync feedback */}
      {syncResult && (
        <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-400">Sync complete</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(syncResult.synced).map(([key, count]) => (
              <span key={key} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                {key}: <strong className="text-white">{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
      {syncError && (
        <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {syncError}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2 rounded-full border border-white/10 bg-white/3 p-1 self-start">
        {(['tables', 'query'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
              view === v
                ? 'bg-white/12 text-white'
                : 'text-white/45 hover:text-white'
            }`}
          >
            {v === 'tables' ? 'Tables' : 'SQL Query'}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'tables' && (
        loadingTables ? (
          <p className="text-sm text-white/40">Loading tables…</p>
        ) : tables.length === 0 ? (
          <div className="rounded-[18px] border border-white/10 p-8 text-center">
            <p className="text-sm text-white/50">No tables found.</p>
            <p className="mt-2 text-xs text-white/30">Use the local import action to populate the database.</p>
          </div>
        ) : (
          <TableBrowser tables={tables} onRefresh={fetchTables} />
        )
      )}

      {view === 'query' && <SqlEditor />}
    </div>
  );
}
