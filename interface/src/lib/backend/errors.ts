import "server-only";
import { BackendError } from "@/lib/backend/client";

/**
 * Turns a backend failure into something worth showing a seller.
 *
 * A 4xx is the backend telling us something true about this request — a wrong
 * OTP, an unconnected channel — so it is passed through. A 5xx or a transport
 * failure is ours, and must not be blamed on the user or leak internals; it is
 * already logged by the backend client, so here it only needs a message that
 * does not promise retrying will help. Saying "Try again" to someone hitting a
 * missing outgoing Email Account is advice that can never work.
 */
export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof BackendError && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** Copy for the case where the failure is on our side and retrying won't help. */
export const OUR_FAULT =
  "Something went wrong on our side. We've logged it — retrying won't help.";
