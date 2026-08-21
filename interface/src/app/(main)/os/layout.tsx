import type { ReactNode } from "react";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCompanyInfo, getServerUser } from "@/lib/frappe/server";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";
import { CompanyProvider } from "@/stores/company/company-provider";

import UserMenu from "../../../components/menu/user-menu";
import { NotificationsPopover } from "../../../components/popover/notifications-popover";
import { SearchDialog } from "../../../components/menu/search-menu";

export default async function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible, user, company] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
    getServerUser(),
    getCompanyInfo(),
  ]);

  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/os";
    // Via /auth/expired rather than straight to the login page: getting here
    // means the request carried a `sid` that proxy.ts accepted (or it would have
    // been turned away before this rendered) and that Frappe then disowned.
    // Sending that cookie back to /auth/login lets proxy.ts bounce it to /os,
    // which renders, fails here the same way, and redirects again — a loop, with
    // every server fetch on the page 403ing on each lap. The route handler
    // clears the cookie first, so the two checks can no longer disagree.
    redirect(`/auth/expired?next=${encodeURIComponent(pathname)}`);
  }

  return (
    <CompanyProvider initialCompany={company}>
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant={variant}
        collapsible={collapsible}
        companyName={company?.name ?? null}
      />
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
            // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
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
              <SearchDialog />
            </div>
            <div className="flex items-center gap-4">
              <NotificationsPopover />
              <UserMenu />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        {/* overflow-x-clip, not overflow-x-hidden: `hidden` on one axis computes
            the other to `auto`, which makes this div a scroll container — and a
            scroll container that never scrolls (its height is always its
            content's) is the nearest scrollport for anything sticky inside it,
            so every `position: sticky` on every page silently did nothing.
            `clip` leaves the vertical axis `visible`, so sticky resolves against
            the page scroll instead, while still keeping a wide table from
            pushing the sidebar off screen. Same class the SidebarInset above
            already uses. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-clip p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </CompanyProvider>
  );
}
