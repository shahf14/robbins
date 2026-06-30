'use client';

import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';

const STORAGE_FETCH_TIMEOUT_MS = 20_000;

export class StorageFetchError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'StorageFetchError';
    this.status = status;
  }
}

/**
 * Shared fetch wrapper for client-side storage modules (rituals, evening-reset,
 * etc.). Mirrors the behaviour of lifeCoachFetch: adds auth headers, a default
 * timeout, normalises errors, and calls observeAuthResponse so 401s bubble to
 * the auth gate.
 */
export async function storageFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(STORAGE_FETCH_TIMEOUT_MS),
      headers: mergeLocalAuthHeaders(init),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new StorageFetchError('offline', 503);
    }
    throw error;
  }

  observeAuthResponse(response);

  let payload: T | null = null;
  try {
    const text = await response.text();
    payload = text ? (JSON.parse(text) as T) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (payload as {error?: string} | null)?.error ??
      response.statusText ??
      `Request failed (${response.status}).`;
    throw new StorageFetchError(message, response.status);
  }

  if (payload === null) {
    throw new StorageFetchError('Received an invalid response from the server.', response.status || 0);
  }

  return payload;
}
