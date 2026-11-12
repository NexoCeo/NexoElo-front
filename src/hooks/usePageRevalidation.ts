import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Refetch-like behavior without a query library. The caller still owns the
 * request, errors, and state; this hook only revalidates a visible page.
 *
 * Existing page effects perform the first fetch. Focus and visibility events
 * are deduplicated because browsers often emit both in rapid succession.
 */
export function usePageRevalidation(
  refresh: () => void | Promise<unknown>,
  options: { enabled?: boolean; minIntervalMs?: number } = {},
) {
  const location = useLocation();
  const { enabled = true, minIntervalMs = 1500 } = options;
  const refreshRef = useRef(refresh);
  const lastRun = useRef(0);
  const firstRoute = useRef(true);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const revalidate = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      void refreshRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    // Mirrors refetchOnWindowFocus from TanStack Query, without installing it.
    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, minIntervalMs]);

  useEffect(() => {
    // Avoid a duplicate request with the page's original mount effect.
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    if (!enabled || document.visibilityState === "hidden") return;
    lastRun.current = Date.now();
    void refreshRef.current();
  }, [location.pathname, location.search, enabled]);
}
