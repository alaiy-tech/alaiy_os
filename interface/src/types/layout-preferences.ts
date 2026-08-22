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
