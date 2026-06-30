'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

/** Shows a value briefly, then clears it after `durationMs`. */
export function useAutoHide<T>(durationMs: number) {
  const [value, setValue] = useState<T | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setValue(null);
  }, []);

  const show = useCallback(
    (next: T) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      setValue(next);
      timeoutRef.current = window.setTimeout(() => {
        setValue(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return {value, show, clear};
}
