import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { getImportStatus, getLatestImport } from "@/lib/backend/imports";
import { BackendError } from "@/lib/backend/client";

/**
 * Same-origin polling endpoint for the import progress screen.
 *
 * The browser polls here; this handler is what talks to os.alaiy.com. The job
 * is always looked up against the session's own workspace, so a guessed job id
 * from another workspace resolves to nothing.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("job");

  try {
    const job = jobId
      ? await getImportStatus(session.workspaceId, jobId, session.backendToken)
      : await getLatestImport(session.workspaceId, session.backendToken);

    return NextResponse.json(job, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    return NextResponse.json({ error: "import_status_failed" }, { status });
  }
}
