/**
 * Ask Alaiy — typed surface over `alaiy_os.api.chat` (see alaiy_os/chat/CHAT.md
 * in the alaiy_os repo). Client-side: every call goes through this app's own
 * /api/method proxy (see proxy.server.ts), which is what attaches the CSRF
 * token every write needs and forwards the session cookie — same pattern as
 * sales-order-actions.ts.
 *
 * Flow: createSession() once, then per question sendMessage() -> poll
 * getMessages({after: lastSeq, partial: 1}) until status leaves "Running".
 */

import { frappeErrorMessage } from "./error-message";

const NS = "alaiy_os.api.chat";

export class FrappeError extends Error {
  httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

async function call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: T;
    exception?: string;
    exc_type?: string;
    _server_messages?: string;
  };

  if (!res.ok) throw new FrappeError(frappeErrorMessage(body, `Request failed (${res.status})`), res.status);
  return body.message as T;
}

export type ChatStatus = "Idle" | "Running" | "Failed";

export interface ChatSessionSummary {
  name: string;
  title: string | null;
  model: string;
  status: ChatStatus;
  last_activity: string | null;
  modified: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown> | null;
}

/** Two kinds, per `OS Chat Message.attachments`: an upload came from the user;
 * an artifact is a file the assistant *generated*. `kind` is absent on every
 * row written before the marker existed, so absent means upload. */
export interface ChatAttachmentMeta {
  kind?: "upload" | "artifact";
  file_name: string;
  file_url: string | null;
  file_size: number;
  chars?: number;
  format?: string;
  rows?: number;
}

export interface ChatMention {
  kind: string;
  value: string;
  label: string;
  sublabel: string | null;
  icon: string | null;
  hint: string | null;
  [extra: string]: unknown;
}

export interface ChatMessage {
  name: string;
  seq: number;
  role: "user" | "assistant";
  text: string;
  attachments: ChatAttachmentMeta[];
  mentions: ChatMention[];
  skill: string | null;
  tool_calls: ChatToolCall[];
  tool_errors: string[];
  partial: boolean;
  creation: string;
}

export interface ChatSkill {
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
}

export interface MentionOption {
  value: string;
  label: string;
  sublabel: string | null;
  icon: string | null;
  hint: string | null;
  [extra: string]: unknown;
}

export interface MentionGroup {
  kind: string;
  label: string;
  min_chars: number;
  options: MentionOption[];
}

export interface MentionCatalogue {
  query: string;
  groups: MentionGroup[];
}

export interface UploadAttachmentResult {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  chars: number;
}

export interface CreateSessionResult {
  session: string;
  title: string | null;
  model: string;
  status: ChatStatus;
}

export interface SendMessageResult {
  seq: number;
  status: ChatStatus;
}

export interface GetMessagesResult {
  session: string;
  title: string | null;
  status: ChatStatus;
  error: string | null;
  messages: ChatMessage[];
  /** Follow-up questions to offer under the newest answer.
   *
   * Sent beside `status` rather than on the message they belong to, and that is
   * deliberate: the server writes them after the final assistant message is
   * committed, by which point this client's cursor is already past that seq and
   * would never be sent the row again. Empty while `status` is "Running" — the
   * newest answer is then the previous one. */
  suggestions: string[];
}

export const createChatSession = (params: { title?: string; model?: string } = {}) =>
  call<CreateSessionResult>(`${NS}.create_session`, params);

export const listChatSessions = (limit = 50) => call<ChatSessionSummary[]>(`${NS}.list_sessions`, { limit });

export const sendChatMessage = (params: {
  session: string;
  text?: string;
  attachments?: string[];
  skill?: string;
  screen?: string;
  mentions?: { kind: string; value: string }[];
}) => call<SendMessageResult>(`${NS}.send_message`, params);

export const getChatMessages = (params: { session: string; after?: number; partial?: 0 | 1 }) =>
  call<GetMessagesResult>(`${NS}.get_messages`, params);

export const deleteChatSession = (session: string) => call<{ deleted: string }>(`${NS}.delete_session`, { session });

export const listChatSkills = () => call<ChatSkill[]>(`${NS}.list_skills`);

export const listChatMentions = (q: string) => call<MentionCatalogue>(`${NS}.list_mentions`, { q });

/** Multipart, so this bypasses the JSON `call()` helper -- the proxy still
 * attaches the CSRF token (proxy.server.ts checks the method, not the
 * content type) and streams the body through untouched. */
export const uploadChatAttachment = async (session: string, file: File): Promise<UploadAttachmentResult> => {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`/api/method/${NS}.upload_attachment?session=${encodeURIComponent(session)}`, {
    method: "POST",
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    message?: UploadAttachmentResult;
    exception?: string;
    _server_messages?: string;
  };
  if (!res.ok) throw new FrappeError(frappeErrorMessage(body, "Upload failed."), res.status);
  return body.message as UploadAttachmentResult;
};

export const deleteChatAttachment = (attachment: string) =>
  call<{ deleted: string }>(`${NS}.delete_attachment`, { attachment });
