import {LOCAL_AUTH_TOKEN_STORAGE_KEY} from '../auth-storage-keys';

const AUTH_BROADCAST_CHANNEL = 'robbins-local-auth-token';

function authBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
}

function notifyAuthTokenChanged(): void {
  authBroadcastChannel()?.postMessage(null);
}

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
  notifyAuthTokenChanged();
}

export function clearStoredLocalAuthToken(): void {
  setStoredLocalAuthToken('');
}

export function subscribeStoredLocalAuthToken(listener: () => void): () => void {
  const channel = authBroadcastChannel();
  if (!channel) return () => {};
  channel.onmessage = () => listener();
  return () => channel.close();
}
