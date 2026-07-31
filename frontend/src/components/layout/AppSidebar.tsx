import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { navigationConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
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
  const sectionIsCollapsedRail = state === "collapsed";

  return (
    <SidebarGroup>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1"
      >
        <SidebarGroupLabel className="p-0">
          {sectionIsCollapsedRail ? <SectionIcon className="size-4" /> : section.label}
        </SidebarGroupLabel>
        {!sectionIsCollapsedRail && (
          <ChevronDown className={cn("size-3.5 text-sidebar-foreground/50 transition-transform", !open && "-rotate-90")} />
        )}
      </button>
      {(open || sectionIsCollapsedRail) && (
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(location.pathname, item.path);
              return (
                <SidebarMenuItem key={item.label + item.path}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link to={toHref(item.path)}>
                      <Icon />
                      <span>{item.label}</span>
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center px-2">
          {collapsed ? (
            <img src={logoSquare} alt="Alaiy OS" className="size-7 rounded-md object-contain" />
          ) : (
            <img src={logoHorizontal} alt="Alaiy OS" className="h-6 w-auto object-contain" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigationConfig.map((section) => (
          <NavSectionGroup key={section.label} section={section} />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
