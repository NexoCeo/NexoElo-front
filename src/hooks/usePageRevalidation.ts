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
  options: { enabled?: boolean; minIntervalMs?: number; pollIntervalMs?: number } = {},
) {
  const location = useLocation();
  const { enabled = true, minIntervalMs = 1500, pollIntervalMs = 60_000 } = options;
  const refreshRef = useRef(refresh);
  const lastRun = useRef(0);
  const previousRoute = useRef(location.pathname + location.search);
  const inFlight = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const revalidate = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (inFlight.current || now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      inFlight.current = true;
      void Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => undefined)
        .finally(() => { inFlight.current = false; });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    // Mirrors refetchOnWindowFocus from TanStack Query, without installing it.
    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = pollIntervalMs > 0 ? window.setInterval(revalidate, pollIntervalMs) : undefined;
    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, minIntervalMs, pollIntervalMs]);

  useEffect(() => {
    // Only a real route change should revalidate. Closing an edit modal or
    // toggling "enabled" must not overwrite a just-saved record.
    const route = location.pathname + location.search;
    if (previousRoute.current === route) return;
    previousRoute.current = route;
    if (!enabled || document.visibilityState === "hidden") return;
    if (inFlight.current) return;
    lastRun.current = Date.now();
    inFlight.current = true;
    void Promise.resolve()
      .then(() => refreshRef.current())
      .catch(() => undefined)
      .finally(() => { inFlight.current = false; });
  }, [location.pathname, location.search, enabled]);
}
