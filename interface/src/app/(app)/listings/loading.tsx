import { Eyebrow } from "@/components/ui";
import { TableFrame, Th } from "@/components/data/table";

/**
 * What the seller sees while the Listings read is in flight.
 *
 * This tab is the slowest read in the app and it is slowest exactly when it is
 * most likely to be opened: nothing is grouped until a catalogue sync finishes,
 * so during a sync every product is unlinked and every one of them gets a
 * suggestion computed. Without this file the page is a Server Component that
 * awaits that read with nothing rendered — a blank screen for however long it
 * takes, and on a large catalogue mid-sync that was long enough to look broken
 * before the timeout turned it into an error.
 *
 * The heading and the column headers are the real ones rather than grey blocks,
 * so nothing moves when the rows arrive and the seller can see which tab they
 * are on while it loads.
 */
export default function LoadingListings() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Listings</h1>
        <p className="text-[13px] text-muted">
          One row per product, both channels side by side. Edits happen on the
          channel — every listing here links out to it.
        </p>
      </div>

      <TableFrame minWidth="56rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Brand SKU</Th>
            <Th>Shopify</Th>
            <Th>Amazon</Th>
            <Th>Health</Th>
            <Th>Linked by</Th>
            <Th>Synced</Th>
          </tr>
        </thead>
        <tbody aria-hidden>
          {/* A fixed handful. The real count is not known yet, and a skeleton
              that guessed it would resize the page twice. */}
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <tr key={row} className="border-b border-line last:border-0">
              <td colSpan={7} className="px-3 py-3">
                <span className="block h-3 w-full animate-pulse rounded-xs bg-surface" />
              </td>
            </tr>
          ))}
        </tbody>
      </TableFrame>

      <p role="status" className="text-[12px] text-muted">
        Loading your products…
      </p>
    </div>
  );
}
