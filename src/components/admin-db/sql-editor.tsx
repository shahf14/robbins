'use client';

import {useState} from 'react';
import {dbApi, type QueryResult} from './use-db-api';

const QUICK_QUERIES: {label: string; sql: string}[] = [
  {
    label: '📊 אנרגיה ממוצעת לפי שבוע',
    sql: `SELECT strftime('%Y-W%W', date) as week,
  ROUND(AVG(energy_score), 1) as avg_energy,
  ROUND(AVG(mood_score), 1) as avg_mood,
  COUNT(*) as days
FROM daily_reflections
GROUP BY week
ORDER BY week DESC
LIMIT 12;`,
  },
  {
    label: '🎯 מטרות פתוחות לפי תחום',
    sql: `SELECT domain, domain_category, COUNT(*) as count,
  SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
FROM goals
GROUP BY domain, domain_category
ORDER BY domain;`,
  },
  {
    label: '🔥 Streak נוכחי — כל התחומים',
    sql: `SELECT domain, current_streak, longest_streak,
  ROUND(consistency_rate * 100, 1) as consistency_pct,
  snapshot_date
FROM streaks
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM streaks)
ORDER BY current_streak DESC;`,
  },
  {
    label: '😌 הכרת תודה — 20 האחרונות',
    sql: `SELECT date, position, entry_text
FROM gratitude_entries
ORDER BY date DESC, position ASC
LIMIT 20;`,
  },
  {
    label: '📅 צ\'ק-אין — ציונים אחרונים',
    sql: `SELECT date, focus_score, energy_score, state_score, momentum, primary_tag, priority_action
FROM checkins
ORDER BY date DESC
LIMIT 14;`,
  },
  {
    label: 'צעדים יומיים — השבוע',
    sql: `SELECT scheduled_date, domain, title, status, difficulty, estimated_minutes
FROM daily_steps
WHERE scheduled_date >= date('now', '-7 days')
ORDER BY scheduled_date DESC, domain;`,
  },
  {
    label: '📈 השלמות לפי תחום (30 יום)',
    sql: `SELECT domain,
  COUNT(*) as total,
  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM daily_steps
WHERE scheduled_date >= date('now', '-30 days')
GROUP BY domain
ORDER BY pct DESC;`,
  },
  {
    label: '🧠 תובנות AI אחרונות',
    sql: `SELECT insight_type, substr(content, 1, 120) as preview, created_at
FROM ai_insights
ORDER BY created_at DESC
LIMIT 10;`,
  },
  {
    label: '📋 כל הטבלאות — מספר שורות',
    sql: `SELECT name as table_name,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as exists_flag
FROM sqlite_master m
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY name;`,
  },
];

function cellStr(val: unknown): string {
  return val == null ? '' : String(val);
}

export function SqlEditor() {
  const [sql, setSql] = useState(QUICK_QUERIES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadQuery(querySql: string) {
    setSql(querySql);
    setResult(null);
  }

  async function run() {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dbApi.runQuery(sql);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
      setResult(null);
    }
    setLoading(false);
  }

  function exportCsv() {
    if (!result?.rows?.length) return;
    const header = result.columns.join(',');
    const body = (result.rows as Record<string, unknown>[]).map((row) =>
      result.columns.map((col) => {
        const val = row[col];
        const str = cellStr(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ).join('\n');
    const blob = new Blob([`${header}\n${body}`], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-result.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5">
      {/* Quick query chips */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider txt-muted">Quick Queries</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => loadQuery(q.sql)}
              className="focus-ring rounded-full border border-[color:var(--color-border)] fill-1 px-3 py-1.5 text-xs font-semibold txt-soft transition hover:border-[color:var(--color-border-strong)] hover:txt-strong"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* SQL textarea */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider txt-muted">SQL Query</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="focus-ring rounded-lg border border-[color:var(--color-border-strong)] fill-2 px-4 py-1.5 text-xs font-semibold txt-soft hover:txt-strong disabled:opacity-40"
              onClick={() => setSql('')}
            >
              Clear
            </button>
            <button
              type="button"
              className="focus-ring rounded-lg bg-[var(--blue)] px-5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              disabled={loading || !sql.trim()}
              onClick={run}
            >
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>
        <textarea
          className="focus-ring min-h-36 w-full rounded-[18px] border border-[color:var(--color-border)] fill-1 p-4 font-mono text-sm txt-strong outline-none"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="SELECT * FROM checkins LIMIT 10;"
          spellCheck={false}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void run();
            }
          }}
        />
        <p className="text-right text-xs txt-faint">Ctrl+Enter to run</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[14px] border border-red-500/20 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !error && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs txt-muted">
              {result.rows_affected != null
                ? `${result.rows_affected} rows affected`
                : `${result.rows.length} rows`}
              {' · '}
              {result.duration_ms}ms
            </p>
            {result.rows.length > 0 && (
              <button
                type="button"
                className="focus-ring text-xs font-semibold text-[var(--blue)] hover:underline"
                onClick={exportCsv}
              >
                ↓ Export CSV
              </button>
            )}
          </div>

          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-[18px] border border-[color:var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] fill-1">
                    {result.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider txt-muted">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.rows as Record<string, unknown>[]).map((row, idx) => (
                    <tr key={idx} className="border-b border-[color:var(--color-border)] hover:fill-1">
                      {result.columns.map((col) => {
                        const val = row[col];
                        const str = val == null ? <span className="txt-faint">null</span> : String(val);
                        return (
                          <td key={col} className="max-w-xs truncate px-4 py-2.5 text-xs txt-soft">
                            {str}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.rows.length === 0 && result.rows_affected == null && (
            <p className="text-center text-sm txt-muted">No rows returned</p>
          )}
        </div>
      )}
    </div>
  );
}
