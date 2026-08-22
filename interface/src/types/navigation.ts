import type { LucideIcon } from "lucide-react";

/** The sidebar's item shapes, kept in their own module so that both the base's
 * own `sidebar-config` and the composer-generated `contributed-nav` can depend
 * on them without importing each other (see `noImportCycles`). */

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

/** One contributing app's slice of the sidebar. Declared in that app's
 * `interface/interface.config.json` and collected into `contributed-nav.ts` by
 * the composer; the type lives here rather than there because that file is
 * generated. */
export interface NavContribution {
  /** The Frappe app this came from. Provenance only — nothing renders it. */
  app: string;
  /** `label` of the base group to merge into. An unknown label opens a new group. */
  group: string;
  items: NavMainItem[];
}

/**
 * Plain-data mirror of `NavSubItem`/`NavMainItem`/`NavGroup`, for what
 * actually crosses the Server → Client boundary when the sidebar is read
 * from the database (`runtime/store/sidebar-store.ts`). `icon` is a
 * lower-kebab-case name string here, not a `LucideIcon` component — a
 * component reference can't be passed as a prop from a Server Component (the
 * DB read is server-only) to a Client Component, so the name crosses the
 * boundary as plain data and is resolved to a real component *inside* the
 * client component that renders it, via `resolveNavIcon`
 * (`config/nav-icons.ts`). `NavGroup`/`NavMainItem` themselves are
 * unchanged and still what `nav-main.tsx` renders — `AppSidebar` converts
 * this shape into that one.
 */
export interface SidebarNavItemData {
  id: string;
  title: string;
  /** `null` only for a parent item whose children are its `subItems`. */
  url: string | null;
  icon?: string;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  subItems?: SidebarNavItemData[];
}

export interface SidebarNavGroupData {
  id: string;
  label?: string;
  items: SidebarNavItemData[];
}
