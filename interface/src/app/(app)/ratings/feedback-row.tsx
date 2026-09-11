import { Td } from "@/components/data/table";
import { SellerCentralLink } from "@/components/channel/seller-central-link";
import { formatDate } from "@/lib/format";
import type { SellerFeedback } from "@/lib/ratings/types";
import { RatingStars } from "./rating-stars";

/**
 * One piece of buyer feedback.
 *
 * No channel badge: this tab is Amazon-only because Shopify has no reviews of
 * its own, and a badge that says "Amazon" on every row of every table is
 * furniture rather than information. The header says it once.
 *
 * The products column is what the order contained, and is deliberately not
 * presented as what the feedback is *about*. Seller feedback is about the
 * transaction — an order of three items does not make a complaint about late
 * delivery a complaint about any one of them, and a column that implied
 * otherwise would let someone go looking for a defect that isn't there.
 */
export function FeedbackRow({ feedback }: { feedback: SellerFeedback }) {
  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td className="whitespace-nowrap text-muted">{formatDate(feedback.date)}</Td>
      <Td>
        <RatingStars value={feedback.rating} />
      </Td>
      <Td className="max-w-[24rem]">
        {feedback.comment ? (
          <span className="block truncate" title={feedback.comment}>
            {feedback.comment}
          </span>
        ) : (
          <span
            className="text-muted-soft"
            title="A buyer can leave a rating without writing anything."
          >
            Rating only
          </span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted">
        <span className="inline-flex items-center gap-0.5">
          {feedback.order_number ?? (
            <span
              className="text-muted-soft"
              title={`Amazon order ${feedback.order_id} — older than the orders we've synced, so it has no number here.`}
            >
              —
            </span>
          )}
          {/* The order, not Feedback Manager: feedback is about a transaction,
              and the order is the page showing what the buyer is talking
              about. Feedback Manager is linked from the tab heading. */}
          <SellerCentralLink
            href={feedback.admin_url}
            label={`Open order ${feedback.order_number ?? feedback.order_id} in Seller Central`}
          />
        </span>
      </Td>
      <Td className="max-w-[16rem]">
        {feedback.products.length ? (
          <span className="block truncate" title={feedback.products.join(", ")}>
            {feedback.products.join(", ")}
          </span>
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>
    </tr>
  );
}
