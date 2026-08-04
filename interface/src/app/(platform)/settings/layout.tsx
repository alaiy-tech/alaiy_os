import type { ReactNode } from "react";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SettingsSidebar } from "@/components/layout/sidebar/settings-sidebar";
import { Separator } from "@/components/primitive/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/primitive/sidebar";
import { getServerUser } from "@/lib/frappe/server";
import { cn } from "@/utils";
import { getPreference } from "@/server/server-actions";

import UserMenu from "../../../components/derived/menu/user-menu";
import { NotificationsPopover } from "../../../components/derived/popover/notifications-popover";

/**
 * Mirrors `os/layout.tsx`'s shape (same auth check, same
 * SidebarProvider/SidebarInset/header shell) but mounts the fixed,
 * code-owned `SettingsSidebar` instead of the database-driven `AppSidebar` -
 * per the brief, the Settings sidebar is a baseline UI layout thing, so its
 * config stays in code rather than the sidebar database.
 */
export default async function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible, user] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
    getServerUser(),
  ]);

  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/settings";
    redirect(`/auth/expired?next=${encodeURIComponent(pathname)}`);
  }

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
        } as React.CSSProperties
      }
    >
      <SettingsSidebar variant={variant} collapsible={collapsible} />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-clip",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <span className="font-medium text-muted-foreground text-sm">
                Settings
              </span>
            </div>
            <div className="flex items-center gap-4">
              <NotificationsPopover />
              <UserMenu />
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-clip p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
