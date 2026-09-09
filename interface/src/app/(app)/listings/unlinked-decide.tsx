"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, pressClass } from "@/components/ui";
import { linkAction, markExclusiveAction, type LinkState } from "./actions";
import type { UnlinkedProduct } from "@/lib/product-groups/types";

/**
 * The two buttons in the unlinked queue's last column.
 *
 * The only client code on this tab, and split into its own file so that it
 * stays that way. These are the only controls in the app that change what a
 * product *is*, and a person clicking Confirm needs to see the click land —
 * everything around them, the panel and its pager included, is server-rendered
 * and would have been dragged across the boundary by living in the same file.
 * A client component also cannot be handed the `hrefFor` the pager needs, since
 * a function does not serialise across that boundary.
 */

/**
 * What a person can do about this row.
 *
 * Two verbs, and only one of them appears without a suggestion. "Confirm"
 * needs something to confirm; "Only here" is always available, because
 * knowing a product is single-channel on purpose does not depend on a match
 * having been found.
 */
export function Decide({ product }: { product: UnlinkedProduct }) {
  const match = product.suggested_match;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {match ? (
        <RowForm
          action={linkAction}
          label="Confirm"
          title={`Join this to the ${match.confidence}% match and treat them as one product.`}
        >
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
