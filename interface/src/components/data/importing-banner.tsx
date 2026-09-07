import { Alert } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { ImportJob } from "@/lib/backend/types";

/**
 * Says that what is below is still arriving.
 *
 * The table is shown rather than withheld, because rows land as they are
 * fetched — `store.upsert_*` writes each one and commits counters as it goes —
 * so a seller mid-import genuinely has data worth looking at. What they must
 * not do is read the totals as final, which is the only thing this says.
 *
 * The status box in the corner owns the progress detail; this is deliberately
 * one sentence, not a second progress bar.
 */
export function ImportingBanner({ job }: { job: ImportJob | null }) {
  if (!job) return null;

  const processed = (job.steps ?? []).reduce(
    (total, step) => total + (step.processed ?? 0),
    0,
  );

  return (
    <Alert tone="info">
      Still importing — <span className="font-data font-semibold">{formatNumber(processed)}</span>{" "}
      records so far, so counts and totals here are incomplete.
    </Alert>
  );
}
