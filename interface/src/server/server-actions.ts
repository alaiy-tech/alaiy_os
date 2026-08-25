"use server";

import { cookies } from "next/headers";

import {
  getPreferencePersistence,
  PREFERENCE_DEFAULTS,
  PREFERENCE_KEYS,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";
import { getPreferencesStore } from "@/runtime/store/sqlite-preferences-store";

export async function getValueFromCookie(key: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(key)?.value;
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    path: options.path ?? "/",
    maxAge: options.maxAge ?? 60 * 60 * 24 * 7, // default: 7 days
  });
}

/**
 * Preferences are stored in the local SQLite `preferences` table
 * (`runtime/store/sqlite-preferences-store.ts`) - one shared value per key,
 * not per browser cookie. `"none"`-persistence keys (none exist today, but
 * the mode stays meaningful) never reach the store at all and just resolve
 * to their default every time, matching "resets on reload."
 */
export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  if (getPreferencePersistence(key) === "none") {
    return PREFERENCE_REGISTRY[key].defaultValue as PreferenceValueMap[K];
  }

  const stored = await getPreferencesStore().getPreferences();
  return parsePreference(key, stored[key]);
}

/** Every preference in one resolved, validated read - used where a caller
 * needs the whole set at once (`RootLayout`'s initial `<html>` attributes
 * and `PreferencesStoreProvider` seed) rather than one key at a time. Reads
 * through a generic inner function per key (not a direct indexed loop
 * assignment) for the same reason `preferences-provider.tsx`'s
 * `readDomPreferences`/`assignPreference` does - TS can't correlate a
 * widened `PreferenceKey` loop variable with `PreferenceValueMap[K]`
 * otherwise. */
export async function getAllPreferences(): Promise<PreferenceValueMap> {
  const stored = await getPreferencesStore().getPreferences();
  const values = { ...PREFERENCE_DEFAULTS };

  function assignPreference<K extends PreferenceKey>(key: K) {
    if (getPreferencePersistence(key) === "none") return;
    values[key] = parsePreference(key, stored[key]);
  }

  for (const key of PREFERENCE_KEYS) assignPreference(key);
  return values;
}

/** The DB-write half of `persistPreference` (`lib/preferences/preferences-storage.ts`)
 * - a plain `string` key/value, like `setValueToCookie` above, since a
 * Server Action's params cross the client/server boundary and can't carry
 * the generic. Validated on the way back out by `getPreference`/
 * `getAllPreferences`, not on the way in - the store itself is a dumb
 * key/value table, same division of labour `SQLiteSidebarStore` already
 * has between raw rows and validated read shapes. */
export async function setPreferenceValue(key: string, value: string): Promise<void> {
  await getPreferencesStore().setPreference(key as PreferenceKey, value as never);
}
