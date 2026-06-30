'use client';

import {useCallback, useEffect, useRef, useState, type DependencyList} from 'react';
import {classifyLoadFailure, type ApiLoadFailureKind} from '@/lib/life-coach/api-error';

type UseApiLoadOptions = {
  /** When false, skips the initial fetch (default true). */
  enabled?: boolean;
};

/**
 * Shared loading/error/data cycle for page-level API fetches.
 * Only shows the loading state on the first fetch; later reloads keep content visible.
 */
export function useApiLoad<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: UseApiLoadOptions = {}
) {
  const {enabled = true} = options;
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiLoadFailureKind | null>(null);
  const [data, setData] = useState<T | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const next = await fetcher();
      setData(next);
      hasLoadedRef.current = true;
      return next;
    } catch (e) {
      setError(classifyLoadFailure(e));
      return undefined;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, deps);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  return {loading, error, data, setData, setError, reload, hasLoadedRef};
}

/** Loading/error tracking for hand-written refresh functions (version guards, partial failures). */
export function useApiLoadSession(initialLoading = true) {
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<ApiLoadFailureKind | null>(null);

  const arm = useCallback(() => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
  }, []);

  const complete = useCallback(() => {
    hasLoadedRef.current = true;
    setLoading(false);
  }, []);

  const fail = useCallback((failure: ApiLoadFailureKind) => {
    setError(failure);
    setLoading(false);
  }, []);

  return {loading, error, setError, arm, complete, fail, hasLoadedRef};
}
