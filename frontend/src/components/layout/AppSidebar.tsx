import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeft, Settings as SettingsIcon } from "lucide-react";

import { navigationConfig, settingsItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoSquare from "@/assets/logo-square.png";
import logoHorizontal from "@/assets/logo-hor.png";

function toHref(path: string) {
  return path ? `/${path}` : "/";
}

function isItemActive(pathname: string, path: string) {
  const href = toHref(path);
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/** One accordion-style nav section - collapsible independently of the whole sidebar's icon-rail state. */
function NavSectionGroup({ section }: { section: (typeof navigationConfig)[number] }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const { state } = useSidebar();
  const SectionIcon = section.icon;
  const collapsedRail = state === "collapsed";

  return (
    <SidebarGroup className="p-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-1.5 rounded-md", collapsedRail ? "justify-center py-2" : "px-2 py-[5px] pt-[9px]")}
      >
        <SidebarGroupLabel className="h-auto flex-1 justify-start p-0 text-left text-[10.5px] font-semibold tracking-[.1em] text-ash-3 uppercase group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:mt-0">
          {collapsedRail ? <SectionIcon className="size-[17px] text-ash-3" /> : section.label}
        </SidebarGroupLabel>
        {!collapsedRail && (
          <ChevronDown className={cn("size-[13px] text-ash-3 transition-transform duration-150", !open && "-rotate-90")} />
        )}
      </button>
      {(open || collapsedRail) && (
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(location.pathname, item.path);
              return (
                <SidebarMenuItem key={item.label + item.path}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link to={toHref(item.path)}>
                      <Icon className="size-4" />
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={cn(
                            "flex-none rounded-full px-[6px] py-px text-[10.5px] font-semibold tabular-nums group-data-[collapsible=icon]:hidden",
                            active ? "bg-white/[.18] text-white" : "bg-blue text-navy",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export default function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const settingsActive = isItemActive(location.pathname, settingsItem.path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-0">
        <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "px-3.5")}>
          {collapsed ? (
            <img src={logoSquare} alt="Alaiy OS" className="size-[26px] object-contain" />
          ) : (
            <img src={logoHorizontal} alt="Alaiy OS" className="h-5 w-auto object-contain" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        {navigationConfig.map((section) => (
          <NavSectionGroup key={section.label} section={section} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-1 border-t border-sidebar-border p-2">
        <SidebarMenuButton asChild isActive={settingsActive} tooltip="Settings">
          <Link to={toHref(settingsItem.path)}>
            <SettingsIcon className="size-4" />
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-data-[collapsible=icon]:hidden">Settings</span>
          </Link>
        </SidebarMenuButton>
        <button
          type="button"
          onClick={toggleSidebar}
          title="Collapse sidebar"
          className={cn(
            "flex w-full items-center gap-[9px] rounded-md text-[12.5px] font-medium text-ash transition-colors hover:bg-sidebar-accent",
            collapsed ? "justify-center py-2" : "px-[9px] py-2",
          )}
        >
          <PanelLeft className="size-4" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
