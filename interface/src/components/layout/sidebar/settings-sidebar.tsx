"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowLeft, Building2, type LucideIcon, Palette, Plug, Server, Shield, Users } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/primitive/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { usePreferencesStore } from "@/runtime/store/preferences/preferences-provider";

import { NavUser } from "../../derived/menu/nav-user-menu";

type SettingsNavItem = {
  id: string;
  title: string;
  url: string;
  icon: LucideIcon;
};

/**
 * The Settings sidebar's items are a fixed, baseline UI layout - unlike the
 * `/os/*` sidebar (database-driven, see `runtime/store/sqlite-sidebar-store.ts`),
 * this list is meant to stay in code. Renders as a distinct sidebar from
 * `AppSidebar`, mounted by `app/(main)/settings/layout.tsx` instead of
 * `os/layout.tsx`.
 */
const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "back-to-os",
    title: "Back to OS",
    url: "/os",
    icon: ArrowLeft,
  },
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

export function SettingsSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  // Same sync as `AppSidebar`: the store starts from `props` (the SSR-read
  // preference values `settings/layout.tsx` passes down, mirroring
  // `os/layout.tsx`) until the client-side preferences store hydrates, at
  // which point its own value wins - so this sidebar reflects the same
  // `/settings/themes` Sidebar Style/Collapse Mode settings `AppSidebar`
  // already does, instead of silently falling back to `<Sidebar>`'s own
  // hardcoded defaults.
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );
  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-fit group-data-[collapsible=icon]:p-0!">
              <Link prefetch={false} href="/settings">
                <Image
                  src="/assets/images/client-logo-hor.png"
                  alt={APP_CONFIG.name}
                  width={175 / 2}
                  height={35 / 2}
                  className="group-data-[collapsible=icon]:hidden"
                />
                <Image
                  src="/assets/images/client-logo-square.png"
                  alt={APP_CONFIG.name}
                  width={32}
                  height={32}
                  className="hidden size-8 group-data-[collapsible=icon]:block"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV_ITEMS.map((item) => {
                const isActive = item.url === "/os" ? false : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
