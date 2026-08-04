import { Bell, HelpCircle, LogOut, RefreshCw, Search } from "lucide-react";
import { useFrappeAuth } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

const NOTIFICATIONS = [
  { title: "SAL-ORD-2026-04412 blocked on stock shortfall", meta: "Sales Order · 12 min ago", tone: "bg-danger-fg" },
  { title: "Nordic Oak Dining Table fell below reorder level", meta: "Item · 48 min ago", tone: "bg-[#D9A94C]" },
  { title: "Price List “Wholesale INR” updated by Arun N.", meta: "Price List · 2 h ago", tone: "bg-blue" },
];

function initialsFrom(value: string) {
  const [name] = value.split("@");
  return name.slice(0, 2).toUpperCase();
}

export default function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { currentUser, logout } = useFrappeAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-faint bg-background px-[18px]">
      <SidebarTrigger className="text-ink" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-[34px] w-[340px] items-center gap-2 rounded-md border border-line px-[10px] text-[13px] text-ash transition-colors hover:border-line-hover"
      >
        <Search className="size-[15px] text-ash-2" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="rounded-[4px] border border-line bg-surface-subtle px-[5px] py-[2px] font-sans text-[10.5px] font-medium tracking-[.04em] text-ash">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative flex size-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-paper"
          >
            <Bell className="size-[17px]" />
            <span className="absolute top-[7px] right-2 size-[6px] rounded-full bg-danger-fg ring-2 ring-background" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line-faint px-[14px] py-3">
            <span className="text-[13px] font-semibold tracking-[-.01em] text-ink">Notifications</span>
            <span className="text-[11.5px] text-slate">{NOTIFICATIONS.length} new</span>
          </div>
          {NOTIFICATIONS.map((n) => (
            <div key={n.title} className="flex gap-2.5 border-b border-line-faint px-[14px] py-[11px] hover:bg-surface-faint">
              <span className={cn("mt-[5px] size-[7px] flex-none rounded-full", n.tone)} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] leading-[1.4] font-medium text-ink">{n.title}</div>
                <div className="mt-0.5 text-[11.5px] text-ash">{n.meta}</div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="w-full py-[9px] text-center text-[12px] font-medium text-navy hover:bg-surface-faint"
          >
            View all notifications
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-0.5 h-[22px] w-px bg-line-faint" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex max-w-[210px] items-center gap-[9px] rounded-[9px] px-2 py-1 transition-colors hover:bg-paper">
            <Avatar className="size-[30px]">
              <AvatarFallback className="bg-navy text-[11.5px] font-semibold text-white">
                {currentUser ? initialsFrom(currentUser) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left leading-[1.3]">
              <div className="truncate text-[12.5px] font-medium text-ink">{currentUser}</div>
              <div className="truncate text-[11px] text-ash">User</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[214px]">
          <DropdownMenuLabel className="border-b border-line-faint pb-[9px]">
            <div className="truncate text-[12.5px] font-semibold tracking-[-.01em] text-ink">{currentUser}</div>
            <div className="mt-0.5 truncate text-[11.5px] font-normal text-ash">{currentUser}</div>
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => window.location.reload()} className="gap-2.5">
            <RefreshCw className="size-4 text-slate" />
            Reload
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5">
            <HelpCircle className="size-4 text-slate" />
            Help
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logout()} className="gap-2.5 font-medium text-danger-fg focus:bg-danger-bg focus:text-danger-fg">
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
