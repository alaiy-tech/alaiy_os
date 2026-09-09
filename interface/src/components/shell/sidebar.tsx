"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";

/**
 * The left rail, in the order the spec fixes:
 *
 *   Home / Dashboard / Orders / Inventory / Account Health / Finance
 *   — Channels / Settings
 *
 * Dashboard and Account Health are the two additions to that list.
 *
 * Account Health is Amazon-only, which no other row is. It is still a primary
 * row rather than a footnote under Channels: it is read rather than
 * configured, and a suspended Amazon account is the most expensive thing this
 * product can fail to warn about.
 *
 * Dashboard is the other. The spec folds the tiles, the
 * alert bar and the recent-orders snippet into Home, and Home is the Ask
 * surface — so they were built as a band underneath the conversation and that
 * put the figures below the fold on the one screen whose whole job is to be
 * read at a glance. Two entry points, two postures: ask a question, or take
 * the glance.
 *
 * Finance and Settings are rendered rather than hidden, because a seller
 * should be able to see the shape of the product — but they are inert spans,
 * not links: a link to a route that does not exist is a 404, which reads as
 * broken rather than as unfinished.
 *
 * The per-channel rows the spec sketches (a Shopify tab, an Amazon tab) are
 * one Channels row instead, grouped with Settings. Both tables already carry a
 * channel column and a channel filter, so a per-channel tab would be the same
 * rows with a filter pre-applied — and the thing a seller actually comes here
 * for, connecting and syncing, is one screen for both.
 *
 * A client component because a layout cannot know the current pathname on the
 * server — there is no request-scoped way to read it, so the active row has to
 * be decided with `usePathname`.
 */

type NavItem = {
  label: string;
  /** Omitted for a tab that is not built yet. Typed as a literal union so
   *  typedRoutes rejects a path that stops existing. */
  href?:
    | "/home"
    | "/orders"
    | "/listings"
    | "/shipping"
    | "/inventory"
    | "/profitability"
    | "/ratings"
    | "/support"
    | "/dashboard"
    | "/orders"
    | "/inventory"
    | "/account-health"
    | "/channels";
  icon: keyof typeof ICONS;
};

const PRIMARY: NavItem[] = [
  { label: "Home", href: "/home", icon: "home" },
  // Second, not first: Home is the question box, and this is the glance you
  // take before you have a question. Both are entry points, and a seller who
  // wants the numbers should not have to pass through a transcript to reach
  // them — which is exactly what stacking them on one route did.
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Orders", href: "/orders", icon: "orders" },
  // Before Inventory, because the two answer in that order: what each
  // channel says about a product, then how much of it there is.
  { label: "Listings", href: "/listings", icon: "listings" },
  { label: "Shipping", href: "/shipping", icon: "shipping" },
  { label: "Inventory", href: "/inventory", icon: "inventory" },
  { label: "Profitability", href: "/profitability", icon: "profitability" },
  { label: "Ratings", href: "/ratings", icon: "ratings" },
  { label: "Support", href: "/support", icon: "support" },
  // Amazon-only, and after the tabs that cover every channel. It sits in the
  // primary group rather than beside Channels because it is something a seller
  // reads, not something they configure — an account being suspended is the
  // most expensive thing on this rail.
  { label: "Account Health", href: "/account-health", icon: "health" },
  { label: "Finance", icon: "finance" },
];

/** Where the data comes from, and how the account is set up. */
const SECONDARY: NavItem[] = [
  { label: "Channels", href: "/channels", icon: "channels" },
  { label: "Settings", icon: "settings" },
];

/** 16px line icons, currentColor, so they inherit the active/muted treatment. */
const ICONS = {
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z",
  dashboard: "M3.5 3.5h5v5h-5v-5Zm8 0h5v5h-5v-5Zm-8 8h5v5h-5v-5Zm8 0h5v5h-5v-5Z",
  // A pulse line: the shape of a metric being watched.
  health: "M2.5 10.5h3l2-4.5 2.5 8 2-6 1.5 2.5h4",
  orders: "M4 5h12M4 10h12M4 15h8",
  // Two overlapping cards: the same product, described twice.
  listings: "M3 6.5h8.5v8.5H3V6.5Zm5.5-2h8.5V13",
  shipping:
    "M2.5 6h7v6h-7V6ZM9.5 8.5h2.8l2.2 2v1.5h-5V8.5ZM4.5 14.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12.5 14.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  inventory: "M3 6.5 10 3l7 3.5v7L10 17l-7-3.5v-7ZM3 6.5 10 10l7-3.5M10 10v7",
  profitability: "M3.5 15.5v-4M8 15.5V7M12.5 15.5v-8M17 15.5v-2",
  finance: "M10 3v14M6.5 6h5a2.5 2.5 0 0 1 0 5h-3a2.5 2.5 0 0 0 0 5h5",
  channels: "M7 4.5h6l1.5 3h-9l1.5-3ZM3.5 7.5h13v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8Zm4 3h5",
  ratings: "M10 3.3l1.9 4.1 4.4.5-3.3 3 .9 4.4L10 13.2l-3.9 2.1.9-4.4-3.3-3 4.4-.5L10 3.3Z",
  support:
    "M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3 3v-3H5.5a2 2 0 0 1-2-2v-6ZM6.5 8h7M6.5 10.5h4",
  settings:
    "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 2.5v2M10 15.5v2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M2.5 10h2M15.5 10h2M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  // The left border is on every row, transparent when inactive, so the icons
  // stay on one edge whether or not a row is the current one.
  const shared =
    "flex items-center gap-2.5 rounded-sm border-l-2 py-2 pl-2.5 pr-3 text-[13px] transition-colors";

  if (!item.href) {
    return (
      <span
        aria-disabled
        className={`${shared} cursor-default border-transparent text-white/35`}
        title={`${item.label} is not built yet`}
      >
        <Icon name={item.icon} />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-xs bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">
          Soon
        </span>
      </span>
    );
  }

  // The active row is the accent blue, and carries a hard blue rule down its
  // left edge: on a navy rail, "slightly less dark" is a weak signal, and the
  // rule is the same unblurred block of colour the buttons press against.
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${shared} ${
        active
          ? "border-highlight-300 bg-highlight-300/15 font-semibold text-highlight-300"
          : "border-transparent text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon name={item.icon} />
      {item.label}
    </Link>
  );
}

function Divider() {
  return <hr className="my-3 border-white/10" />;
}

export function Sidebar({ email, tier }: { email?: string; tier?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="hidden h-full w-60 shrink-0 flex-col overflow-y-auto bg-primary-600 px-3 py-4 md:flex"
    >
      <div className="px-2 pb-4">
        <Logo onDark />
      </div>

      <div className="space-y-0.5">
        {PRIMARY.map((item) => (
          <NavRow key={item.label} item={item} active={pathname === item.href} />
        ))}
      </div>

      <Divider />

      <div className="space-y-0.5">
        {SECONDARY.map((item) => (
          <NavRow key={item.label} item={item} active={pathname === item.href} />
        ))}
      </div>

      {/* Pushed to the bottom of the rail. */}
      <div className="mt-auto space-y-2 border-t border-white/10 px-3 pt-3">
        {email ? (
          <p className="truncate text-[11px] text-white/50" title={email}>
            {email}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          {tier ? (
            <span className="rounded-xs bg-highlight-300/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-highlight-300">
              {tier}
            </span>
          ) : (
            <span />
          )}
          {/* A form, not a link: signing out mutates the session cookie. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-[11px] text-white/50 underline-offset-2 hover:text-white hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

/**
 * The same destinations, for the widths where the rail does not fit.
 *
 * Only the built rows: on a strip this narrow, an inert "Soon" chip would eat
 * space that a working tab needs. The rail below md is what shows the shape of
 * the product; this is for getting somewhere.
 */
export function MobileNav() {
  const pathname = usePathname();
  const built = [...PRIMARY, ...SECONDARY].filter((item) => item.href);

  return (
    <nav
      aria-label="Main"
      className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden"
    >
      {built.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-sm px-3.5 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-highlight-300 font-semibold text-primary-600"
                : "text-muted hover:bg-primary-600/5 hover:text-primary-600"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
