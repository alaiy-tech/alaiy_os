"use client";

import { useState } from "react";

import { AskAlaiyBackground } from "./ask-alaiy-background";
import { AskAlaiyChat } from "./ask-alaiy-chat";
import { ChatHistorySidebar } from "./chat-history-sidebar";

export function AskAlaiyView({ userName }: { readonly userName: string }) {
  const [chatKey, setChatKey] = useState(0);

  return (
    <div className="relative isolate flex h-full gap-4 overflow-hidden">
      <AskAlaiyBackground />
      <ChatHistorySidebar onNewChat={() => setChatKey((key) => key + 1)} />
      <div className="relative min-w-0 flex-1">
        <AskAlaiyChat key={chatKey} userName={userName} />
      </div>
    </div>
  );
}
