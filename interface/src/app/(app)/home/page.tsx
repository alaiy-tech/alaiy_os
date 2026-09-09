import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadHomeTiles } from "@/lib/backend/dashboard";
import { openingMessage } from "@/lib/ask/greeting";
import { suggestionsFor } from "@/lib/ask/suggestions";
import { ChatWorkspace } from "@/components/ask/chat-workspace";
import { listChatSessions } from "@/lib/backend/chat";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import type { ChatSessionSummary } from "@/lib/backend/types";
import { Alert } from "@/components/ui";
import { urgency } from "@/lib/support/cases";
import { buildMockCases } from "@/lib/support/mock-data";

export const metadata = { title: "Ask Alaiy" };

/**
 * Home is Ask Alaiy: the conversation, and the seller's past chats beside it.
 *
 * Which chat is open comes from `?chat=`, so a conversation has a URL — it
 * survives a reload, and can be reopened from the rail tomorrow. With no
 * parameter it opens the most recent one, which is also what the docked panel
 * on the data tabs does: that is how a question asked on Orders is still there
 * when the seller comes back to Home, without either surface having to tell
 * the other anything.
 *
 * No session is created here. One appears when a question is asked, or every
 * visit to this page would leave an empty chat in the rail.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { chat } = await searchParams;
  const firstName = session.name?.split(" ")[0];

  // Three reads, none of them fatal. The greeting has a fallback, the rail can
  // be empty, and the import check only decides a placeholder — a failure in
  // any of them should not cost the seller the composer.
  const [{ tiles }, currentImport, sessions] = await Promise.all([
    loadHomeTiles(session.backendToken),
    loadCurrentImport(session.workspaceId, session.backendToken),
    listChatSessions(session.backendToken).catch(() => [] as ChatSessionSummary[]),
  ]);

  const greeting = tiles
    ? openingMessage(tiles, firstName)
    : [
        firstName ? `Hi ${firstName}.` : "Hi.",
        "I can't reach your numbers this second. The tabs on the left still work.",
      ];

  // A `chat` that is not theirs is not honoured: the poll would 403 on it and
  // the screen would sit empty. Falling back to their newest is both safe and
  // what someone following a stale link wants.
  const known = sessions.some((row) => row.name === chat);
  const active = (known ? chat : sessions[0]?.name) ?? null;

  // The Support tab's own alert, per the issue: a case idle for over a week
  // or closing in on Amazon's auto-close should surface here too, not only on
  // Support itself. Mock data, like the tab it points at — see the API
  // constraint note on buildMockCases — so this reads the same seed list
  // rather than anything a seller has added, which lives only in that tab's
  // own client state.
  const urgentSupportCases = buildMockCases().filter(
    (supportCase) => supportCase.status !== "resolved" && urgency(supportCase),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ChatWorkspace
          key={active ?? "new"}
          sessions={sessions}
          initialActive={active}
          greeting={greeting}
          suggestions={suggestionsFor("/home")}
          importing={isImporting(currentImport)}
        />
      </div>
    </div>
  );
}
