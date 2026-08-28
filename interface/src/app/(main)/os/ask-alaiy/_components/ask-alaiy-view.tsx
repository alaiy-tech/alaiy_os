"use client";

import { AskAlaiyBackground } from "./ask-alaiy-background";
import { AskAlaiyChat } from "./ask-alaiy-chat";
import { ChatHistorySidebar } from "./chat-history-sidebar";

export function AskAlaiyView({ userName }: { readonly userName: string }) {
  return (
    // items-start matters: without it, flex's default align-items:stretch
    // makes the sidebar's own box exactly as tall as the (very long) chat
    // column next to it. A sticky element stretched to already span the
    // whole scroll range has nothing left to visibly "stick" to -- it just
    // scrolls with the page as if position:sticky weren't set at all.
    <div className="relative isolate flex items-start gap-4">
      <AskAlaiyBackground />
      <ChatHistorySidebar />
      <div className="relative min-w-0 flex-1">
        <AskAlaiyChat userName={userName} />
      </div>
    </div>
  );
}
