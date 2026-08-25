"use client";

import { setPreferenceValue, setValueToCookie } from "@/server/server-actions";
import type { PreferencePersistence } from "@/types/preferences";

import { setClientCookie } from "../cookie.client";
import { setLocalStorageValue } from "../local-storage.client";
import { getPreferencePersistence, type PreferenceKey, type PreferenceValueMap } from "./preferences-config";

/** The DB write (`setPreferenceValue`) is the durable save - it runs for
 * every mode except `"none"`, which by definition never persists at all.
 * The cookie/localStorage write alongside it is a synchronous client-side
 * mirror, not the source of truth: `ThemeBootScript` (`scripts/theme-boot.tsx`)
 * runs pre-hydration, before any DB round trip could resolve, so it still
 * needs something it can read straight off `document.cookie`/`localStorage`
 * to avoid a flash. */
async function persistByMode(mode: PreferencePersistence, key: string, value: string): Promise<void> {
  switch (mode) {
    case "none":
      return;

    case "client-cookie":
      setClientCookie(key, value);
      break;

    case "server-cookie":
      await setValueToCookie(key, value);
      break;

    case "localStorage":
      setLocalStorageValue(key, value);
      break;
  }

  await setPreferenceValue(key, value);
}

export function persistPreference<K extends PreferenceKey>(key: K, value: PreferenceValueMap[K]): Promise<void> {
  return persistByMode(getPreferencePersistence(key), key, value);
}
