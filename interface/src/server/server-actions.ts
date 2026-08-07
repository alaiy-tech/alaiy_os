"use server";

import {
  PREFERENCE_DEFAULTS,
  PREFERENCE_KEYS,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";
import { getPreferencesStore } from "@/runtime/store/sqlite-preferences-store";

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const stored = await getPreferencesStore().getPreferences();
  return parsePreference(key, stored[key]);
}

/** Every preference in one resolved, validated read - used where a caller
 * needs the whole set at once (`RootLayout`'s initial `<html>` attributes
 * and `PreferencesStoreProvider` seed) rather than one key at a time. Reads
 * through a generic inner function per key, not a direct indexed loop
 * assignment - TS can't correlate a widened `PreferenceKey` loop variable
 * with `PreferenceValueMap[K]` otherwise. */
export async function getAllPreferences(): Promise<PreferenceValueMap> {
  const stored = await getPreferencesStore().getPreferences();
  const values = { ...PREFERENCE_DEFAULTS };

  function assignPreference<K extends PreferenceKey>(key: K) {
    values[key] = parsePreference(key, stored[key]);
  }

  for (const key of PREFERENCE_KEYS) assignPreference(key);
  return values;
}

/** A plain `string` key/value, not the generic `PreferenceValueMap[K]` -
 * a Server Action's params cross the client/server boundary and can't carry
 * the generic. Validated on the way back out by `getPreference`/
 * `getAllPreferences`, not on the way in - the store itself is a dumb
 * key/value table, same division of labour `SQLiteSidebarStore` already
 * has between raw rows and validated read shapes. */
export async function setPreferenceValue(key: string, value: string): Promise<void> {
  await getPreferencesStore().setPreference(key as PreferenceKey, value as never);
}
