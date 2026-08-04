"use client";

import { useMemo } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Settings } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/primitive/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { resolveNavIcon } from "@/config/nav-icons";
import { usePreferencesStore } from "@/runtime/store/preferences/preferences-provider";
import type { NavGroup, NavMainItem, SidebarNavGroupData, SidebarNavItemData } from "@/types/navigation";

import { NavUser } from "../../derived/menu/nav-user-menu";
import { NavMain } from "../nav-main";

/**
 * Resolves the plain-data icon-name strings the server sent down
 * (`runtime/store/sqlite-sidebar-store.ts`) into real `LucideIcon`
 * components, entirely client-side - a component reference can't cross the
 * Server → Client boundary as a prop itself (see `config/nav-icons.ts`'s
 * doc comment). `NavMain` keeps its existing `NavGroup[]` contract
 * unchanged.
 */
function resolveNavMainItem(item: SidebarNavItemData): NavMainItem {
  if (item.subItems) {
    return {
      id: item.id,
      title: item.title,
      icon: resolveNavIcon(item.icon),
      badge: item.badge,
      disabled: item.disabled,
      newTab: item.newTab,
      subItems: item.subItems.map((sub) => ({
        id: sub.id,
        title: sub.title,
        url: sub.url ?? "#",
        icon: resolveNavIcon(sub.icon),
        badge: sub.badge,
        disabled: sub.disabled,
        newTab: sub.newTab,
      })),
    };
  }
  return {
    id: item.id,
    title: item.title,
    url: item.url ?? "#",
    icon: resolveNavIcon(item.icon),
    badge: item.badge,
    disabled: item.disabled,
    newTab: item.newTab,
  };
}

function resolveSidebarGroups(groups: readonly SidebarNavGroupData[]): NavGroup[] {
  return groups.map((group, index) => ({
    id: index,
    label: group.label,
    items: group.items.map(resolveNavMainItem),
  }));
}

export function AppSidebar({
  companyName,
  items,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  companyName?: string | null;
  items: SidebarNavGroupData[];
}) {
  const pathname = usePathname();
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;
  const resolvedItems = useMemo(() => resolveSidebarGroups(items), [items]);

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Collapsed to the 3rem icon rail, SidebarMenuButton forces
                size-8 and p-2, leaving 16px for content - far too little for a
                horizontal wordmark. Drop the padding and swap in the square
                mark instead. Both images are always in the markup and toggled
                with `hidden`, which is display:none, so the one that is not
                showing is also out of the accessibility tree. */}
            <SidebarMenuButton className="w-fit group-data-[collapsible=icon]:p-0!">
              <Link prefetch={false} href="/os">
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
        <NavMain items={resolvedItems} />
      </SidebarContent>
      <SidebarFooter>
        {/* A standalone baseline button, not a `sidebarNav`/`NavMain` group -
            "Settings" is app-wide chrome (like the logo above), not
            user/site page configuration, so it lives in code here rather
            than as a `source: 'code'` sidebar-store row. Sits directly
            above NavUser by default. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" isActive={pathname.startsWith("/settings")}>
              <Link prefetch={false} href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
