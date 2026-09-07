import { ArrowLeft, Building2, type LucideIcon, Palette, Plug, Server, Shield, Users } from "lucide-react";

import { iconName } from "@/config/nav-icons";
import type { SidebarNavGroupData } from "@/types/navigation";

export type SettingsNavItem = {
  id: string;
  title: string;
  url: string;
  icon: LucideIcon;
};

/**
 * The Settings sidebar's items are a fixed, baseline UI layout - unlike the
 * `/os/*` sidebar (database-driven, see `runtime/store/sqlite-sidebar-store.ts`),
 * this list is meant to stay in code. Kept in a plain module (no `"use
 * client"`) rather than inside `settings-sidebar.tsx` so `settings/layout.tsx`
 * (a Server Component) can call `getSettingsSearchNav()` directly - a "use
 * client" module's exports are all client references, so a Server Component
 * cannot invoke a plain function from one even if the function itself does
 * no client-only work.
 */
export const BACK_TO_OS_ITEM: SettingsNavItem = {
  id: "back-to-os",
  title: "Back to OS",
  url: "/os",
  icon: ArrowLeft,
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "organisation",
    title: "Organisation",
    url: "/settings/organisation",
    icon: Building2,
  },
  { id: "users", title: "Users", url: "/settings/users", icon: Users },
  {
    id: "permissions",
    title: "Roles and Permissions",
    url: "/settings/permissions",
    icon: Shield,
  },
  {
    id: "connectors",
    title: "Connectors",
    url: "/settings/connectors",
    icon: Plug,
  },
  { id: "themes", title: "Themes", url: "/settings/themes", icon: Palette },
  { id: "logs", title: "Logs", url: "/settings/logs", icon: Server },
];

/** The same fixed nav above, reshaped into `SidebarNavGroupData[]` -
 * `SearchDialog`'s own prop shape (built for the `/os` sidebar's
 * database-driven nav, string icon names via `resolveNavIcon`) - so
 * `settings/layout.tsx` (a Server Component) can drop the same search
 * dialog into its own header instead of a plain "Settings" label, without a
 * second, independently-maintained nav list to keep in sync with the one
 * above. */
export function getSettingsSearchNav(): SidebarNavGroupData[] {
  return [
    {
      id: "settings",
      label: "Settings",
      items: [BACK_TO_OS_ITEM, ...SETTINGS_NAV_ITEMS].map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        icon: iconName(item.icon),
      })),
    },
  ];
}
