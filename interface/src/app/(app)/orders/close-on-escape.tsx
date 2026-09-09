"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Escape closes the order detail panel.
 *
 * The panel itself is server-rendered from the URL, which is what keeps a
 * filtered, sorted, one-order-open view pasteable and survivable across a
 * refresh. Escape is the one thing that needs the browser: a key that has to
 * be listened for, and a route the listener has to push.
 *
 * Mounted only while the panel is open, so it does not swallow the key
 * anywhere else — Ask Alaiy binds Escape too, for leaving full screen.
 */
export function CloseOnEscape({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [href, router]);

  return null;
}
