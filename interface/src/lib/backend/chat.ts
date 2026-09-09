import "server-only";
import { backend } from "@/lib/backend/client";
import type {
  ChatFeed,
  ChatSession,
  ChatSessionSummary,
} from "@/lib/backend/types";

/**
 * Ask Alaiy, which lives in alaiy_os core rather than in the self-serve app.
 *
 * Every call carries the seller's own ERPNext token, and that is what makes
 * chats per-user without anything here saying so: `OS Chat Session` and
 * `OS Chat Message` grant role `All` only `if_owner`, so a session is created
 * owned by the caller and `list_sessions` filters on `owner`. There is no
 * workspace parameter to pass and no way to name someone else's chat — asking
 * for one is a PermissionError from the backend, not a filtered empty result.
 *
 * The tools the assistant answers with are supplied by the self-serve app's
 * `chat_tool_sources` hook and are scoped to the caller's workspace. See
 * selfserve/chat_tools.py in the API repo for why that has to exist.
 */

const API = "/api/method/alaiy_os.api.chat";

export async function createChatSession(
  userToken: string | undefined,
  title?: string,
): Promise<ChatSession> {
  return backend.post(`${API}.create_session`, { title }, { userToken });
}

export async function listChatSessions(
  userToken: string | undefined,
  limit = 30,
): Promise<ChatSessionSummary[]> {
  const rows = await backend.get<ChatSessionSummary[] | null>(
    `${API}.list_sessions`,
    { query: { limit }, userToken },
  );
  return rows ?? [];
}

/**
 * Queue one turn. Returns as soon as it is enqueued, not when it is answered.
 *
 * `screen` is the route the seller asked from; core records it on the message
 * so a question asked on Orders can be read back with that context.
 */
export async function sendChatMessage(
  userToken: string | undefined,
  session: string,
  text: string,
  screen?: string,
): Promise<{ seq: number; status: string }> {
  return backend.post(
    `${API}.send_message`,
    { session, text, screen },
    { userToken },
  );
}

/**
 * Messages with seq greater than `after`, plus the session's status.
 *
 * `partial` asks for the message the assistant is still writing, flagged
 * `partial: true`. It inverts the usual cursor rule and core is explicit about
 * the trap: a caller that advances to the highest seq it saw would step past
 * the partial row and never be sent the finished message. The chat view
 * advances past complete messages only — see chat-view.tsx.
 */
export async function getChatMessages(
  userToken: string | undefined,
  session: string,
  after = 0,
  partial = true,
): Promise<ChatFeed> {
  return backend.get(`${API}.get_messages`, {
    query: { session, after, partial: partial ? 1 : 0 },
    userToken,
  });
}

export async function deleteChatSession(
  userToken: string | undefined,
  session: string,
): Promise<void> {
  return backend.post(`${API}.delete_session`, { session }, { userToken });
}
