"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Eyebrow, pressClass } from "@/components/ui";
import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { FilterField, FilterInput, FilterSelect } from "@/components/data/toolbar";
import type { ChannelId } from "@/lib/backend/types";
import { channelName } from "@/lib/channels";
import { formatDate, formatNumber } from "@/lib/format";
import { WINDOW_OPTIONS, windowStart } from "@/lib/listing";
import {
  detectDefectPatterns,
  opsCategoryLabel,
  productBreakdown,
  ratingDelta,
} from "@/lib/ratings/presentation";
import type {
  OpsNote,
  PositiveAttribution,
  ProductRef,
  Review,
  SellerRating,
} from "@/lib/ratings/types";
import { AddOpsNotePanel } from "./add-ops-note-panel";
import { RatingStars } from "./rating-stars";
import { ReviewRow } from "./review-row";

const PRODUCT_REVIEW_COLUMNS = 7;

/**
 * The Ratings tab's state and layout.
 *
 * A client component holding ops notes in state, the same reasoning as
 * Support's workspace: there is no backend endpoint to post a logged
 * business event to, so it lives nowhere but this component once added.
 * Reviews themselves are not editable here — unlike Support's cases, they
 * are meant to be synced, read-only data (Amazon's Feedback API, a Shopify
 * review app), so the mock set the page hands in is the whole of it for
 * this session.
 */
export function RatingsWorkspace({
  reviews,
  sellerRating,
  positiveAttributions,
  initialOpsNotes,
  products,
}: {
  reviews: Review[];
  sellerRating: SellerRating;
  positiveAttributions: PositiveAttribution[];
  initialOpsNotes: OpsNote[];
  products: ProductRef[];
}) {
  const [opsNotes, setOpsNotes] = useState(initialOpsNotes);
  const [addingNote, setAddingNote] = useState(false);

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelId | "">("");
  const [sku, setSku] = useState("");
  const [rating, setRating] = useState<string>("");
  const [window, setWindowValue] = useState("90");

  const productReviews = useMemo(
    () => reviews.filter((review) => review.kind === "product_review"),
    [reviews],
  );
  const sellerFeedback = useMemo(
    () =>
      reviews
        .filter((review) => review.kind === "seller_feedback")
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 4),
    [reviews],
  );

  const patternAlerts = useMemo(() => detectDefectPatterns(reviews), [reviews]);
  const breakdown = useMemo(() => productBreakdown(reviews), [reviews]);

  const fromDate = windowStart(window);
  const filtered = productReviews.filter((review) => {
    if (channel && review.channel !== channel) return false;
    if (sku && review.product?.sku !== sku) return false;
    if (rating && review.rating !== Number(rating)) return false;
    if (fromDate && review.date < fromDate) return false;
    if (search) {
      const query = search.toLowerCase();
      const haystack = `${review.product?.title ?? ""} ${review.snippet}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  const rows = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  const isFiltered = Boolean(search || channel || sku || rating || window !== "90");

  function focusOn(alertChannel: ChannelId, alertSku: string) {
    setChannel(alertChannel);
    setSku(alertSku);
    setRating("");
  }

  function clearFilters() {
    setSearch("");
    setChannel("");
    setSku("");
    setRating("");
    setWindowValue("90");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Ratings</h1>
        <p className="max-w-2xl text-[13px] text-muted">
          Review patterns, seller rating trend, and the business events behind a change — so a
          defect surfaces before it becomes a return spike.
        </p>
      </div>

      <Alert tone="info">
        Amazon&apos;s SP-API does not expose product review text — only seller feedback. The
        Amazon product reviews below preview the experience a chosen data source (a paid provider,
        most likely — see the linked issue) would unlock; they are not live. Seller feedback and
        the seller rating tile are real Feedback API data shapes.
      </Alert>

      <SellerRatingCard sellerRating={sellerRating} feedback={sellerFeedback} />

      {patternAlerts.length ? (
        <div className="space-y-2">
          {patternAlerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => focusOn(alert.channel, alert.product.sku)}
              className="block w-full text-left"
            >
              <Alert tone={alert.severity === "alert" ? "error" : "warn"}>
                <span className="font-semibold">{formatNumber(alert.count)} reviews</span> in the
                last {alert.windowDays} days mention &quot;{alert.keyword}&quot; on{" "}
                {channelName(alert.channel)} — possible batch defect on{" "}
                <span className="font-semibold">{alert.product.title}</span>. Filter the table
                below ↓
              </Alert>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
        <FilterField label="Search" className="min-w-[13rem] flex-1">
          <FilterInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product or review text"
          />
        </FilterField>
        <FilterField label="Channel">
          <FilterSelect
            value={channel}
            onChange={(event) => setChannel(event.target.value as ChannelId | "")}
            options={[
              { value: "", label: "All" },
              { value: "shopify", label: "Shopify" },
              { value: "amazon", label: "Amazon" },
            ]}
          />
        </FilterField>
        <FilterField label="Product">
          <FilterSelect
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            options={[{ value: "", label: "All products" }, ...products.map((p) => ({ value: p.sku, label: p.title }))]}
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
          <button type="button" onClick={clearFilters} className={pressClass({ ground: "quiet", size: "sm" })}>
            Clear
          </button>
        ) : null}
      </div>

      <TableFrame minWidth="56rem">
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Channel</Th>
            <Th>Product</Th>
            <Th>Rating</Th>
            <Th>Review</Th>
            <Th>Theme</Th>
            <Th>Original</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={PRODUCT_REVIEW_COLUMNS}>
              {isFiltered ? "No reviews match those filters." : "No product reviews yet."}
            </EmptyRow>
          ) : (
            rows.map((review) => <ReviewRow key={review.id} review={review} />)
          )}
        </tbody>
      </TableFrame>

      <ProductBreakdown rows={breakdown} />

      <PositiveAttributionPanel
        attributions={positiveAttributions}
        opsNotes={opsNotes}
        onAddNote={() => setAddingNote(true)}
      />

      {addingNote ? (
        <AddOpsNotePanel
          products={products}
          onClose={() => setAddingNote(false)}
          onCreated={(created) => {
            setOpsNotes((current) => [created, ...current]);
            setAddingNote(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Current rating, its 30-day trend, the Buy Box threshold, and the seller
 *  feedback the number is actually built from — kept in one card so the
 *  figure and the evidence behind it are never more than a glance apart. */
function SellerRatingCard({
  sellerRating,
  feedback,
}: {
  sellerRating: SellerRating;
  feedback: Review[];
}) {
  const first = sellerRating.history[0];
  const delta = first ? ratingDelta(first.value, sellerRating.current) : null;
  const atRisk = sellerRating.current < sellerRating.threshold;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Amazon seller rating
          </p>
          <p className="flex items-baseline gap-2">
            <span className="font-data text-display-md text-primary-600">
              {sellerRating.current.toFixed(1)}
            </span>
            <span className="text-[13px] text-muted">/ 5</span>
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

      {feedback.length ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Recent seller feedback
          </p>
          <p className="text-[11.5px] leading-snug text-muted-soft">
            Amazon&apos;s Feedback API — seller-level, not tied to a product. Kept separate from
            the product reviews below.
          </p>
          <ul className="space-y-1.5">
            {feedback.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-2 text-[12.5px]">
                <RatingStars value={entry.rating} />
                <span className="truncate text-muted">{entry.snippet}</span>
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

function ProductBreakdown({
  rows,
}: {
  rows: { product: ProductRef; channel: ChannelId; avgRating: number; reviewCount: number; previousAvgRating: number | null }[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        Per-product rating breakdown
      </h2>
      <TableFrame minWidth="40rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Channel</Th>
            <Th align="right">Rating</Th>
            <Th align="right">Reviews</Th>
            <Th align="right">Trend (90d)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5}>No product reviews yet.</EmptyRow>
          ) : (
            rows.map((row) => {
              const delta = row.previousAvgRating !== null ? ratingDelta(row.previousAvgRating, row.avgRating) : null;
              return (
                <tr key={`${row.channel}:${row.product.sku}`}>
                  <Td className="font-medium">{row.product.title}</Td>
                  <Td className="capitalize text-muted">{row.channel}</Td>
                  <Td align="right">
                    <RatingStars value={row.avgRating} />
                  </Td>
                  <Td align="right" className="text-muted">
                    {formatNumber(row.reviewCount)}
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
                      <span className="text-muted-soft">—</span>
                    )}
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

function PositiveAttributionPanel({
  attributions,
  opsNotes,
  onAddNote,
}: {
  attributions: PositiveAttribution[];
  opsNotes: OpsNote[];
  onAddNote: () => void;
}) {
  const noteById = new Map(opsNotes.map((note) => [note.id, note]));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Positive attribution
        </h2>
        <Button size="sm" onClick={onAddNote}>
          Log a business event
        </Button>
      </div>

      {attributions.length ? (
        <ul className="space-y-2">
          {attributions.map((attribution) => {
            const note = attribution.opsNoteId ? noteById.get(attribution.opsNoteId) : undefined;
            const delta = ratingDelta(attribution.from, attribution.to);
            return (
              <li
                key={attribution.id}
                className="rounded-sm border border-ok/30 bg-ok-soft px-3.5 py-3 text-[13px] text-ok-ink"
              >
                <p>
                  Your rating on <span className="font-semibold">{attribution.product.title}</span> on{" "}
                  {channelName(attribution.channel)} improved from {attribution.from.toFixed(1)} to{" "}
                  {attribution.to.toFixed(1)} over {attribution.windowDays} days ({delta.label}).
                </p>
                {note ? (
                  <p className="pt-1 text-[12px] text-ok-ink/80">
                    This lines up with a logged {opsCategoryLabel(note.category).toLowerCase()} on{" "}
                    {formatDate(note.date)}: &quot;{note.note}&quot;
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px] text-muted">
          No improvements to report yet — they show up here once a product&apos;s rating climbs.
        </p>
      )}

      {opsNotes.length ? (
        <details className="group rounded-sm border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] text-muted transition-colors hover:text-primary-600">
            <span aria-hidden className="text-[10px] transition-transform group-open:rotate-90">
              ▶
            </span>
            {opsNotes.length} logged business event{opsNotes.length === 1 ? "" : "s"}
          </summary>
          <ul className="space-y-2 border-t border-line px-3.5 py-3">
            {opsNotes.map((note) => (
              <li key={note.id} className="text-[12.5px] leading-snug">
                <span className="font-medium text-ink">{formatDate(note.date)}</span>{" "}
                <span className="text-muted-soft">· {opsCategoryLabel(note.category)}</span>
                {note.product ? (
                  <span className="text-muted-soft"> · {note.product.title}</span>
                ) : null}
                <p className="text-muted">{note.note}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
