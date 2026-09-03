"use client";

import { AttachmentPreviewPane, useAttachmentPreview } from "@/components/ask-alaiy/attachment-preview";

import { AskAlaiyBackground } from "./ask-alaiy-background";
import { AskAlaiyChat } from "./ask-alaiy-chat";
import { ChatHistorySidebar } from "./chat-history-sidebar";

export function AskAlaiyView({ userName }: { readonly userName: string }) {
  const fileOpen = Boolean(useAttachmentPreview()?.file);

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
      {/* Sticky and viewport-tall, exactly like the history sidebar opposite
          it: the page keeps its single scroll, the file stays put while the
          conversation scrolls past, and both stay live -- no overlay, no
          backdrop, composer still reachable. */}
      {fileOpen && <AttachmentPreviewPane className="sticky top-4 h-[calc(100svh-2rem)] w-[clamp(22rem,34vw,44rem)]" />}
    </div>
  );
}
