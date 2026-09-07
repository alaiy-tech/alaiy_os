import { NextResponse, type NextRequest } from "next/server";
import { googleAuthorizeUrl } from "@/lib/auth/google";
import { issueOAuthState } from "@/lib/auth/oauth-state";

/** Kicks off Google SSO. The code exchange happens in the callback, server-side. */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const state = await issueOAuthState("google", { next });
  return NextResponse.redirect(googleAuthorizeUrl(state));
}
