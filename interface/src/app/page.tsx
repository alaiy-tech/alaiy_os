import { redirect } from "next/navigation";

/**
 * Signed-in visitors are sent onward by the proxy before this renders, so
 * anyone reaching here is anonymous.
 */
export default function RootPage() {
  redirect("/start");
}
