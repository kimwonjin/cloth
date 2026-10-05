import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type Key = string | number | boolean | null | undefined;

/**
 * Minimal data-fetching hook: runs `fn` whenever the screen gains focus or a
 * value in `keys` changes, and exposes `reload` for pull-to-refresh / after
 * mutations. `keys` must be primitives (ids, filters).
 */
export function useQuery<T>(fn: () => Promise<T>, keys: Key[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  const requestId = useRef(0);
  const keyString = JSON.stringify(keys);

  // Keep the latest fn without re-subscribing; runs before the focus effect below.
  useEffect(() => {
    fnRef.current = fn;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // keyString makes `reload` (and so the focus effect) change when keys change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyString]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, loading, reload, setData };
}
