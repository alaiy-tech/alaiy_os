import { requireOnboardedSession } from "@/lib/auth/dal";
import { Alert, ButtonLink, Eyebrow, Pill } from "@/components/ui";
import { loadRatings } from "@/lib/backend/ratings";
import { channelName } from "@/lib/channels";
import { formatDateTime } from "@/lib/format";
import type { ChannelSupport, RatingsGap } from "@/lib/ratings/types";
import { RatingsWorkspace } from "./ratings-workspace";

export const metadata = { title: "Ratings — Alaiy" };

/**
 * The Ratings tab: what buyers say, as far as either channel will tell us.
 *
 * **Amazon only, and for a reason rather than a gap.** Shopify's Admin API has
 * no reviews — they belong to whichever review app a store installed (Judge.me,
 * Yotpo, Loox), each its own API and its own OAuth, none integrated. The
 * backend reports that as data, so the day one lands this notice disappears
 * without a frontend change.
 *
 * The Amazon half is shaped by a second absence: SP-API exposes no product
 * review *text*, at any version. So the tab shows the three things that are
 * real — buyer feedback about the account, which does have text; Amazon's
 * aggregate view of what buyers raise about each product; and how each
 * product's rating is moving — and the gaps panel says plainly what is missing
 * and why, rather than leaving a seller to compare against Seller Central and
 * conclude this is broken.
 */
export default async function RatingsPage() {
  const session = await requireOnboardedSession();
  const { page, error } = await loadRatings(session.backendToken);

  const unsupported = page.channels.filter((channel) => !channel.supported);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-display-md">Ratings</h1>
          {/* Not an error state. Shopify has no reviews to read, so this tab
              has one channel by design. */}
          <Pill tone="warn">Amazon only</Pill>
        </div>
        <p className="max-w-2xl text-[13px] text-muted">
          Your seller rating and the feedback behind it, plus what buyers are raising
          about each product — so a problem surfaces before it becomes a return spike.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {unsupported.map((channel) => (
        <ChannelNotice key={channel.channel} channel={channel} />
      ))}

      {!page.connected ? (
        <NotConnected />
      ) : page.never_synced ? (
        <NeverSynced />
      ) : (
        <>
          <RatingsWorkspace
            sellerRating={page.seller_rating}
            feedback={page.feedback}
            concerns={page.concerns}
            topics={page.topics}
            products={page.products}
            improvements={page.improvements}
          />

          <Gaps gaps={page.gaps} />

          <p className="text-[12px] text-muted">
            {page.synced_at
              ? `Read from Amazon at ${formatDateTime(page.synced_at)}. Buyer feedback arrives with your daily account-health pull; the product aggregates are rebuilt by Amazon about once a week.`
              : "Nothing read from Amazon yet."}
          </p>
        </>
      )}
    </div>
  );
}

/** Why a channel isn't here, in the channel's own words from the backend. */
function ChannelNotice({ channel }: { channel: ChannelSupport }) {
  if (!channel.reason) return null;
  return (
    <Alert tone="info">
      <span className="font-medium">{channelName(channel.channel)}:</span> {channel.reason}
    </Alert>
  );
}

/**
 * What this tab cannot tell you, where you would look for it.
 *
 * The same shape Account Health reports its gaps in, and for the same reason:
 * a seller comparing this against Seller Central finds review text that is not
 * here and concludes the tab is broken. Each gap names what is missing and why
 * it is missing rather than promising it soon.
 */
function Gaps({ gaps }: { gaps: RatingsGap[] }) {
  if (!gaps.length) return null;

  return (
    <section aria-label="Not covered here" className="space-y-2 pt-2">
      <h2 className="text-display-sm">Not covered here</h2>
      <ul className="space-y-2">
        {gaps.map((gap) => (
          <li key={gap.key} className="rounded-sm border border-line bg-surface px-3.5 py-2.5">
            <p className="text-[13px] font-medium text-ink">{gap.title}</p>
            <p className="pt-0.5 text-[12.5px] leading-snug text-muted">{gap.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NeverSynced() {
  return (
    <div className="rounded-sm border border-line bg-white px-4 py-8 text-center">
      <p className="text-[13px] text-muted">
        Nothing read from Amazon yet. Buyer feedback arrives with the daily account-health
        pull, and the product aggregates on a weekly one — both run on their own.
      </p>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="space-y-3 rounded-sm border border-line bg-white px-4 py-8 text-center">
      <p className="text-[13px] text-muted">
        This tab reads Amazon&rsquo;s buyer feedback and its aggregate view of product
        reviews, so it needs an Amazon account attached. Shopify has no reviews of its own
        to read — those live in whichever review app your store uses.
      </p>
      <div className="flex justify-center">
        <ButtonLink href="/channels" size="sm">
          Connect Amazon
        </ButtonLink>
      </div>
    </div>
  );
}
