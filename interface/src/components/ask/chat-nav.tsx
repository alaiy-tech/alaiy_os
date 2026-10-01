"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChatSessionSummary } from "@/lib/backend/types";

/**
 * Which chat is open, and the list of them — hoisted out of Home.
 *
 * The chat list used to live inside Home's own workspace, beside the
 * conversation. It is now a section of the left rail, which is rendered by the
 * layout — so the list, the conversation on /home and the docked Ask panel are
 * three surfaces in two different subtrees that have to agree on one answer.
 * This is that answer, held once above all of them.
 *
 * ## The key is the whole problem
 *
 * `Chat` resets by remounting: both call sites key it on the session, because
 * switching chats has to replace the transcript rather than append to it. That
 * makes the key load-bearing in a way that is easy to break — anything that
 * changes it mid-answer wipes the answer being written.
 *
 * Two things change it by accident:
 *
 * - **A refresh or a navigation.** Home with no `?chat=` opens the seller's
 *   *newest* chat, so "new chat" cannot be `router.push("/home")`: that
 *   reopens the one they are trying to leave. Nothing is created until a
 *   question is asked, so there is no id to navigate to — starting a chat is
 *   a client-side act, and it happens here.
 * - **The chat the conversation just created.** The new row goes to the front
 *   of the list, so anything deriving the open chat from "the newest one"
 *   moves onto it the instant it exists, and remounts the component that is
 *   streaming into it.
 *
 * So `key` and `id` are tracked separately. `sessionStarted` moves the id —
 * the next remount should land on the real chat — and freezes the key at
 * whatever the mounted conversation already has.
 *
 * Picking an existing chat *is* a navigation, because that one has an id worth
 * a URL: it survives a reload and can be reopened tomorrow. The remount it
 * causes is exactly right, because the transcript is being replaced.
 */

type ChatNav = {
  /** The chat list, newest first. */
  rows: ChatSessionSummary[];
  /** The chat to load, or null for one that has not been started. */
  openId: string | null;
  /** What to key `Chat` on. Not always `openId` — see above. */
  chatKey: string;
  /** Start an unstarted chat. Navigates only from off /home. */
  startNew: () => void;
  openChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  /** Told the id when a question creates a session. */
  sessionStarted: (id: string, title: string) => void;
  /** Mid-delete, so the row can be held disabled. */
  deleting: string | null;
};

const ChatNavContext = createContext<ChatNav | null>(null);

export function useChatNav(): ChatNav {
  const value = useContext(ChatNavContext);
  if (!value) throw new Error("useChatNav must be used inside <ChatNavProvider>");
  return value;
}

export function ChatNavProvider({
  initialRows,
  children,
}: {
  /** The seller's chats as the layout read them on the server. */
  initialRows: ChatSessionSummary[];
  children: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlChat = params.get("chat");

  const [rows, setRows] = useState(initialRows);
  const [deleting, setDeleting] = useState<string | null>(null);
  /**
   * Set by an explicit act — "New chat", picking a row, or a question creating
   * one. Null means the URL decides, which is what a fresh load wants.
   */
  const [chosen, setChosen] = useState<{ id: string | null; key: string } | null>(null);

  // A `?chat=` that is not theirs is not honoured: the poll would 403 on it
  // and the screen would sit empty. Falling back to their newest is both safe
  // and what someone following a stale link wants.
  const known = rows.some((row) => row.name === urlChat);
  const fromUrl = (known ? urlChat : rows[0]?.name) ?? null;

  const openId = chosen ? chosen.id : fromUrl;
  const chatKey = chosen ? chosen.key : (fromUrl ?? "new");

  // Read by `sessionStarted`, which must not take the key as a dependency: it
  // is handed to `Chat` as a prop, and a new identity on every poll of the
  // transcript would be churn for nothing. Written from an effect rather than
  // during render — a ref mutated mid-render is not a value React can be
  // trusted to have finished with.
  const keyRef = useRef(chatKey);
  useEffect(() => {
    keyRef.current = chatKey;
  }, [chatKey]);

  // Back and forward are the one way the URL moves without this provider
  // having moved it, and so the one case where the choice made in this tab
  // has to yield to it: the seller asked for the chat they were on before.
  //
  // A listener rather than an effect watching the search param, because the
  // param also changes when *we* navigate — `startNew` from `/home?chat=X`
  // pushes `/home`, and reacting to that would put X back on screen for the
  // frame between the choice and the navigation landing.
  useEffect(() => {
    const onPop = () => setChosen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const startNew = useCallback(() => {
    // A fresh key every time: starting a second new chat gives the same null
    // id as the first, and without this the first one's transcript would stay
    // on screen. The URL is left alone on purpose — clearing `?chat=` would
    // send the server looking for the newest chat, which is the one being
    // left.
    setChosen({ id: null, key: `new-${Date.now()}` });
    router.push("/home");
  }, [router]);

  const openChat = useCallback(
    (id: string) => {
      setChosen({ id, key: id });
      router.push(`/home?chat=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const sessionStarted = useCallback((id: string, title: string) => {
    setRows((current) =>
      current.some((row) => row.name === id)
        ? current
        : [
            {
              name: id,
              title,
              model: "",
              status: "Idle",
              last_activity: null,
              // The list shows a date, and this row is not from the backend.
              // Written in the browser's own calendar day rather than from
              // `toISOString`, which is UTC and would show yesterday for a
              // question asked late in the evening.
              modified: localDay(),
            },
            ...current,
          ],
    );
    // The id moves so a later remount lands on the real chat; the key does
    // not, because the conversation that created it is mounted under it and
    // is in the middle of writing the answer.
    setChosen((current) => ({ id, key: current?.key ?? keyRef.current }));
  }, []);

  const deleteChat = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        const response = await fetch(
          `/api/chat/sessions?session=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        if (!response.ok) return;
        setRows((current) => current.filter((row) => row.name !== id));
        // Only when they deleted the chat they were reading. Otherwise the
        // transcript on screen is untouched, and reloading it would be a
        // flicker for nothing.
        if (id === openId) {
          setChosen(null);
          router.push("/home");
        }
      } finally {
        setDeleting(null);
      }
    },
    [openId, router],
  );

  return (
    <ChatNavContext.Provider
      value={{ rows, openId, chatKey, startNew, openChat, deleteChat, sessionStarted, deleting }}
    >
      {children}
    </ChatNavContext.Provider>
  );
}

/** Today, as the naive "YYYY-MM-DD" the rest of the app's dates arrive in. */
function localDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
