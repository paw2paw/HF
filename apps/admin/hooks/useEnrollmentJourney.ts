"use client";

import { useState, useEffect, useCallback } from "react";

export interface EnrollmentJourney {
  enrollmentId: string;
  playbookId: string;
  playbookName: string;
  status: string;
  sessions: Array<{
    session: number;
    type: string;
    label: string;
    moduleLabel: string;
    estimatedDurationMins: number | null;
  }>;
  currentSession: number | null;
  totalSessions: number;
}

export function useEnrollmentJourney(callerId: string | null): {
  enrollments: EnrollmentJourney[];
  loading: boolean;
} {
  const [enrollments, setEnrollments] = useState<EnrollmentJourney[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJourney = useCallback(async () => {
    if (!callerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/callers/${callerId}/journey-progress`);
      const data = await res.json();
      if (data.ok) {
        setEnrollments(data.enrollments);
      }
    } catch {
      // Non-critical — journey progress is supplementary
    } finally {
      setLoading(false);
    }
  }, [callerId]);

  useEffect(() => {
    fetchJourney();
  }, [fetchJourney]);

  return { enrollments, loading };
}
