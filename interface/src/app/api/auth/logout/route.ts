import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/start", request.url), { status: 303 });
}
