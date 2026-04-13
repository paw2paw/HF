'use client';

import { useState, useEffect, useCallback } from 'react';

export interface JourneyPosition {
  totalStops: number;
  completedStops: number;
  currentPosition: number;
  nextStopType: string;
  /** Continuous mode: progress as percentage (0-100) */
  progressPercentage?: number;
  /** Whether this is a continuous learning course */
  isContinuous: boolean;
}

interface UseJourneyPositionResult {
  position: JourneyPosition | null;
  loading: boolean;
  refresh: () => void;
}

export function useJourneyPosition(callerId: string): UseJourneyPositionResult {
  const [position, setPosition] = useState<JourneyPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosition = useCallback(async () => {
    if (!callerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/student/journey-position?callerId=${encodeURIComponent(callerId)}`);
      if (!res.ok) {
        setPosition(null);
        return;
      }
      const json = await res.json();
      if (!json.ok || !json.journey) {
        setPosition(null);
        return;
      }
      const isContinuous = json.nextStop?.type === 'continuous' || json.journey.progressPercentage != null;
      setPosition({
        totalStops: json.journey.totalStops,
        completedStops: json.journey.completedStops,
        currentPosition: json.journey.currentPosition,
        nextStopType: json.nextStop?.type ?? 'unknown',
        progressPercentage: json.journey.progressPercentage,
        isContinuous,
      });
    } catch {
      setPosition(null);
    } finally {
      setLoading(false);
    }
  }, [callerId]);

  useEffect(() => { fetchPosition(); }, [fetchPosition]);

  return { position, loading, refresh: fetchPosition };
}
