import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { createChatSession, sendChatMessage } from "@/lib/backend/chat";
import { BackendError } from "@/lib/backend/client";
import { userFacingError, OUR_FAULT } from "@/lib/backend/errors";

/**
 * Ask one question.
 *
 * A Route Handler rather than a Server Action because the composer is already
 * polling this endpoint's sibling and needs the reply as JSON — a Server
 * Action would re-render the page around a conversation the client is
 * managing. Same origin either way, so the token still never leaves our
 * server.
 *
 * Creating the session lazily is deliberate: a seller who opens Home and never
 * types would otherwise leave an empty chat in their history every visit.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let payload: { session?: string; text?: string; screen?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const text = (payload.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  try {
    // The title is the question, trimmed by core, so a fresh chat is
    // recognisable in the history rail without a second round trip.
    const chat =
      payload.session ||
      (await createChatSession(session.backendToken, text.slice(0, 60))).session;

    const queued = await sendChatMessage(
      session.backendToken,
      chat,
      text,
      payload.screen,
    );
    return NextResponse.json({ session: chat, ...queued });
  } catch (error) {
    // 417 is what core throws for "this chat is still working on the previous
    // message" and for an unknown skill — a real answer the composer shows,
    // not an outage.
    const status = error instanceof BackendError ? error.status : 502;
    return NextResponse.json(
      { error: userFacingError(error, OUR_FAULT) },
      { status: status >= 500 ? 502 : status },
    );
  }
}
