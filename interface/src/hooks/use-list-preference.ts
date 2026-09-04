"use client";

import { useCallback, useEffect, useState } from "react";

/** Backed by alaiy_os.api.preferences (get/set_preference), scoped to the
 * current session user server-side. `value` is opaque JSON, owned by whoever
 * calls this hook - e.g. a table's column order or active filters. */
export function useListPreference<T>(contextKey: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/method/alaiy_os.api.preferences.get_preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { message?: Record<string, string> } | null) => {
        if (cancelled) return;
        const raw = data?.message?.[contextKey];
        if (!raw) return;
        try {
          setValue(JSON.parse(raw) as T);
        } catch {
          // malformed stored value - keep the default rather than crash
        }
      })
      .catch(() => {
        // value stays at its default - nothing to recover here
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [contextKey]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      fetch("/api/method/alaiy_os.api.preferences.set_preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_key: contextKey, value: JSON.stringify(next) }),
      }).catch(() => {
        // best-effort persistence - the UI already updated optimistically
      });
    },
    [contextKey],
  );

  return { value, update, isLoaded };
}
