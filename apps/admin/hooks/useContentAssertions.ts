/**
 * Shared hook for fetching content assertions from a source.
 *
 * Used by: ReviewStep (wizard), content-sources/[sourceId] detail page.
 * Endpoint: GET /api/content-sources/:sourceId/assertions
 *
 * Handles pagination, filtering, sorting, and review progress tracking.
 */

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────

export interface AssertionRecord {
  id: string;
  assertion: string;
  category: string;
  tags: string[];
  chapter: string | null;
  section: string | null;
  pageRef: string | null;
  validFrom: string | null;
  validUntil: string | null;
  taxYear: string | null;
  examRelevance: number | null;
  learningOutcomeRef: string | null;
  depth: number | null;
  topicSlug: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewer: { id: string; name: string | null; email: string } | null;
  _count: { children: number };
}

export interface AssertionFilters {
  search?: string;
  category?: string;
  /** "true" | "false" | "" */
  reviewed?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface UseContentAssertionsOptions {
  sourceId: string | null | undefined;
  filters?: AssertionFilters;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseContentAssertionsResult {
  assertions: AssertionRecord[];
  total: number;
  reviewedCount: number;
  reviewProgress: number;
  loading: boolean;
  refetch: () => void;
}

// ── Hook ─────────────────────────────────────────────────

export function useContentAssertions({
  sourceId,
  filters = {},
  page = 0,
  pageSize = 50,
  enabled = true,
}: UseContentAssertionsOptions): UseContentAssertionsResult {
  const [assertions, setAssertions] = useState<AssertionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAssertions = useCallback(async () => {
    if (!sourceId || !enabled) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.reviewed) params.set("reviewed", filters.reviewed);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortDir) params.set("sortDir", filters.sortDir);
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));

      const res = await fetch(`/api/content-sources/${sourceId}/assertions?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAssertions(data.assertions ?? []);
        setTotal(data.total ?? 0);
        setReviewedCount(data.reviewed ?? 0);
        setReviewProgress(data.reviewProgress ?? 0);
      }
    } catch {
      // silent — callers handle empty state
    } finally {
      setLoading(false);
    }
  }, [sourceId, filters.search, filters.category, filters.reviewed, filters.sortBy, filters.sortDir, page, pageSize, enabled]);

  useEffect(() => {
    fetchAssertions();
  }, [fetchAssertions]);

  return {
    assertions,
    total,
    reviewedCount,
    reviewProgress,
    loading,
    refetch: fetchAssertions,
  };
}
