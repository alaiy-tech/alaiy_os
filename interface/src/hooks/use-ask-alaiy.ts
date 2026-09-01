"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  createChatSession, deleteChatSession, deleteChatAttachment, getChatMessages, listChatSessions,
  listChatSkills, sendChatMessage, streamMessagesUrl, uploadChatAttachment,
  type ChatAttachmentMeta, type ChatMention, type ChatMessage, type ChatSessionSummary,
  type ChatSkill, type ChatStatus, type ChatToolCall, FrappeError,
} from "@/lib/frappe/chat";

const SESSION_KEY = "ask-alaiy-active-session";

export const MAX_ATTACHMENTS = 5;

/** Per-tab, not per-browser: switching away and back to the same tab must
 * never lose the conversation, but a brand-new tab shouldn't inherit
 * someone else's open thread either. */
function readSavedSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSession(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* no-op */
  }
}

export interface ThreadTurn {
  key: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: ChatToolCall[];
  toolErrors: Set<string>;
  attachments: ChatAttachmentMeta[];
  skill: string | null;
  mentions: ChatMention[];
  /** Still being written: text grows with every SSE event, tool_calls empty
   * until it settles. Drives the caret and suppresses anything wrong to show
   * mid-answer. */
  partial: boolean;
}

/**
 * A multi-step tool-using reply isn't one growing OS Chat Message row --
 * the server writes a separate, individually-settling message per tool
 * call (each arrives with its own populated tool_calls the moment it's
 * done) and only the final text lands on a message of its own. Left
 * ungrouped, that's one avatar+bubble per step instead of one continuous
 * reply with a combined tool trail. Both surfaces (the drawer panel and
 * the /os/ask-alaiy page) call this on their own visibleTurns so they
 * render identically.
 */
export function groupAssistantTurns(turns: ThreadTurn[]): ThreadTurn[] {
  const grouped: ThreadTurn[] = [];
  for (const turn of turns) {
    const prev = grouped[grouped.length - 1];
    if (turn.role === "assistant" && prev?.role === "assistant") {
      grouped[grouped.length - 1] = {
        ...prev,
        text: turn.text || prev.text,
        toolCalls: [...prev.toolCalls, ...turn.toolCalls],
        toolErrors: new Set([...prev.toolErrors, ...turn.toolErrors]),
        attachments: [...prev.attachments, ...turn.attachments],
        partial: turn.partial,
      };
    } else {
      grouped.push(turn);
    }
  }
  return grouped;
}

export interface PendingAttachment {
  localId: string;
  file_name: string;
  file_size: number;
  status: "uploading" | "ready" | "error";
  name?: string;
  file_url?: string;
  chars?: number;
  error?: string;
}

/**
 * Owns one Ask Alaiy conversation: session lifecycle, the message thread,
 * and the SSE subscription that follows a turn while a background worker
 * answers it. Mirrors the desk's own ask_alaiy.js state machine (see
 * alaiy_os/chat/CHAT.md) so every surface behaves identically against the
 * same API.
 */
export function useAskAlaiy() {
  const pathname = usePathname();
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    saveSession(id);
  }, []);
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [running, setRunning] = useState(false);
  // Follow-up questions to offer under the newest answer. Lives here rather
  // than in a panel because there is exactly one useAskAlaiy() for the whole
  // /os tree (see ask-alaiy-provider.tsx) -- the drawer and the full page have
  // to agree about what is on offer.
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [skills, setSkills] = useState<ChatSkill[] | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const lastSeq = useRef(0);
  const eventSource = useRef<EventSource | null>(null);
  const activeSession = useRef<string | null>(null);
  const uploadSeq = useRef(0);
  const skillsPromise = useRef<Promise<ChatSkill[]> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const refreshSessions = useCallback(() => {
    setSessionsLoading(true);
    listChatSessions(50)
      .then(setSessions)
      .catch(() => undefined)
      .finally(() => setSessionsLoading(false));
  }, []);

  const stopStream = useCallback(() => {
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const absorbMessage = useCallback((message: ChatMessage) => {
    if (!message.partial) lastSeq.current = message.seq;

    const upsert = (turn: ThreadTurn) =>
      setTurns((prev) => {
        const at = prev.findIndex((t) => t.key === turn.key);
        if (at === -1) return [...prev, turn];
        const next = prev.slice();
        next[at] = turn;
        return next;
      });

    if (message.role === "user") {
      const files = message.attachments ?? [];
      if (message.text || files.length) {
        upsert({
          key: message.name, role: "user", text: message.text,
          toolCalls: [], toolErrors: new Set(),
          attachments: files, skill: message.skill ?? null,
          mentions: message.mentions ?? [],
          partial: false,
        });
      }
      return;
    }

    const produced = message.attachments ?? [];
    if (!message.text && message.tool_calls.length === 0 && !produced.length && !message.partial) {
      return;
    }

    upsert({
      key: message.name,
      role: "assistant",
      text: message.text,
      toolCalls: message.tool_calls,
      toolErrors: new Set(message.tool_errors),
      attachments: produced,
      skill: null,
      mentions: [],
      partial: message.partial,
    });
  }, []);

  // The one call that carries follow-ups: the server writes them just before
  // the session leaves Running, and this is the first read after that. They
  // ride the terminal payload rather than a message row because the client's
  // cursor is already past the answer they belong to.
  const settle = useCallback(
    (status: ChatStatus, error: string | null | undefined, suggestions: string[] | undefined) => {
      setRunning(false);
      setFollowUps(suggestions ?? []);
      if (status === "Failed") {
        const lines = (error ?? "").trim().split("\n");
        setError(lines[lines.length - 1] || "The assistant failed to reply.");
      }
      refreshSessions();
    },
    [refreshSessions],
  );

  const startStream = useCallback(
    (session: string) => {
      stopStream();
      const es = new EventSource(streamMessagesUrl(session, lastSeq.current));
      eventSource.current = es;

      es.onmessage = (e) => {
        if (activeSession.current !== session) return;
        absorbMessage(JSON.parse(e.data) as ChatMessage);
      };

      es.addEventListener("done", (e) => {
        if (activeSession.current !== session) return;
        stopStream();
        const data = JSON.parse((e as MessageEvent<string>).data) as {
          status: ChatStatus | "timeout";
          error?: string | null;
          suggestions?: string[];
        };

        // The server's own wall-clock cap tripped, not a real end of turn --
        // just resume from wherever the cursor landed.
        if (data.status === "timeout") {
          startStream(session);
          return;
        }

        settle(data.status, data.error, data.suggestions);
      });

      // A dropped connection (a network blip, a laptop waking from sleep)
      // rather than a clean `done`. EventSource would otherwise retry the
      // exact same stream on its own after a fixed delay; catching up once
      // over plain JSON first means the UI doesn't sit frozen for that
      // delay, and confirms the turn is still actually running before
      // reopening the stream at all.
      es.onerror = () => {
        if (activeSession.current !== session) return;
        stopStream();
        getChatMessages({ session, after: lastSeq.current, partial: 1 })
          .then((data) => {
            if (activeSession.current !== session) return;
            data.messages.forEach(absorbMessage);
            if (data.status === "Running") {
              startStream(session);
              return;
            }
            settle(data.status, data.error, data.suggestions);
          })
          .catch((err) => {
            if (activeSession.current !== session) return;
            setRunning(false);
            setError(err instanceof FrappeError ? err.message : "Lost contact with the assistant.");
          });
      };
    },
    [absorbMessage, settle, stopStream],
  );

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) {
      activeSession.current = sessionId;
      return sessionId;
    }
    const created = await createChatSession();
    setSessionId(created.session);
    activeSession.current = created.session;
    return created.session;
  }, [sessionId, setSessionId]);

  const send = useCallback(
    async (text: string, opts?: { skill?: string; mentions?: ChatMention[] }) => {
      const trimmed = text.trim();
      const ready = pending.filter((a) => a.status === "ready" && a.name);
      if ((!trimmed && !ready.length) || running) return;

      setError(null);
      const displayAttachments: ChatAttachmentMeta[] = ready.map((a) => ({
        file_name: a.file_name,
        file_url: a.file_url ?? null,
        file_size: a.file_size,
        chars: a.chars ?? 0,
      }));
      const mentions = opts?.mentions ?? [];
      setTurns((prev) => [
        ...prev,
        {
          key: `local-${prev.length}-${(trimmed || ready[0]?.file_name || "").slice(0, 8)}`,
          role: "user",
          text: trimmed,
          toolCalls: [],
          toolErrors: new Set(),
          attachments: displayAttachments,
          skill: opts?.skill ?? null,
          mentions,
          partial: false,
        },
      ]);
      setPending([]);
      setRunning(true);
      // They belonged to the answer above; a question is now on its way past it.
      setFollowUps([]);

      try {
        const session = await ensureSession();
        const sent = await sendChatMessage({
          session,
          text: trimmed || undefined,
          attachments: ready.map((a) => a.name!),
          skill: opts?.skill,
          screen: pathnameRef.current,
          mentions: mentions.map((m) => ({ kind: m.kind, value: m.value })),
        });
        lastSeq.current = sent.seq;
        startStream(session);
      } catch (e) {
        setRunning(false);
        setError(e instanceof FrappeError ? e.message : "Could not send the message.");
      }
    },
    [pending, running, ensureSession, startStream],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const picked = Array.from(files);
      if (!picked.length || running) return;

      const room = MAX_ATTACHMENTS - pending.length;
      if (room <= 0) return;

      let session: string;
      try {
        session = await ensureSession();
      } catch (e) {
        setError(e instanceof FrappeError ? e.message : "Could not start a chat for this file.");
        return;
      }

      picked.slice(0, room).forEach((file) => {
        const localId = `up-${++uploadSeq.current}`;
        setPending((p) => [...p, { localId, file_name: file.name, file_size: file.size, status: "uploading" }]);

        uploadChatAttachment(session, file)
          .then((result) => {
            if (activeSession.current !== session) return;
            setPending((p) => p.map((a) => (a.localId === localId
              ? { ...a, status: "ready", name: result.name, file_url: result.file_url, chars: result.chars }
              : a)));
          })
          .catch((e) => {
            if (activeSession.current !== session) return;
            setPending((p) => p.map((a) => (a.localId === localId
              ? { ...a, status: "error", error: e instanceof FrappeError ? e.message : "Upload failed." }
              : a)));
          });
      });
    },
    [running, pending.length, ensureSession],
  );

  const removeAttachment = useCallback((localId: string) => {
    setPending((p) => {
      const entry = p.find((a) => a.localId === localId);
      if (entry?.name) void deleteChatAttachment(entry.name).catch(() => undefined);
      return p.filter((a) => a.localId !== localId);
    });
  }, []);

  const ensureSkillsLoaded = useCallback(async (): Promise<ChatSkill[]> => {
    if (skills !== null) return skills;
    if (!skillsPromise.current) {
      skillsPromise.current = listChatSkills().catch(() => []);
    }
    const result = await skillsPromise.current;
    setSkills(result);
    return result;
  }, [skills]);

  const load = useCallback(
    async (name: string) => {
      if (sessionId === name) return;
      stopStream();
      activeSession.current = name;
      setSessionId(name);
      setTurns([]);
      lastSeq.current = 0;
      setError(null);
      setRunning(false);
      setPending([]);
      setFollowUps([]);

      try {
        const data = await getChatMessages({ session: name, after: 0, partial: 1 });
        if (activeSession.current !== name) return;

        data.messages.forEach(absorbMessage);
        // Stored on the message server-side, so a chat reopened from the
        // history comes back with the follow-ups it ended on rather than a dead
        // end. A session still Running is served none, so this needs no guard.
        setFollowUps(data.suggestions ?? []);

        if (data.status === "Running") {
          setRunning(true);
          startStream(name);
        }
      } catch (e) {
        if (e instanceof FrappeError && e.httpStatus === 404) {
          // The session this tab remembered no longer exists server-side
          // (deleted, or a reseeded dev database) -- drop back to a clean
          // chat instead of reopening the same dead session on every visit.
          if (activeSession.current === name) activeSession.current = null;
          setSessionId(null);
          setTurns([]);
          lastSeq.current = 0;
          setRunning(false);
          setFollowUps([]);
          return;
        }
        setError(e instanceof FrappeError ? e.message : "Could not open that chat.");
      }
    },
    [sessionId, absorbMessage, startStream, stopStream, setSessionId],
  );

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = readSavedSession();
    if (saved) void load(saved);
  }, [load]);

  const newChat = useCallback(() => {
    stopStream();
    activeSession.current = null;
    setSessionId(null);
    setTurns([]);
    lastSeq.current = 0;
    setRunning(false);
    setError(null);
    setPending([]);
    setFollowUps([]);
  }, [stopStream]);

  const remove = useCallback(
    async (name: string) => {
      await deleteChatSession(name);
      if (sessionId === name) newChat();
      refreshSessions();
    },
    [sessionId, newChat, refreshSessions],
  );

  return {
    sessionId, turns, running, error, followUps,
    sessions, sessionsLoading,
    send, load, newChat, remove, refreshSessions,
    attachments: pending, uploadFiles, removeAttachment,
    skills, ensureSkillsLoaded,
  };
}
