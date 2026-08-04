import { useState } from "react";
import { Outlet } from "react-router-dom";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AskPanelProvider } from "@/contexts/ask-panel-context";
import AppSidebar from "@/components/layout/AppSidebar";
import TopBar from "@/components/layout/TopBar";
import CommandPalette from "@/components/layout/CommandPalette";
import AskSlideOverPanel from "@/components/layout/AskSlideOverPanel";
import AskFloatingHandle from "@/components/layout/AskFloatingHandle";

export default function DashboardLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <AskPanelProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar onOpenSearch={() => setSearchOpen(true)} />
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        <AskSlideOverPanel />
        <AskFloatingHandle />
      </SidebarProvider>
    </AskPanelProvider>
  );
}
