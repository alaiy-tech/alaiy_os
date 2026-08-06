/**
 * Every user/theme/layout preference this app has, and its allowed values -
 * the single registry `PreferenceKey`/`PreferenceValueMap`/`PREFERENCE_DEFAULTS`
 * all derive from. The durable copy of every value lives in the local
 * SQLite `preferences` table (`runtime/store/sqlite-preferences-store.ts`,
 * one shared value per key, not per user/browser) - that's the only source
 * of truth; nothing here is mirrored to a cookie or localStorage.
 */

import { fontKeys } from "@/config/fonts";
import {
  CONTENT_LAYOUT_VALUES,
  NAVBAR_STYLE_VALUES,
  SIDEBAR_COLLAPSIBLE_VALUES,
  SIDEBAR_VARIANT_VALUES,
} from "@/constants/layout-preferences";
import { THEME_MODE_VALUES, THEME_PRESET_VALUES } from "@/constants/theme";

type PreferenceDefinition<Values extends readonly string[], Attribute extends `data-${string}`> = {
  values: Values;
  defaultValue: Values[number];
  attribute: Attribute;
};

function definePreference<const Values extends readonly string[], const Attribute extends `data-${string}`>(
  definition: PreferenceDefinition<Values, Attribute>,
) {
  return definition;
}

export const PREFERENCE_REGISTRY = {
  theme_mode: definePreference({
    values: THEME_MODE_VALUES,
    defaultValue: "light",
    attribute: "data-theme-mode",
  }),

  theme_preset: definePreference({
    values: THEME_PRESET_VALUES,
    defaultValue: "default",
    attribute: "data-theme-preset",
  }),

  font: definePreference({
    values: fontKeys,
    defaultValue: "geist",
    attribute: "data-font",
  }),

  content_layout: definePreference({
    values: CONTENT_LAYOUT_VALUES,
    defaultValue: "centered",
    attribute: "data-content-layout",
  }),

  navbar_style: definePreference({
    values: NAVBAR_STYLE_VALUES,
    defaultValue: "sticky",
    attribute: "data-navbar-style",
  }),

  // Read directly (via getPreference) by os/layout.tsx and settings/layout.tsx
  // to pass as SSR-fallback props into the sidebar - must stay consistent
  // during SSR, which SQLite already guarantees.
  sidebar_variant: definePreference({
    values: SIDEBAR_VARIANT_VALUES,
    defaultValue: "sidebar",
    attribute: "data-sidebar-variant",
  }),

  sidebar_collapsible: definePreference({
    values: SIDEBAR_COLLAPSIBLE_VALUES,
    defaultValue: "icon",
    attribute: "data-sidebar-collapsible",
  }),
} as const;

export type PreferenceKey = keyof typeof PREFERENCE_REGISTRY;

export type PreferenceValueMap = {
  [K in PreferenceKey]: (typeof PREFERENCE_REGISTRY)[K]["values"][number];
};

export const PREFERENCE_KEYS = Object.freeze(Object.keys(PREFERENCE_REGISTRY) as PreferenceKey[]);

export const PREFERENCE_DEFAULTS = Object.fromEntries(
  PREFERENCE_KEYS.map((key) => [key, PREFERENCE_REGISTRY[key].defaultValue]),
) as PreferenceValueMap;

export function parsePreference<K extends PreferenceKey>(
  key: K,
  rawValue: string | null | undefined,
): PreferenceValueMap[K] {
  const definition = PREFERENCE_REGISTRY[key];
  const allowedValues = definition.values as readonly string[];

  if (rawValue && allowedValues.includes(rawValue)) {
    return rawValue as PreferenceValueMap[K];
  }

  return definition.defaultValue as PreferenceValueMap[K];
}
