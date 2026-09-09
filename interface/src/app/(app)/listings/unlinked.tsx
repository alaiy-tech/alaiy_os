"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { channelName } from "@/lib/channels";
import { EmptyRow, ChannelBadge, TableFrame, Td, Th } from "@/components/data/table";
import { Spinner, pressClass } from "@/components/ui";
import { linkAction, markExclusiveAction, type LinkState } from "./actions";
import type { UnlinkedProduct } from "@/lib/product-groups/types";

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
 * A client component for one reason: these are the only controls in the app
 * that change what a product *is*, and a person clicking Confirm needs to see
 * the click land. Everything else on this tab is server-rendered.
 */

export function Unlinked({ products }: { products: UnlinkedProduct[] }) {
  return (
    <section aria-label="Unlinked products" className="space-y-2 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display-sm">Not linked yet</h2>
        <p className="text-[12px] text-muted">
          {products.length === 0
            ? "Every product is matched."
            : `${products.length} product${products.length === 1 ? "" : "s"} on one channel with no counterpart on the other.`}
        </p>
      </div>

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
              Nothing waiting. Every product on both channels belongs to a group.
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

      {products.length ? (
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

/**
 * What a person can do about this row.
 *
 * Two verbs, and only one of them appears without a suggestion. "Confirm"
 * needs something to confirm; "Only here" is always available, because
 * knowing a product is single-channel on purpose does not depend on a match
 * having been found.
 */
function Decide({ product }: { product: UnlinkedProduct }) {
  const match = product.suggested_match;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {match ? (
        <RowForm action={linkAction} label="Confirm" title={`Join this to the ${match.confidence}% match and treat them as one product.`}>
          <input type="hidden" name="product_id" value={product.product_id} />
          <input type="hidden" name="counterpart_id" value={match.counterpart_id} />
          <input type="hidden" name="confidence" value={match.confidence} />
        </RowForm>
      ) : null}

      <RowForm
        action={markExclusiveAction}
        label="Only here"
        title="This product is sold on one channel on purpose. It leaves this queue and stops asking to be matched."
      >
        <input type="hidden" name="product_id" value={product.product_id} />
      </RowForm>
    </div>
  );
}

/**
 * One button, its own form, its own action state.
 *
 * Per row rather than one form around the table: two rows submitting into
 * shared state would show one row's failure against the other, and these are
 * decisions about different products.
 */
function RowForm({
  action,
  label,
  title,
  children,
}: {
  action: (prev: LinkState, formData: FormData) => Promise<LinkState>;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const [state, submit] = useActionState<LinkState, FormData>(action, {});

  return (
    <form action={submit} className="inline-flex flex-col gap-0.5">
      {children}
      <Submit label={label} title={title} />
      {/* Beside the row it belongs to. A failure banner at the top of the tab
          would not say which product it was about. */}
      {state.error ? (
        <span className="max-w-[12rem] text-[11px] text-alert-ink">{state.error}</span>
      ) : null}
    </form>
  );
}

function Submit({ label, title }: { label: string; title: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={`${pressClass({ size: "sm" })} whitespace-nowrap disabled:opacity-60`}
    >
      {pending ? <Spinner className="mr-1.5" /> : null}
      {label}
    </button>
  );
}
