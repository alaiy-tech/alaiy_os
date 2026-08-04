import { useFrappeGetDocCount } from "frappe-react-sdk";

/**
 * Real per-status counts for a status-tab strip (e.g. Sales Order's
 * All/Draft/To Deliver and Bill/... tabs), each a live useFrappeGetDocCount.
 *
 * `statuses` MUST be a stable, constant-length array (a module-level
 * constant, not derived from state/props) - this calls one hook per entry,
 * which only satisfies React's rules of hooks because the list never
 * changes shape across renders.
 */
export function useStatusCounts(doctype: string, statuses: readonly string[]) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- statuses is a fixed module-level constant, see docstring
  const results = statuses.map((status) => useFrappeGetDocCount(doctype, status === "All" ? undefined : [["status", "=", status]]));

  const counts: Record<string, number> = {};
  statuses.forEach((status, i) => {
    counts[status] = results[i].data ?? 0;
  });
  return counts;
}
