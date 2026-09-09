/**
 * Ask Alaiy — typed surface over `alaiy_os.api.chat` (see alaiy_os/chat/CHAT.md).
 * Ported from alaiy_os_globali/frontend's services/frappe/chat.ts, with the
 * axios-style BFF client swapped for frappe.xcall -- this widget is injected
 * straight into an already-authenticated Desk page, so there's no separate
 * origin or session to bridge (see the desk's own ask_alaiy.js, which uses
 * the same frappe.xcall for everything except the multipart upload below).
 *
 * Flow: createSession() once, then per question sendMessage() -> poll
 * getMessages({after: lastSeq, partial: 1}) until status leaves "Running".
 */

const NS = "alaiy_os.api.chat";

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
  /** Extracted characters. Uploads only. */
  chars?: number;
  /** "xlsx" | "csv" | "pdf". Artifacts only. */
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
  /** Only ever true when `partial: 1` was requested -- the assistant is still
   * writing this message. */
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
}

export class FrappeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrappeError";
  }
}

export const createChatSession = (params: { title?: string; model?: string } = {}) =>
  frappe.xcall<CreateSessionResult>(`${NS}.create_session`, params);

export const listChatSessions = (limit = 50) =>
  frappe.xcall<ChatSessionSummary[]>(`${NS}.list_sessions`, { limit });

export const sendChatMessage = (params: {
  session: string;
  text?: string;
  attachments?: string[];
  skill?: string;
  screen?: string;
  mentions?: { kind: string; value: string }[];
}) => frappe.xcall<SendMessageResult>(`${NS}.send_message`, params);

export const getChatMessages = (params: { session: string; after?: number; partial?: 0 | 1 }) =>
  frappe.xcall<GetMessagesResult>(`${NS}.get_messages`, params);

export const deleteChatSession = (session: string) =>
  frappe.xcall<{ deleted: string }>(`${NS}.delete_session`, { session });

export const listChatSkills = () => frappe.xcall<ChatSkill[]>(`${NS}.list_skills`);

export const listChatMentions = (q: string) =>
  frappe.xcall<MentionCatalogue>(`${NS}.list_mentions`, { q });

/** Multipart, so this bypasses xcall (which serialises to form fields) the
 * same way the desk's own ask_alaiy.js does -- the CSRF token has to be sent
 * by hand for the same reason. */
export const uploadChatAttachment = async (
  session: string,
  file: File,
): Promise<UploadAttachmentResult> => {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(
    `/api/method/${NS}.upload_attachment?session=${encodeURIComponent(session)}`,
    {
      method: "POST",
      headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
      credentials: "same-origin",
      body,
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new FrappeError(payload?.message || payload?.exc_type || "Upload failed.");
  }
  return payload.message as UploadAttachmentResult;
};

export const deleteChatAttachment = (attachment: string) =>
  frappe.xcall<{ deleted: string }>(`${NS}.delete_attachment`, { attachment });
