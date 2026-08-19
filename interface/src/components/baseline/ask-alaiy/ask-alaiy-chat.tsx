"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowUp, Mic, Paperclip, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/primitive/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/primitive/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitive/select";
import { cn } from "@/lib/utils";

interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

const PROMPT_IDEAS = [
  "Summarize this month's sales performance...",
  "Which products are running low on stock?",
  "Draft a follow-up email to a supplier...",
  "Compare revenue across regions this quarter...",
  "Find customers who haven't ordered in 60 days...",
];

const MODELS = ["Claude 3.5 Sonnet", "Claude 3.5 Haiku", "Claude 3 Opus"];

const TYPE_SPEED_MS = 35;
const DELETE_SPEED_MS = 18;
const HOLD_MS = 1600;
const PAUSE_MS = 400;

function useTypewriter(phrases: readonly string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: number;

    function tick() {
      const phrase = phrases[phraseIndex];

      if (!deleting) {
        charIndex++;
        setText(phrase.slice(0, charIndex));
        if (charIndex === phrase.length) {
          deleting = true;
          timeoutId = window.setTimeout(tick, HOLD_MS);
          return;
        }
        timeoutId = window.setTimeout(tick, TYPE_SPEED_MS);
      } else {
        charIndex--;
        setText(phrase.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeoutId = window.setTimeout(tick, PAUSE_MS);
          return;
        }
        timeoutId = window.setTimeout(tick, DELETE_SPEED_MS);
      }
    }

    timeoutId = window.setTimeout(tick, TYPE_SPEED_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phrases]);

  return text;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function createId() {
  return Math.random().toString(36).slice(2);
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
      <Sparkles className="size-3.5 text-muted-foreground" />
    </div>
  );
}

export function AskAlaiyChat({ userName }: { readonly userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typewriterText = useTypewriter(PROMPT_IDEAS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on new messages/thinking state to scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isThinking]);

  const hasMessages = messages.length > 0;

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: trimmed },
    ]);
    setInput("");
    setIsThinking(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content:
            "This is a preview response from Ask Alaiy. Connect a model backend to replace this with real answers.",
        },
      ]);
      setIsThinking(false);
    }, 900);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
    setIsThinking(false);
  }

  const placeholder = hasMessages
    ? "Message Ask Alaiy..."
    : typewriterText || "Ask Alaiy anything...";

  const composer = (
    <form onSubmit={handleSubmit} className="w-full">
      <InputGroup className="h-auto flex-col rounded-2xl bg-background p-1.5 shadow-sm">
        <InputGroupTextarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-11 px-2.5 py-2"
          rows={1}
        />
        <InputGroupAddon
          align="block-end"
          className="justify-between px-1 pb-1"
        >
          <div className="flex items-center gap-1">
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach file"
            >
              <Paperclip />
            </InputGroupButton>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger
                size="sm"
                className="h-7 border-none bg-transparent px-2 shadow-none hover:bg-muted"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {MODELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Voice input"
            >
              <Mic />
            </InputGroupButton>
            <Button
              type="submit"
              size="icon-sm"
              className="rounded-full"
              disabled={isThinking}
              aria-label="Send message"
            >
              <ArrowUp />
            </Button>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );

  if (!hasMessages) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-semibold text-4xl tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-3xl tracking-tight">
            How Can I <span className="text-primary">Assist You Today?</span>
          </p>
        </div>

        <div className="w-full max-w-2xl">{composer}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="flex items-center justify-between border-b px-1 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium">Ask Alaiy</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startNewChat}
        >
          <Plus data-icon="inline-start" />
          New chat
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {message.role === "assistant" && <AssistantAvatar />}
            <div
              className={cn(
                "max-w-xl text-sm leading-relaxed",
                message.role === "user"
                  ? "rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground"
                  : "text-foreground",
              )}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-3">
            <AssistantAvatar />
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="pb-2">{composer}</div>
    </div>
  );
}
