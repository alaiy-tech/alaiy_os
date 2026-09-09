import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * All / Shopify / Amazon, above a listing.
 *
 * The same table underneath — this changes one parameter in the URL, exactly
 * as the channel dropdown it replaces did. It is a row of tabs rather than a
 * select because switching channel is the move a multi-channel seller makes
 * most often on this screen, and a filter you use constantly should be one
 * click and always visible, not two clicks inside a bar of five other things.
 *
 * Links, like every other piece of listing state: the server does the
 * filtering, the back button steps back through channels, and a channel view
 * survives being pasted to someone else.
 *
 * No counts on the tabs. They would have to be counts of the window rather
 * than of the view, and "Amazon 143" over a filtered table showing four rows
 * is a number that answers a question nobody asked.
 */

type Href = ComponentProps<typeof Link>["href"];

export type ChannelTab = { value: string; label: string; href: Href };

export function ChannelTabs({
  tabs,
  active,
  label,
}: {
  tabs: ChannelTab[];
  /** The current value; "" is the all-channels tab. */
  active: string;
  /** What the tabs switch between, for a screen reader. */
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-sm border border-line bg-surface p-1"
    >
      {tabs.map((tab) => {
        const current = tab.value === active;
        return (
          <Link
            key={tab.value || "all"}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            // The selected tab is a navy plate: the system's one panel colour,
            // used with intent rather than in rotation, and the only thing on
            // paper that reads as "this one, definitely".
            className={`rounded-xs px-3.5 py-1.5 text-[13px] transition-colors ${
              current
                ? "bg-primary-600 font-semibold text-white"
                : "text-muted hover:bg-primary-600/5 hover:text-primary-600"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
