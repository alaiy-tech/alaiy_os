import type { THEME_MODE_VALUES, THEME_PRESET_OPTIONS } from "@/constants/theme";

export type ThemeMode = (typeof THEME_MODE_VALUES)[number];
export type ResolvedThemeMode = "light" | "dark";

/** Hand-maintained rather than part of the generated block in
 * `constants/theme.ts` - the derivation itself never changes when a preset
 * is added or removed, only `THEME_PRESET_OPTIONS`'s contents do. */
export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number]["value"];
