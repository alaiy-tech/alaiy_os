"use client";

import { useState } from "react";

import {
  Compass,
  History,
  Library,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface ChatHistoryGroup {
  readonly label: string;
  readonly chats: readonly string[];
}

const CHAT_HISTORY: readonly ChatHistoryGroup[] = [
  {
    label: "Today",
    chats: [
      "What's something you've learned recently?",
      "Best travel experience",
      "Favorite book",
    ],
  },
  {
    label: "Yesterday",
    chats: ["If you could teleport anywhere, where would you go?"],
  },
  {
    label: "7 Days Ago",
    chats: [
      "What's one goal you want to achieve this year?",
      "Favorite programming language",
    ],
  },
];

export function ChatHistorySidebar({
  onNewChat,
}: {
  readonly onNewChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const filteredGroups = CHAT_HISTORY.map((group) => ({
    ...group,
    chats: group.chats.filter((chat) =>
      chat.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((group) => group.chats.length > 0);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col gap-4 border-r bg-background pr-4">
      <InputGroup className="h-8">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search chats..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </InputGroup>
      <Button type="button" onClick={onNewChat} className="w-full rounded-xl">
        <Plus data-icon="inline-start" />
        New Chat
      </Button>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-2 font-medium text-muted-foreground text-xs">
              {group.label}
            </p>
            {group.chats.map((chat) => (
              <button
                key={chat}
                type="button"
                onClick={() => setActiveChat(chat)}
                className={cn(
                  "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  activeChat === chat && "bg-accent",
                )}
              >
                {chat}
              </button>
            ))}
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <p className="px-2 text-muted-foreground text-sm">No chats found.</p>
        )}
      </div>
    </div>
  );
}
