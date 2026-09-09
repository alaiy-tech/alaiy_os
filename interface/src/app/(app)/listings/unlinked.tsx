import type { ComponentProps } from "react";
import Link from "next/link";
import { channelName } from "@/lib/channels";
import { EmptyRow, ChannelBadge, TableFrame, Td, Th } from "@/components/data/table";
import { Pagination } from "@/components/data/pagination";
import { Alert } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { Decide } from "./unlinked-decide";
import type { UnlinkedPage, UnlinkedProduct } from "@/lib/product-groups/types";

/**
 * Products on one channel that no product group has claimed.
 *
 * The queue that keeps the rest of the tab honest: every unmatched product is
 * a place where an Amazon suppression could sit invisible, because there is no
 * group for it to make red.
 *
 * Three outcomes, and the panel distinguishes them because the confidence
 * behind each is different:
 *
 *   * a barcode match on both sides is linked before this panel ever sees it;
 *   * a title match above the backend's 85% threshold is offered here with its
 *     score, for a person to confirm;
 *   * below that, no suggestion is shown at all. A guess with a number on it
 *     invites a confirming click, and a wrong link merges two products'
 *     inventory — far more expensive than the search it saved.
 *
 * Paged separately from the table above, on its own `ustart`. This is the read
 * that computes a suggestion per row, so its cost is the number of rows shown
 * times the size of the catalogue — which is exactly why it is the queue, and
 * not the comparison table, that must never render unbounded.
 *
 * Server-rendered, like the rest of the tab. Only the Confirm and Only-here
 * buttons are client code; see `unlinked-decide.tsx`.
 */

type Href = ComponentProps<typeof Link>["href"];

export function Unlinked({
  page,
  error,
  hrefFor,
}: {
  page: UnlinkedPage;
  error?: string;
  /** Given an offset, the href for that page of the queue. */
  hrefFor: (start: number) => Href;
}) {
  const products = page.rows;

  return (
    <section aria-label="Unlinked products" className="space-y-2 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display-sm">Not linked yet</h2>
        <p className="text-[12px] text-muted">
          {page.total === 0
            ? "Every product is matched."
            : `${formatNumber(page.total)} product${page.total === 1 ? "" : "s"} on one channel with no counterpart on the other.`}
        </p>
      </div>

      {/* The queue's own failure. It is a separate read from the table above,
          so it fails separately — losing the queue should not cost the seller
          the comparison they came for. */}
      {error ? <Alert>{error}</Alert> : null}

      <TableFrame minWidth="56rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Channel</Th>
            <Th>SKU</Th>
            <Th>Barcode</Th>
            <Th>Possible match</Th>
            <Th>Decide</Th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <EmptyRow colSpan={6}>
              {page.total === 0
                ? "Nothing waiting. Every product on both channels belongs to a group."
                : "No products on this page of the queue."}
            </EmptyRow>
          ) : (
            products.map((product) => (
              <tr
                key={`${product.channel}:${product.external_id}`}
                className="transition-colors hover:bg-primary-600/[0.04]"
              >
                <Td className="font-medium">
                  <span className="flex items-center gap-2">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt=""
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-xs border border-line object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{product.title || product.external_id}</span>
                  </span>
                </Td>
                <Td>
                  <ChannelBadge channel={product.channel} />
                </Td>
                <Td className="text-muted">{product.sku || "—"}</Td>
                <Td className="text-muted">
                  {product.barcode || (
                    <span
                      className="text-muted-soft"
                      title="No barcode on this channel, which is why it could not be matched automatically."
                    >
                      none
                    </span>
                  )}
                </Td>
                <Td>
                  <Suggestion product={product} />
                </Td>
                <Td>
                  <Decide product={product} />
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>

      <Pagination
        total={page.total}
        start={page.start}
        limit={page.limit}
        hrefFor={hrefFor}
        unit="waiting"
      />

      {page.total ? (
        <p className="text-[12px] text-muted">
          Linking merges the two listings into one product — they share a stock
          figure and one days-of-cover reading from then on. That is why nothing
          above 85% links itself.
        </p>
      ) : null}
    </section>
  );
}

/**
 * The suggested counterpart, or the absence of one.
 *
 * "Needs a human" is a real answer and reads better than a blank cell: it says
 * the matching ran and declined to guess, rather than that nothing happened.
 */
function Suggestion({ product }: { product: UnlinkedProduct }) {
  const match = product.suggested_match;

  if (!match) {
    return (
      <span
        className="text-[12px] text-muted"
        title="Nothing scored high enough to suggest. A wrong link merges two products' inventory, so below the threshold no guess is offered."
      >
        Needs a human
      </span>
    );
  }

  const basis =
    match.basis === "barcode"
      ? "same barcode"
      : match.basis === "title"
        ? "similar title"
        : "similar description";

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 text-[12px]">
      <span className="text-ink">{match.group_name ?? "A product on the other channel"}</span>
      <span
        className="font-data text-highlight-700"
        title={`Matched on ${basis}. Above the 85% threshold, so it is offered for confirmation rather than linked unattended.`}
      >
        {match.confidence}%
      </span>
      <span className="text-muted-soft">· {basis}</span>
      <span className="text-muted-soft">
        · on {channelName(product.channel === "shopify" ? "amazon" : "shopify")}
      </span>
    </span>
  );
}
