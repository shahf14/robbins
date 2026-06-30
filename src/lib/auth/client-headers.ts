'use client';

export {
  clearStoredLocalAuthToken,
  getStoredLocalAuthToken,
  setStoredLocalAuthToken,
  subscribeStoredLocalAuthToken,
} from './local-auth-token-storage';

import {
  getStoredLocalAuthToken,
} from './local-auth-token-storage';

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
