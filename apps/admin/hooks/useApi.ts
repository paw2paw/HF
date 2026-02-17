"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Standard API response shape used by most endpoints.
 * Endpoints return { ok: true, ...data } on success or { ok: false, error: string } on failure.
 */
export type ApiResponse<T> = {
  ok: boolean;
  error?: string;
} & Record<string, any>;

export interface UseApiOptions<T> {
  /** Skip initial fetch (useful for conditional loading) */
  skip?: boolean;
  /** Transform the raw response data before setting state */
  transform?: (data: ApiResponse<T>) => T;
  /** Called on successful fetch */
  onSuccess?: (data: T) => void;
  /** Called on fetch error */
  onError?: (error: string) => void;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Manually set data (for optimistic updates) */
  setData: (data: T | null) => void;
}

/**
 * Hook for fetching data from API endpoints.
 * Handles loading state, errors, and the standard { ok, ...data } response pattern.
 *
 * @example Basic usage
 * ```tsx
 * const { data: goals, loading, error, refetch } = useApi<Goal[]>('/api/goals', {
 *   transform: (res) => res.goals
 * });
 * ```
 *
 * @example With dependencies (refetch when they change)
 * ```tsx
 * const { data } = useApi<Goal[]>(
 *   `/api/goals?status=${status}&type=${type}`,
 *   { transform: (res) => res.goals },
 *   [status, type]
 * );
 * ```
 *
 * @example Skip initial fetch
 * ```tsx
 * const { data, refetch } = useApi<Goal[]>('/api/goals', { skip: true });
 * // Later: refetch();
 * ```
 */
export function useApi<T>(
  url: string | null,
  options: UseApiOptions<T> = {},
  deps: unknown[] = []
): UseApiResult<T> {
  const { skip = false, transform, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip && url !== null);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      const json: ApiResponse<T> = await response.json();

      if (!mountedRef.current) return;

      if (json.ok) {
        const result = transform ? transform(json) : (json as unknown as T);
        setData(result);
        onSuccess?.(result);
      } else {
        const errorMsg = json.error || "Request failed";
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const errorMsg = err instanceof Error ? err.message : "Network error";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url, transform, onSuccess, onError]);

  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    if (!skip && url) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, skip, ...deps]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}

/**
 * Hook for fetching multiple API endpoints in parallel.
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useApiParallel({
 *   summary: { url: '/api/metering/summary', transform: (r) => r },
 *   events: { url: '/api/metering/events', transform: (r) => r.events }
 * });
 * // data.summary, data.events
 * ```
 */
export function useApiParallel<T extends Record<string, unknown>>(
  endpoints: {
    [K in keyof T]: {
      url: string;
      transform?: (data: ApiResponse<T[K]>) => T[K];
    };
  },
  deps: unknown[] = []
): {
  data: { [K in keyof T]: T[K] | null };
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const keys = Object.keys(endpoints) as (keyof T)[];
  const initialData = keys.reduce(
    (acc, key) => ({ ...acc, [key]: null }),
    {} as { [K in keyof T]: T[K] | null }
  );

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        keys.map(async (key) => {
          const { url, transform } = endpoints[key];
          const response = await fetch(url);
          const json = await response.json();

          if (!json.ok) {
            throw new Error(json.error || `Failed to fetch ${String(key)}`);
          }

          return { key, value: transform ? transform(json) : json };
        })
      );

      if (!mountedRef.current) return;

      const newData = results.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {} as { [K in keyof T]: T[K] | null }
      );

      setData(newData);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(endpoints)]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  return { data, loading, error, refetch: fetchAll };
}

export default useApi;
