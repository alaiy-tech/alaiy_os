import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { getChatMessages } from "@/lib/backend/chat";
import { BackendError } from "@/lib/backend/client";

/**
 * The poll. The browser asks here; this handler is what talks to the backend.
 *
 * No workspace or owner check of its own, and none is needed: the call carries
 * the seller's token and core's `get_messages` does `check_permission("read")`
 * on a DocType that grants `All` only `if_owner`. A guessed session id from
 * another seller is a 403 from the backend, which this passes through.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const chat = params.get("session");
  if (!chat) {
    return NextResponse.json({ error: "session_required" }, { status: 400 });
  }
  const after = Number(params.get("after") ?? 0);

  try {
    const feed = await getChatMessages(
      session.backendToken,
      chat,
      Number.isFinite(after) ? after : 0,
    );
    return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    return NextResponse.json({ error: "chat_poll_failed" }, { status });
  }
}
