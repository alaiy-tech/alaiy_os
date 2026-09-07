import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadHomeTiles } from "@/lib/backend/dashboard";
import { openingMessage } from "@/lib/ask/greeting";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { AskPanel } from "@/components/ask/ask-panel";
import { Logo } from "@/components/ui";
import { ImportStatus } from "@/components/import/import-status";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { listChatSessions } from "@/lib/backend/chat";
import type { ChatSessionSummary } from "@/lib/backend/types";

/**
 * The signed-in shell: left rail, screen, and the Ask Alaiy panel on the right
 * at full viewport height — persistent across the data tabs, which is the
 * point of putting it in a layout rather than on each page. The panel hides
 * itself on /home, where Ask is the screen rather than a sidecar.
 *
 * The route group `(app)` keeps the URLs flat: this wraps /home, /orders,
 * /inventory and /channels without putting an "app" segment in the path.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireOnboardedSession();
  const firstName = session.name?.split(" ")[0];

  // Same cached call the Home page makes, so this costs no extra request. A
  // failure here is not worth breaking the shell for: the panel just opens
  // without a read of their numbers.
  const [{ tiles }, currentImport, sessions] = await Promise.all([
    loadHomeTiles(session.backendToken),
    loadCurrentImport(session.workspaceId, session.backendToken),
    // The panel opens the newest chat, which is what Home defaults to as
    // well — that is the whole of how a question asked on Orders is still
    // open when the seller goes back to Home.
    listChatSessions(session.backendToken).catch(() => [] as ChatSessionSummary[]),
  ]);
  const greeting = tiles
    ? openingMessage(tiles, firstName)
    : [
        firstName ? `Hi ${firstName}.` : "Hi.",
        "I can't reach your numbers this second. The tabs on the left still work.",
      ];

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar email={session.email} tier={session.tier} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The rail has no room below md, so the wordmark and sign-out move
            into a bar and the destinations into a strip under it. */}
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Logo />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-muted underline-offset-2 hover:text-primary-600 hover:underline"
            >
              Sign out
            </button>
          </form>
        </header>
        <MobileNav />

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mounted here, not on a page, so its poll survives navigation
          between tabs instead of restarting on each one. */}
      <ImportStatus initialJob={currentImport} />

      <AskPanel
        greeting={greeting}
        sessionId={sessions[0]?.name ?? null}
        importing={isImporting(currentImport)}
      />
    </div>
  );
}
