'use client';

import {LOCAL_AUTH_TOKEN_STORAGE_KEY} from '@/lib/auth-storage-keys';

const ADMIN_TOKEN_STORAGE_KEY = 'robbins_admin_api_token';

function getStorageToken(key: string): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(key) ?? '';
}

function setStorageToken(key: string, token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) {
    window.sessionStorage.setItem(key, trimmed);
  } else {
    window.sessionStorage.removeItem(key);
  }
}

export function getStoredAdminApiToken() { return getStorageToken(ADMIN_TOKEN_STORAGE_KEY); }
export function setStoredAdminApiToken(token: string) { setStorageToken(ADMIN_TOKEN_STORAGE_KEY, token); }
export function getStoredLocalAuthToken() { return getStorageToken(LOCAL_AUTH_TOKEN_STORAGE_KEY); }
export function setStoredLocalAuthToken(token: string) { setStorageToken(LOCAL_AUTH_TOKEN_STORAGE_KEY, token); }

async function dbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const localAuthToken = getStoredLocalAuthToken();
  const adminApiToken = getStoredAdminApiToken();

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(localAuthToken ? {Authorization: `Bearer ${localAuthToken}`} : {}),
      ...(adminApiToken ? {'x-admin-api-token': adminApiToken} : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await res.json() as T & {error?: string};
  if (!res.ok) throw new Error(payload.error ?? 'Request failed');
  return payload;
}

export type TableSummary = {name: string; row_count: number};
export type TableData = {
  table: string;
  columns: {name: string; type: string}[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
export type QueryResult = {
  columns: string[];
  rows: unknown[];
  rows_affected: number | null;
  duration_ms: number;
  error?: string;
};

export const dbApi = {
  listTables: () => dbFetch<{tables: TableSummary[]}>('/api/db/tables'),

  getTable: (table: string, page = 1, search = '') =>
    dbFetch<TableData>(`/api/db/tables/${table}?page=${page}&search=${encodeURIComponent(search)}`),

  runQuery: (sql: string) =>
    dbFetch<QueryResult>('/api/db/query', {method: 'POST', body: JSON.stringify({sql})}),

  syncLocalStorage: (payload: Record<string, unknown>) =>
    dbFetch<{ok: boolean; synced: Record<string, number>}>(
      '/api/db/sync', {method: 'POST', body: JSON.stringify(payload)}
    ),
};
