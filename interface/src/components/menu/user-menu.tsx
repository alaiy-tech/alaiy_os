"use client";

import { Info, LogOut, RotateCw } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/stores/auth/auth-provider";

const HELP_URL = "https://os.alaiy.com";

export default function UserMenu({
  creditsLeft = 5,
  creditsTotal = 20,
}: {
  readonly creditsLeft?: number;
  readonly creditsTotal?: number;
}) {
  const { user, logout } = useAuth();
  const creditsUsed = Math.max(creditsTotal - creditsLeft, 0);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 cursor-pointer rounded-lg">
          <AvatarImage src={user.avatar || undefined} alt={user.fullName} />
          <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-52 space-y-1 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.fullName} />
              <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-semibold">{user.fullName}</span>
              <span className="truncate text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.reload()}>
          <RotateCw />
          Reload
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={HELP_URL} target="_blank" rel="noopener noreferrer">
            <Info />
            Help
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="rounded-lg bg-muted/60 px-2.5 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">AI Credits</span>
            <span className="text-muted-foreground">{creditsLeft} left</span>
          </div>
          <Progress
            value={(creditsUsed / creditsTotal) * 100}
            className="mt-2 h-1.5"
          />
          <Button
            variant="default"
            size="sm"
            className="mt-2 w-full justify-center"
          >
            Top up credits
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
