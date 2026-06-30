'use client';

import {
  getStoredLocalAuthToken,
  mergeLocalAuthHeaders,
  setStoredLocalAuthToken,
} from '@/lib/auth/client-headers';

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

export {getStoredLocalAuthToken, setStoredLocalAuthToken};

export class DbApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DbApiError';
    this.status = status;
  }
}

export function getStoredAdminApiToken() {
  return getStorageToken(ADMIN_TOKEN_STORAGE_KEY);
}
export function setStoredAdminApiToken(token: string) {
  setStorageToken(ADMIN_TOKEN_STORAGE_KEY, token);
}

async function dbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const adminApiToken = getStoredAdminApiToken();

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...mergeLocalAuthHeaders(init),
      ...(adminApiToken ? {'x-admin-api-token': adminApiToken} : {}),
    },
  });

  if (res.status === 204) {
    if (!res.ok) throw new DbApiError(res.statusText || 'Request failed', res.status);
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const fallback =
      res.status === 404
        ? 'Admin API route not found.'
        : `Request failed (${res.status}).`;
    throw new DbApiError(fallback, res.status);
  }

  const payload = (await res.json()) as T & {error?: string};
  if (!res.ok) throw new DbApiError(payload.error ?? 'Request failed', res.status);
  return payload;
}

export type AdminSessionStatus = {
  active: boolean;
  canBootstrap: boolean;
  expiresInSec: number;
};

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
export type LogLine = {
  timestamp?: string;
  type?: string;
  message?: string;
  raw?: string;
};

export const dbApi = {
  getAdminSession: () => dbFetch<AdminSessionStatus>('/api/admin/session'),

  establishAdminSession: () =>
    dbFetch<{ok: boolean; expiresInSec: number}>('/api/admin/session', {method: 'POST'}),

  clearAdminSession: () => dbFetch<void>('/api/admin/session', {method: 'DELETE'}),

  listTables: () => dbFetch<{tables: TableSummary[]}>('/api/db/tables'),

  getTable: (table: string, page = 1, search = '') =>
    dbFetch<TableData>(`/api/db/tables/${table}?page=${page}&search=${encodeURIComponent(search)}`),

  runQuery: (sql: string) =>
    dbFetch<QueryResult>('/api/db/query', {method: 'POST', body: JSON.stringify({sql})}),

  syncLocalStorage: (payload: Record<string, unknown>) =>
    dbFetch<{ok: boolean; synced: Record<string, number>}>(
      '/api/db/sync', {method: 'POST', body: JSON.stringify(payload)}
    ),

  listLogs: (date: string, limit = 200) =>
    dbFetch<{lines: LogLine[]}>(`/api/logs?date=${encodeURIComponent(date)}&limit=${limit}`),
};

/** Opens an httpOnly admin session when possible (token header or dev localhost bypass). */
export async function ensureAdminSession(): Promise<AdminSessionStatus> {
  try {
    const status = await dbApi.getAdminSession();
    if (status.active) return status;
    if (!status.canBootstrap) return status;
    await dbApi.establishAdminSession();
    return dbApi.getAdminSession();
  } catch {
    return {active: false, canBootstrap: false, expiresInSec: 0};
  }
}
