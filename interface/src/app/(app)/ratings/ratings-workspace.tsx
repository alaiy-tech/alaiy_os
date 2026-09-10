"use client";

import { useState } from "react";
import { Alert, Card, Pill, pressClass } from "@/components/ui";
import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { FilterField, FilterInput, FilterSelect } from "@/components/data/toolbar";
import { formatDate, formatNumber } from "@/lib/format";
import { WINDOW_OPTIONS, windowStart } from "@/lib/listing";
import {
  SENTIMENT_TONE,
  mentionPhrase,
  ratingDelta,
  topicsByProduct,
} from "@/lib/ratings/presentation";
import type {
  ProductRatingRow,
  RatingImprovement,
  ReviewTopic,
  SellerFeedback,
  SellerRating,
} from "@/lib/ratings/types";
import { FeedbackRow } from "./feedback-row";
import { RatingStars } from "./rating-stars";

const FEEDBACK_COLUMNS = 5;

/**
 * The Ratings tab's state and layout.
 *
 * A client component because the feedback filters are client state; everything
 * it renders is server-fetched and read-only. There is nothing to post here —
 * feedback and topics are synced data, and the one thing a seller could add
 * (a logged packaging change, to explain a rating that moved) has nowhere to
 * be stored, so it is not offered rather than offered and silently discarded
 * on refresh.
 *
 * The layout follows what the data can actually support, top to bottom: the
 * seller rating and the feedback behind it, then what buyers are raising about
 * products, then how each product's rating is moving. The first has text; the
 * other two never do.
 */
export function RatingsWorkspace({
  sellerRating,
  feedback,
  concerns,
  topics,
  products,
  improvements,
}: {
  sellerRating: SellerRating | null;
  feedback: SellerFeedback[];
  concerns: ReviewTopic[];
  topics: ReviewTopic[];
  products: ProductRatingRow[];
  improvements: RatingImprovement[];
}) {
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("");
  const [window, setWindowValue] = useState("90");

  const fromDate = windowStart(window);
  const rows = feedback.filter((entry) => {
    if (rating && entry.rating !== Number(rating)) return false;
    if (fromDate && entry.date && entry.date < fromDate) return false;
    if (search) {
      const query = search.toLowerCase();
      const haystack = `${entry.comment ?? ""} ${entry.products.join(" ")} ${entry.order_number ?? ""}`;
      if (!haystack.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  const isFiltered = Boolean(search || rating || window !== "90");

  return (
    <div className="space-y-4">
      {sellerRating ? (
        <SellerRatingCard sellerRating={sellerRating} recent={feedback.slice(0, 4)} />
      ) : null}

      {concerns.length ? <Concerns concerns={concerns} /> : null}

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Buyer feedback
          </h2>
          <p className="text-[12px] text-muted">
            About your account rather than a product — did it arrive, was it as
            described. This is the one place on this tab with a buyer&rsquo;s own words
            in it, and it is what Amazon judges your seller rating on.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
          <FilterField label="Search" className="min-w-[13rem] flex-1">
            <FilterInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Comment, product or order"
            />
          </FilterField>
          <FilterField label="Rating">
            <FilterSelect
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              options={[
                { value: "", label: "Any" },
                { value: "5", label: "★★★★★ 5" },
                { value: "4", label: "★★★★☆ 4" },
                { value: "3", label: "★★★☆☆ 3" },
                { value: "2", label: "★★☆☆☆ 2" },
                { value: "1", label: "★☆☆☆☆ 1" },
              ]}
            />
          </FilterField>
          <FilterField label="Period">
            <FilterSelect
              value={window}
              onChange={(event) => setWindowValue(event.target.value)}
              options={WINDOW_OPTIONS}
            />
          </FilterField>
          {isFiltered ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRating("");
                setWindowValue("90");
              }}
              className={pressClass({ ground: "quiet", size: "sm" })}
            >
              Clear
            </button>
          ) : null}
        </div>

        <TableFrame minWidth="52rem">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Rating</Th>
              <Th>Comment</Th>
              <Th>Order</Th>
              <Th>What it contained</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={FEEDBACK_COLUMNS}>
                {isFiltered
                  ? "No feedback matches those filters."
                  : "No buyer feedback in the last 90 days."}
              </EmptyRow>
            ) : (
              rows.map((entry) => <FeedbackRow key={entry.id} feedback={entry} />)
            )}
          </tbody>
        </TableFrame>
      </section>

      <ProductTopics groups={topicsByProduct(topics)} />

      <ProductBreakdown rows={products} />

      <Improvements improvements={improvements} />
    </div>
  );
}

/**
 * Current rating, its trend, the Buy Box threshold, and the feedback the
 * number is built from — one card, so the figure and its evidence are never
 * more than a glance apart.
 *
 * The caption is not a disclaimer bolted on. Amazon publishes no seller-rating
 * endpoint, so this is the mean of the feedback we hold; a seller who compares
 * it against Seller Central and finds it different needs to know why from the
 * tile itself, not from a support conversation.
 */
function SellerRatingCard({
  sellerRating,
  recent,
}: {
  sellerRating: SellerRating;
  recent: SellerFeedback[];
}) {
  const first = sellerRating.history[0];
  const delta =
    first && sellerRating.current !== null
      ? ratingDelta(first.value, sellerRating.current)
      : null;
  const atRisk = sellerRating.current !== null && sellerRating.current < sellerRating.threshold;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Amazon seller rating
          </p>
          <p className="flex items-baseline gap-2">
            <span className="font-data text-display-md text-primary-600">
              {sellerRating.current !== null ? sellerRating.current.toFixed(1) : "—"}
            </span>
            <span className="text-[13px] text-muted">/ 5</span>
          </p>
          <p className="text-[11.5px] leading-snug text-muted-soft">
            {sellerRating.sample_size > 0 ? (
              <>
                The mean of the {formatNumber(sellerRating.sample_size)} piece
                {sellerRating.sample_size === 1 ? "" : "s"} of feedback we hold from the
                last {sellerRating.window_days} days. Amazon publishes no rating
                endpoint, and its own figure is over twelve months — expect these to
                differ.
              </>
            ) : (
              <>No buyer feedback synced yet, so there is nothing to average.</>
            )}
          </p>
        </div>

        {delta ? (
          <div className="text-right">
            <p
              className={`font-data text-[13px] font-semibold ${
                delta.direction === "up"
                  ? "text-ok-ink"
                  : delta.direction === "down"
                    ? "text-alert-ink"
                    : "text-muted"
              }`}
            >
              {delta.label}
            </p>
            <p className="text-[11px] text-muted-soft">since {formatDate(first.date)}</p>
          </div>
        ) : null}

        <span
          className={`rounded-xs border px-2.5 py-1 text-[12px] font-medium ${
            atRisk
              ? "border-alert/40 bg-alert-soft text-alert-ink"
              : "border-ok/30 bg-ok-soft text-ok-ink"
          }`}
        >
          Buy Box eligibility at risk below {sellerRating.threshold.toFixed(1)}
        </span>
      </div>

      {recent.length ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Most recent
          </p>
          <ul className="space-y-1.5">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-2 text-[12.5px]">
                <RatingStars value={entry.rating} />
                <span className="truncate text-muted">
                  {entry.comment ?? <span className="text-muted-soft">No comment left</span>}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-soft">
                  {formatDate(entry.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * What buyers are raising negatively, worst first.
 *
 * This is the weaker claim that replaced "3 reviews this week mention
 * 'zipper'". That sentence needed review text and a count of reviews, and
 * Amazon gives neither — so this says what the aggregate supports: buyers are
 * raising this topic badly on this product, as of a reading up to a week old.
 * Weaker, and true.
 */
function Concerns({ concerns }: { concerns: ReviewTopic[] }) {
  return (
    <div className="space-y-2">
      {concerns.slice(0, 5).map((topic) => {
        const phrase = mentionPhrase(topic.mention_share);
        return (
          <Alert key={`${topic.sku}:${topic.topic}`} tone="warn">
            Buyers are raising{" "}
            <span className="font-semibold">&ldquo;{topic.topic}&rdquo;</span> negatively
            on <span className="font-semibold">{topic.title}</span>
            {phrase ? ` — ${phrase}` : null}.{" "}
            {topic.as_of_date ? (
              <span className="text-[12px]">
                Amazon&rsquo;s aggregate as of {formatDate(topic.as_of_date)}; it rebuilds
                these about weekly, so this has been building for up to seven days.
              </span>
            ) : null}
          </Alert>
        );
      })}
    </div>
  );
}

/** Every topic per product, in Amazon's own rank order. The detail behind the
 *  banner, for the products it did not name. */
function ProductTopics({
  groups,
}: {
  groups: { sku: string; title: string; topics: ReviewTopic[] }[];
}) {
  if (!groups.length) return null;

  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          What buyers mention, by product
        </h2>
        <p className="text-[12px] text-muted">
          Amazon&rsquo;s aggregate of its product reviews — the topics and how they land.
          There is no review text behind these and no count of reviews: Amazon publishes
          neither, so a share is described rather than converted into a number.
        </p>
      </div>
      <ul className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.sku}
            className="space-y-1.5 rounded-sm border border-line bg-surface px-3.5 py-3"
          >
            <p className="text-[13px] font-medium text-ink">{group.title}</p>
            <ul className="flex flex-wrap gap-1.5">
              {group.topics.map((topic) => (
                <li key={topic.topic}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-[11.5px] ${SENTIMENT_TONE[topic.sentiment]}`}
                    title={mentionPhrase(topic.mention_share) ?? undefined}
                  >
                    {topic.topic}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductBreakdown({ rows }: { rows: ProductRatingRow[] }) {
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Per-product rating
        </h2>
        <p className="text-[12px] text-muted">
          Worst first. The review count column is empty because Amazon&rsquo;s trend
          carries an average and no denominator — inventing one would put a number here
          that nothing produced.
        </p>
      </div>
      <TableFrame minWidth="40rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th align="right">Rating</Th>
            <Th align="right">Reviews</Th>
            <Th align="right">Change</Th>
            <Th>Period</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5}>
              No product rating data yet. Amazon offers this aggregate on a subset of
              marketplaces and rebuilds it weekly.
            </EmptyRow>
          ) : (
            rows.map((row) => {
              const delta =
                row.previous_avg_rating !== null
                  ? ratingDelta(row.previous_avg_rating, row.avg_rating)
                  : null;
              return (
                <tr key={row.sku}>
                  <Td className="font-medium">
                    <span className="block truncate" title={row.sku}>
                      {row.title}
                    </span>
                  </Td>
                  <Td align="right">
                    <RatingStars value={row.avg_rating} />
                  </Td>
                  <Td align="right">
                    <span
                      className="text-muted-soft"
                      title="Amazon publishes an average rating with no review count beside it."
                    >
                      —
                    </span>
                  </Td>
                  <Td align="right">
                    {delta ? (
                      <span
                        className={
                          delta.direction === "up"
                            ? "text-ok-ink"
                            : delta.direction === "down"
                              ? "text-alert-ink"
                              : "text-muted"
                        }
                      >
                        {delta.label}
                      </span>
                    ) : (
                      <span
                        className="text-muted-soft"
                        title="Only one reading stored so far — no history to compare against yet, which isn't the same as no change."
                      >
                        —
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {row.period_start ? formatDate(row.period_start) : "—"}
                    {row.period_end ? ` – ${formatDate(row.period_end)}` : null}
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableFrame>
    </section>
  );
}

/**
 * Products whose rating actually climbed.
 *
 * It stops at the observation. Saying "your rating improved after the packaging
 * change" would need a logged business event, which this app does not store —
 * and inferring a cause from two numbers is the tab picking the most flattering
 * explanation available and presenting it as a finding.
 */
function Improvements({ improvements }: { improvements: RatingImprovement[] }) {
  if (!improvements.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        Moving up
      </h2>
      <ul className="space-y-2">
        {improvements.map((improvement) => (
          <li
            key={improvement.sku}
            className="rounded-sm border border-ok/30 bg-ok-soft px-3.5 py-3 text-[13px] text-ok-ink"
          >
            <p>
              <span className="font-semibold">{improvement.title}</span> went from{" "}
              {improvement.from.toFixed(1)} to {improvement.to.toFixed(1)}
              {improvement.period_end ? ` by ${formatDate(improvement.period_end)}` : null}.
            </p>
            <p className="pt-1 text-[12px] text-ok-ink/80">
              What changed is yours to know — Alaiy has no record of your packaging,
              supplier or 3PL, so it reports the movement and doesn&rsquo;t guess at a
              cause.
            </p>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-muted-soft">
        <Pill tone="neutral">Observation</Pill>{" "}
        <span className="align-middle">
          A rating that rose over a period, not a claim that anything caused it.
        </span>
      </p>
    </section>
  );
}
