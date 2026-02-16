/**
 * Tour Storage
 *
 * localStorage persistence for tour completion state.
 * Follows the existing pattern: hf.{feature}.{userId}
 */

const TOUR_PREFIX = "hf.tour.completed";

function key(userId: string, tourId: string): string {
  return `${TOUR_PREFIX}.${userId}.${tourId}`;
}

export function isTourCompleted(userId: string, tourId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key(userId, tourId)) !== null;
}

export function markTourCompleted(userId: string, tourId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId, tourId), new Date().toISOString());
}

export function resetTourCompletion(userId: string, tourId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId, tourId));
}

export function resetAllTours(userId: string): void {
  if (typeof window === "undefined") return;
  const prefix = `${TOUR_PREFIX}.${userId}.`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
