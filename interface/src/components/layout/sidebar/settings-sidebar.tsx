"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { BACK_TO_OS_ITEM, SETTINGS_NAV_ITEMS } from "./settings-nav-items";

export function SettingsSidebar({
  squareLogoSrc = "/assets/images/client-logo-square.png",
  horizontalLogoSrc = "/assets/images/client-logo-hor.png",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  /** The org's uploaded logo, resolved server-side by `settings/layout.tsx`
   * via `lib/frappe/server.ts`'s `getOrganisationLogoSrc()` - mirrors
   * `AppSidebar`'s own props. */
  squareLogoSrc?: string;
  horizontalLogoSrc?: string;
}) {
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
                  src={horizontalLogoSrc}
                  alt={APP_CONFIG.name}
                  width={175 / 2}
                  height={35 / 2}
                  unoptimized={horizontalLogoSrc.startsWith("/frappe-assets/")}
                  className="group-data-[collapsible=icon]:hidden"
                />
                <Image
                  src={squareLogoSrc}
                  alt={APP_CONFIG.name}
                  width={32}
                  height={32}
                  unoptimized={squareLogoSrc.startsWith("/frappe-assets/")}
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={BACK_TO_OS_ITEM.title}>
                  <Link href={BACK_TO_OS_ITEM.url}>
                    <BACK_TO_OS_ITEM.icon />
                    <span>{BACK_TO_OS_ITEM.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.url);
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
