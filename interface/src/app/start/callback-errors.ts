/**
 * Failures that come back as `?error=` on /start.
 *
 * Two round-trips land here now that sign-in and onboarding share a screen:
 * Google's consent redirect, and the connector's Amazon one. They are kept in
 * one map because the seller cannot tell them apart from the URL either — and
 * `state_mismatch`, which both can raise, has to read the same way whichever
 * hop expired.
 */
export const CALLBACK_ERROR_COPY: Record<string, string> = {
  state_mismatch: "That authorisation link expired. Start again.",
  missing_code: "That sign-in link came back incomplete. Try again.",
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google wouldn't complete the sign-in. Try again.",
  amazon_denied: "Amazon authorisation was cancelled.",
  amazon_failed: "Amazon wouldn't complete the connection. Try again.",
};

export function callbackError(reason?: string): string | undefined {
  if (!reason) return undefined;
  return CALLBACK_ERROR_COPY[reason] ?? "Something went wrong. Try again.";
}
