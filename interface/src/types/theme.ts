import type {
  THEME_MODE_VALUES,
  THEME_PRESET_OPTIONS,
} from "@/constants/theme";

export type ThemeMode = (typeof THEME_MODE_VALUES)[number];
export type ResolvedThemeMode = "light" | "dark";

/** Hand-maintained rather than part of the generated block in
 * `constants/theme.ts` - the derivation itself never changes when a preset
 * is added or removed, only `THEME_PRESET_OPTIONS`'s contents do. */
export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number]["value"];

import type {
  CONTENT_LAYOUT_VALUES,
  NAVBAR_STYLE_VALUES,
  SIDEBAR_COLLAPSIBLE_VALUES,
  SIDEBAR_VARIANT_VALUES,
} from "@/constants/layout-preferences";

export type SidebarVariant = (typeof SIDEBAR_VARIANT_VALUES)[number];
export type SidebarCollapsible = (typeof SIDEBAR_COLLAPSIBLE_VALUES)[number];
export type ContentLayout = (typeof CONTENT_LAYOUT_VALUES)[number];
export type NavbarStyle = (typeof NAVBAR_STYLE_VALUES)[number];
