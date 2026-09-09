import { deleteSession } from "@/lib/auth/session";
import { redirectTo } from "@/lib/redirect";

export async function POST() {
  await deleteSession();
  return redirectTo("/start", { status: 303 });
}
