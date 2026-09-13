import { useEffect, useState } from "react";
import type { AuthStatus } from "@shared/auth";

/**
 * Mirrors main's auth state machine. Null until main's startup restore has
 * resolved — callers hold the shell back on null so a restored session never
 * flashes the login view (issue #18).
 */
export function useAuthState(): AuthStatus | null {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    // prev ?? initial: a pushed status that arrived before this promise
    // resolved must not be overwritten by the (older) initial value.
    void window.edunex.getAuthState().then((initial) => {
      if (!cancelled) setStatus((prev) => prev ?? initial);
    });
    const unsubscribe = window.edunex.onAuthState(setStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}
