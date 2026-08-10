"use client";

import { useState } from "react";

import { Bell, Check } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, getInitials } from "@/lib/utils";

interface NotificationItem {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly time: string;
  readonly read: boolean;
}

const initialNotifications: NotificationItem[] = [
  {
    id: "1",
    name: "Alaiy",
    title: "Your order is placed",
    description: "Amet minim mollit non deserunt ullamco est sit aliqua.",
    time: "2 days ago",
    read: true,
  },
  {
    id: "2",
    name: "Darlene Robertson",
    title: "Congratulations Darlene 🎉",
    description: "Won the monthly best seller badge.",
    time: "11:00 AM",
    read: false,
  },
  {
    id: "3",
    name: "Joaquina Weisenborn",
    title: "Joaquina Weisenborn",
    description: "Requesting access permission.",
    time: "12:00 PM",
    read: false,
  },
  {
    id: "4",
    name: "Brooklyn Simmons",
    title: "Brooklyn Simmons",
    description: "Added you to Top Secret Project.",
    time: "1:00 PM",
    read: false,
  },
];

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell />
          {unreadCount > 0 && <span className="absolute top-1 right-1 flex size-2 rounded-full bg-red-500" />}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">Notifications</p>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-primary text-xs hover:underline disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline"
          >
            Mark all as read
          </button>
        </div>

        <div className="-mx-1 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "group flex items-start gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors",
                !notification.read && "bg-accent/40",
              )}
            >
              <Avatar size="sm" className="mt-0.5">
                <AvatarFallback>{getInitials(notification.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-medium text-sm leading-tight">{notification.title}</p>
                <p className="truncate text-muted-foreground text-xs">{notification.description}</p>
                <p className="text-[11px] text-muted-foreground">{notification.time}</p>
              </div>
              {!notification.read ? (
                <button
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  aria-label="Mark as read"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Check className="size-3.5" />
                </button>
              ) : (
                <span className="mt-1.5 size-2 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
