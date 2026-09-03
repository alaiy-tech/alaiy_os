"use client";

import Image from "next/image";
import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { sidebarItems } from "@/config/sidebar-config";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "../menu/nav-user-menu";

export function AppSidebar({
  companyName,
  ...props
}: React.ComponentProps<typeof Sidebar> & { companyName?: string | null }) {
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
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
