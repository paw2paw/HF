'use client';

import { useState, useEffect, useRef } from 'react';
import type { SourceStatusData } from '@/components/shared/SourceStatusDots';

/** @system-constant api-limits — Max content sources per batch status request (client) */
const MAX_STATUS_BATCH = 50;

/** @system-constant polling — Default source status poll interval for content sources */
export const SOURCE_STATUS_POLL_MS = 15_000;

/**
 * useSourceStatus — fetches batch processing status for a list of content source IDs.
 *
 * Calls GET /api/content-sources/status?ids=a,b,c and returns a map of sourceId → SourceStatusData.
 * Auto-polls every `pollInterval` ms if any source has an active job (extracting/importing/pending).
 */
export function useSourceStatus(
  sourceIds: string[],
  options?: { pollInterval?: number; enabled?: boolean }
): Record<string, SourceStatusData> {
  const { pollInterval = SOURCE_STATUS_POLL_MS, enabled = true } = options ?? {};
  const [statusMap, setStatusMap] = useState<Record<string, SourceStatusData>>({});
  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;

  useEffect(() => {
    if (!enabled || sourceIds.length === 0) return;

    const idsKey = sourceIds.slice().sort().join(',');
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const batches: string[][] = [];
        for (let i = 0; i < sourceIds.length; i += MAX_STATUS_BATCH) {
          batches.push(sourceIds.slice(i, i + MAX_STATUS_BATCH));
        }

        const results: Record<string, SourceStatusData> = {};
        for (const batch of batches) {
          const res = await fetch(`/api/content-sources/status?ids=${batch.join(',')}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.sources) {
            Object.assign(results, data.sources);
          }
        }

        if (!cancelled) {
          setStatusMap(results);
        }
      } catch {
        // Silently fail — dots just won't show
      }
    };

    fetchStatus();

    // Poll while any source still has an active extraction job.
    // Uses a ref to avoid stale closure over statusMap.
    const interval = setInterval(() => {
      const current = statusMapRef.current;
      const values = Object.values(current);
      const allDone = values.length >= sourceIds.length
        && values.every((s) => s.assertionCount > 0);
      if (!allDone) {
        fetchStatus();
      }
    }, pollInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sourceIds.join(','), enabled, pollInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  return statusMap;
}
