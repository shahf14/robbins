'use client';

import {useEffect, useState, useCallback} from 'react';
import {dbApi, type TableSummary, type TableData} from './use-db-api';

const PAGE_SIZE = 50;

function cellStr(val: unknown): string {
  return val == null ? '' : String(val);
}

type Props = {
  tables: TableSummary[];
  onRefresh: () => void;
};

export function TableBrowser({tables, onRefresh}: Props) {
  const [selected, setSelected] = useState<string | null>(tables[0]?.name ?? null);
  const [data, setData] = useState<TableData | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (table: string, p: number, q: string) => {
    setLoading(true);
    try {
      const result = await dbApi.getTable(table, p, q);
      setData(result);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const timeout = window.setTimeout(() => void load(selected, page, search), 0);
    return () => window.clearTimeout(timeout);
  }, [selected, page, search, load]);

  function handleSelectTable(name: string) {
    setSelected(name);
    setPage(1);
    setSearch('');
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function exportCsv() {
    if (!data) return;
    const header = data.columns.map((c) => c.name).join(',');
    const body = data.rows.map((row) =>
      data.columns.map((c) => {
        const val = (row as Record<string, unknown>)[c.name];
        const str = cellStr(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ).join('\n');
    const blob = new Blob([`${header}\n${body}`], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.table}-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <div className="rounded-[18px] border border-white/10 bg-white/2 p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-white/40">Tables</p>
        <div className="grid gap-0.5">
          {tables.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => handleSelectTable(t.name)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                selected === t.name
                  ? 'bg-[var(--blue)]/15 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{t.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                selected === t.name ? 'bg-[var(--blue)]/20 text-[var(--blue)]' : 'bg-white/8 text-white/30'
              }`}>
                {t.row_count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data panel */}
      <div className="grid gap-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="focus-ring input-base h-9 flex-1 min-w-48 text-sm"
            placeholder="Search…"
            value={search}
            onChange={handleSearchChange}
          />
          <button
            type="button"
            className="focus-ring btn-ghost h-9 text-sm"
            onClick={exportCsv}
            disabled={!data}
          >
            ↓ Export CSV
          </button>
          <button
            type="button"
            className="focus-ring btn-ghost h-9 text-sm"
            onClick={onRefresh}
          >
            ↺ Refresh
          </button>
        </div>

        {/* Table grid */}
        <div className="overflow-x-auto rounded-[18px] border border-white/10">
          {loading ? (
            <div className="p-8 text-center text-sm text-white/40">Loading…</div>
          ) : data ? (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    {data.columns.map((col) => (
                      <th key={col.name} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                        {col.name}
                        <span className="ml-1 text-white/25">{col.type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={data.columns.length} className="px-4 py-8 text-center text-white/40">
                        No rows
                      </td>
                    </tr>
                  ) : data.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/2">
                      {data.columns.map((col) => {
                        const val = (row as Record<string, unknown>)[col.name];
                        const str = cellStr(val);
                        return (
                          <td key={col.name} className="max-w-xs truncate px-4 py-2.5 text-xs text-white/70" title={str}>
                            {str}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <span className="text-xs text-white/40">
                  {data.total.toLocaleString()} rows · page {data.page} / {data.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 disabled:opacity-30 hover:text-white"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 disabled:opacity-30 hover:text-white"
                    disabled={page >= data.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-white/40">Select a table to view data</div>
          )}
        </div>
      </div>
    </div>
  );
}
