import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export const FORM_DRAFT_KEY = 'clooval_request_draft';

export function usePersistedFormState<T>(
  initialState: T
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialState;
    }

    try {
      const saved = window.sessionStorage.getItem(FORM_DRAFT_KEY);
      if (!saved) {
        return initialState;
      }

      const parsed = JSON.parse(saved);
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (parsed._savedAt && parsed._savedAt > twoHoursAgo) {
        const { _savedAt, ...formData } = parsed;
        return formData as T;
      }

      window.sessionStorage.removeItem(FORM_DRAFT_KEY);
    } catch {
      window.sessionStorage.removeItem(FORM_DRAFT_KEY);
    }

    return initialState;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({
          ...state,
          _savedAt: Date.now(),
        }));
      } catch {
        // Ignore storage failures so the form keeps working.
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [state]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(FORM_DRAFT_KEY);
    }
  };

  return [state, setState, clearDraft];
}
