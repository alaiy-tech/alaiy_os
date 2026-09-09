import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { deleteChatSession, listChatSessions } from "@/lib/backend/chat";
import { BackendError } from "@/lib/backend/client";

/**
 * The seller's own chats: list, and delete one.
 *
 * `list_sessions` filters on `owner` server-side, so this returns the caller's
 * chats and there is nothing to scope here. Delete goes through core's
 * `delete_session`, which checks the document's own permission.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    return NextResponse.json(await listChatSessions(session.backendToken), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    return NextResponse.json({ error: "chat_sessions_failed" }, { status });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const chat = new URL(request.url).searchParams.get("session");
  if (!chat) {
    return NextResponse.json({ error: "session_required" }, { status: 400 });
  }

  try {
    await deleteChatSession(session.backendToken, chat);
    return NextResponse.json({ deleted: chat });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    return NextResponse.json({ error: "chat_delete_failed" }, { status });
  }
}
