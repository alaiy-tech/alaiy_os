import { notFound, redirect } from "next/navigation";

/**
 * Onboarding's old addresses.
 *
 * The steps themselves moved onto /start, so that signing in and finishing
 * setup are one screen rather than two that look nothing alike. Nothing in this
 * app links here any more — but plenty outside it does. These URLs are in
 * week-old session cookies, in bookmarks, in the back button, and, crucially,
 * in the connector: Amazon's consent redirect returns to /onboarding/connect
 * with `?connected=` or `?error=`, and that return address is configured on the
 * bench, not here.
 *
 * So each one forwards, query string and all — losing it would turn a cancelled
 * Amazon authorisation into a silent no-op.
 *
 * Which step is owed is decided from the session on arrival, so the path itself
 * carries no information worth preserving; it only has to say whether the
 * seller is still in onboarding or past it. A path that was never a step still
 * 404s — a typo should not be silently redirected, or a broken link inside the
 * product would look like it worked.
 */
const FORWARD: Record<string, string> = {
  // Still in the flow. /start resolves the actual step.
  "": "/start",
  profile: "/start",
  connect: "/start",
  // Selection is no longer asked for separately; connecting is the answer.
  channels: "/start",
  // Queueing the import was the last thing the flow did, so anyone who reached
  // it is finished. /home re-checks that for itself and sends anyone who is not
  // actually done back to their real step.
  import: "/home",
  done: "/home",
};

export default async function RetiredOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ step?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { step } = await params;

  // Only ever one segment deep, so anything nested was never a step.
  if (step && step.length > 1) notFound();

  const destination = FORWARD[step?.[0] ?? ""];
  if (!destination) notFound();

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const single of Array.isArray(value) ? value : [value ?? ""]) {
      query.append(key, single);
    }
  }
  const search = query.toString();

  redirect(search ? `${destination}?${search}` : destination);
}
