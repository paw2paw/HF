import { useState, useCallback } from "react";

/**
 * useWizardError — lightweight error state for wizard flows.
 *
 * Provides `error` string, `setError`, `clearError`, and `handleApiError`
 * (parses a failed Response into an error message). Progressive adoption —
 * wizards can adopt this incrementally without forced migration.
 */
export function useWizardError() {
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const handleApiError = useCallback(async (res: Response): Promise<boolean> => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Server error (${res.status})`);
      return true; // error occurred
    }
    return false; // no error
  }, []);

  return { error, setError, clearError, handleApiError };
}
