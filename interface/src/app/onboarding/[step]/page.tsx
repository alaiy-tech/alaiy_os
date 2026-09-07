import { notFound, redirect } from "next/navigation";

/**
 * The onboarding steps that are not screens.
 *
 * Three of the five values `OnboardingStep` can hold have no page of their
 * own. "done" never had one — it is the absence of onboarding — and "channels"
 * and "import" lost theirs when channel selection was folded into Connect and
 * the import moved into the background. All three are still reachable as URLs:
 * they are in week-old session cookies, in bookmarks, and in the back button.
 *
 * Without this they 404, which is a dead end for someone who has done nothing
 * wrong. So each one forwards to where that step's work now happens.
 *
 * Static siblings win over this dynamic segment, so /onboarding/profile and
 * /onboarding/connect are untouched. Anything that is not a step at all still
 * 404s — a typo should not be silently redirected, or a broken link inside the
 * product would look like it worked.
 */
const FORWARD: Record<string, string> = {
  // Onboarding is behind them. /home re-checks that for itself and sends
  // anyone who is not actually finished back to their real step, so this does
  // not have to know whether the claim is true.
  done: "/home",
  // Queueing the import was the last thing the flow did, so anyone who
  // reached it is finished.
  import: "/home",
  // Selection is no longer asked for separately; connecting is the answer.
  channels: "/onboarding/connect",
};

export default async function RetiredStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const destination = FORWARD[step];
  if (!destination) notFound();
  redirect(destination);
}
