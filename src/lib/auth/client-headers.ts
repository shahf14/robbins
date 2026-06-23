'use client';

import {LOCAL_AUTH_TOKEN_STORAGE_KEY} from '../auth-storage-keys';

export function getStoredLocalAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(LOCAL_AUTH_TOKEN_STORAGE_KEY)?.trim() ?? '';
}

export function setStoredLocalAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (trimmed) {
    window.sessionStorage.setItem(LOCAL_AUTH_TOKEN_STORAGE_KEY, trimmed);
  } else {
    window.sessionStorage.removeItem(LOCAL_AUTH_TOKEN_STORAGE_KEY);
  }
}

/** Headers for authenticated API calls (Bearer LOCAL_AUTH_TOKEN from sessionStorage). */
export function getLocalAuthHeaders(): HeadersInit {
  const token = getStoredLocalAuthToken();
  return token ? {Authorization: `Bearer ${token}`} : {};
}

export function mergeLocalAuthHeaders(init?: RequestInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...getLocalAuthHeaders(),
    ...(init?.headers ?? {}),
  };
}
