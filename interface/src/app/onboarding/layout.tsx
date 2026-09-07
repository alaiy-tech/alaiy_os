import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { requireSession } from "@/lib/auth/dal";
import { getWorkspace } from "@/lib/backend/workspace";

/**
 * Onboarding chrome. The layout re-verifies the session rather than trusting
 * the proxy's optimistic redirect.
 *
 * It also refuses to show the flow to anyone who has already been through it.
 * Onboarding is a one-time path: a seller who finished it should never see the
 * channel picker again, whatever their cookie says.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  if (session.onboardingStep === "done") redirect("/home");

  // The session can be older than the completion — someone who finished before
  // it was persisted, or who has the tab open in a second browser. The
  // workspace is the authority, so ask it; a stale cookie is repaired by the
  // refresh handler, which unlike a layout is allowed to write one.
  //
  // One call per onboarding page view, and only until the seller is through.
  let completed = false;
  try {
    completed = Boolean(
      (await getWorkspace(session.workspaceId, session.backendToken))
        .onboarding_complete,
    );
  } catch {
    // Logged by the backend client. Carrying on shows the flow, which is the
    // safe failure: repeating a step costs a moment, and locking a seller out
    // of onboarding they have not finished costs them the product.
  }
  if (completed) redirect("/api/auth/refresh?next=/home");

  return (
    // Paper, like the rest of the product. The bar is separated by its line,
    // not by being a different colour — there is only one ground.
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-muted sm:inline">{session.email}</span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-muted underline-offset-2 hover:text-primary-600 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
