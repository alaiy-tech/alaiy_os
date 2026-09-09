import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { updateSession, type OnboardingStep } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/backend/workspace";
import { redirectTo } from "@/lib/redirect";

/**
 * Re-syncs the session cookie from the workspace, then continues.
 *
 * A Route Handler because this has to write a cookie, and a Server Component
 * cannot: `cookies().set` is only legal inside a Server Action or a handler.
 * So a page that discovers the session is stale sends the browser here instead
 * of trying to fix it in place.
 *
 * The case it exists for: a seller who finished onboarding before completion
 * was persisted holds a cookie that still says "channels", while the backend
 * says done. Without this, /home bounces them to /onboarding and the onboarding
 * layout bounces them back — a loop neither side can break, because the layout
 * that knows the truth is the one that cannot write it down.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return redirectTo("/start", { status: 303 });
  }

  let step: OnboardingStep = session.onboardingStep;
  let tier = session.tier;

  try {
    const workspace = await getWorkspace(session.workspaceId, session.backendToken);
    if (workspace.onboarding_complete) step = "done";
    if (workspace.tier) tier = workspace.tier;
  } catch {
    // Already logged by the backend client. Falling through leaves the session
    // exactly as it was, which is the safe direction: an unreachable backend
    // must not promote someone past onboarding.
  }

  await updateSession({ onboardingStep: step, tier });

  return redirectTo(safeNext(request), { status: 303 });
}

/**
 * Where to send the browser afterwards.
 *
 * Only a path within this app. An absolute URL, or one starting "//", would
 * make this an open redirect: anyone could hand a signed-in seller a link that
 * refreshes their session and lands them somewhere else entirely.
 */
function safeNext(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/home";
}
