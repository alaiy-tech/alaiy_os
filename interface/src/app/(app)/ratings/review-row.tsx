import { ChannelBadge, Td } from "@/components/data/table";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/ratings/types";
import { RatingStars } from "./rating-stars";

/**
 * One product review. There is no click-to-open here the way there is on
 * Support's case rows — the thing to do with a review is read the original
 * on the channel itself, not open a panel inside Alaiy, so the row's own
 * interactivity is the "View" link at the end of it.
 */
export function ReviewRow({ review }: { review: Review }) {
  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td className="whitespace-nowrap text-muted">{formatDate(review.date)}</Td>
      <Td>
        <ChannelBadge channel={review.channel} />
      </Td>
      <Td className="max-w-[12rem]">
        <span className="block truncate" title={review.product?.title}>
          {review.product?.title ?? "—"}
        </span>
      </Td>
      <Td>
        <RatingStars value={review.rating} />
      </Td>
      <Td className="max-w-[20rem]">
        <span className="block truncate" title={review.snippet}>
          {review.snippet}
        </span>
      </Td>
      <Td>
        {review.themeTag ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-xs border border-line bg-surface px-2 py-0.5 text-[11px] font-medium capitalize text-muted">
            {review.themeTag}
          </span>
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>
      <Td>
        {review.externalUrl ? (
          <a
            href={review.externalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="whitespace-nowrap text-primary-600 underline-offset-2 hover:underline"
          >
            View <span aria-hidden>↗</span>
          </a>
        ) : (
          <span
            className="whitespace-nowrap text-muted-soft"
            title="Mock data — a live build would deep-link to Seller Central or the Shopify admin."
          >
            View <span aria-hidden>↗</span>
          </span>
        )}
      </Td>
    </tr>
  );
}
