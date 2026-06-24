'use client';

import {BackArrow, NavArrow} from '@/components/directional-arrow';
import {downloadCsv, rowsToCsv} from '@/lib/csv-export';
import {useEffect, useState, useCallback, useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {dbApi, DbApiError, ensureAdminSession, type TableSummary, type TableData} from './use-db-api';

function cellStr(val: unknown): string {
  return val == null ? '' : String(val);
}

function pickDefaultTable(tables: TableSummary[]): string | null {
  if (tables.length === 0) return null;
  const withRows = tables.filter((table) => table.row_count > 0);
  if (withRows.length === 0) return tables[0].name;
  return withRows.reduce((best, table) => (table.row_count > best.row_count ? table : best)).name;
}

type Props = {
  tables: TableSummary[];
  onRefresh: () => void;
};

export function TableBrowser({tables, onRefresh}: Props) {
  const t = useTranslations('admin.database.browser');
  const defaultTable = useMemo(() => pickDefaultTable(tables), [tables]);
  const [selected, setSelected] = useState<string | null>(defaultTable);
  const [data, setData] = useState<TableData | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSelected((current) => {
      if (current && tables.some((table) => table.name === current)) return current;
      return defaultTable;
    });
  }, [tables, defaultTable]);

  const load = useCallback(async (table: string, p: number, q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      await ensureAdminSession();
      const result = await dbApi.getTable(table, p, q);
      setData(result);
    } catch (err) {
      setData(null);
      if (err instanceof DbApiError) {
        setLoadError(err.message);
      } else {
        setLoadError(err instanceof Error ? err.message : t('loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selected) return;
    const timeout = window.setTimeout(() => void load(selected, page, search), 0);
    return () => window.clearTimeout(timeout);
  }, [selected, page, search, load]);

  function handleSelectTable(name: string) {
    setSelected(name);
    setPage(1);
    setSearch('');
    setLoadError(null);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function exportCsv() {
    if (!data) return;
    const columns = data.columns.map((c) => c.name);
    downloadCsv(`${data.table}-page${page}.csv`, rowsToCsv(columns, data.rows as Record<string, unknown>[]));
  }

  const totalPages = data ? Math.max(1, data.total_pages) : 1;

  return (
    <div className="admin-db-browser">
      <aside className="admin-db-browser__sidebar rounded-[18px] border border-[color:var(--color-border)] fill-1 p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider txt-muted">{t('tablesLabel')}</p>
        <div className="admin-db-browser__table-list">
          {tables.map((table) => {
            const active = selected === table.name;
            return (
              <button
                key={table.name}
                type="button"
                onClick={() => handleSelectTable(table.name)}
                className={`admin-db-browser__table-btn ${active ? 'admin-db-browser__table-btn--active' : ''}`}
              >
                <span className={`admin-db-browser__table-name ${active ? 'txt-strong' : 'txt-soft'}`}>
                  {table.name}
                </span>
                <span
                  className={`admin-db-browser__table-count ${
                    active ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'fill-2 txt-faint'
                  }`}
                  aria-hidden
                >
                  {table.row_count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="admin-db-browser__main grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="focus-ring input-base h-9 min-w-0 flex-1 text-sm"
            style={{minWidth: '12rem'}}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
          />
          <button
            type="button"
            className="focus-ring btn-ghost h-9 shrink-0 text-sm"
            onClick={exportCsv}
            disabled={!data || data.rows.length === 0}
          >
            {t('exportCsv')}
          </button>
          <button
            type="button"
            className="focus-ring btn-ghost h-9 shrink-0 text-sm"
            onClick={onRefresh}
          >
            {t('refresh')}
          </button>
        </div>

        {loadError ? (
          <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {loadError}
          </div>
        ) : null}

        <div className="admin-db-browser__grid-wrap">
          {loading ? (
            <div className="p-8 text-center text-sm txt-muted">{t('loading')}</div>
          ) : data ? (
            <>
              <table className="admin-db-browser__grid">
                <thead>
                  <tr>
                    {data.columns.map((col) => (
                      <th key={col.name}>
                        {col.name}
                        <span className="ms-1 txt-faint">{col.type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={data.columns.length} className="py-8 text-center txt-muted">
                        {t('noRows', {table: data.table})}
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, idx) => (
                      <tr key={idx}>
                        {data.columns.map((col) => {
                          const val = (row as Record<string, unknown>)[col.name];
                          const str = cellStr(val);
                          return (
                            <td key={col.name} title={str}>
                              {str}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border)] px-4 py-3">
                <span className="text-xs txt-muted">
                  {data.total === 0
                    ? t('paginationEmpty', {table: data.table})
                    : t('pagination', {total: data.total, page: data.page, pages: totalPages})}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="focus-ring rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs txt-soft disabled:opacity-30 hover:txt-strong"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <BackArrow /> {t('prev')}
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs txt-soft disabled:opacity-30 hover:txt-strong"
                    disabled={!data.total || page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('next')} <NavArrow />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm txt-muted">{t('selectTable')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
