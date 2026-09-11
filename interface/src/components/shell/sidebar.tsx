"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";
import { useShell } from "@/components/shell/shell";

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
 *
 * It collapses to icons rather than disappearing. The rail is the only way
 * between tabs at this width, and a seller who reclaims the space still has to
 * be able to leave the screen they are on — so the toggle trades the labels
 * for the width, and keeps every destination reachable. Its width and its
 * collapsed state come from `useShell`, which is also what the drag handle on
 * its edge writes to; see `components/shell/shell.tsx`.
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

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  // The left border is on every row, transparent when inactive, so the icons
  // stay on one edge whether or not a row is the current one. Collapsed, the
  // row is the icon: the rule would be a second mark competing with the tint
  // in a space too narrow for both, so the tint carries it alone.
  const shared = collapsed
    ? "flex items-center justify-center rounded-sm py-2 transition-colors"
    : "flex items-center gap-2.5 rounded-sm border-l-2 py-2 pl-2.5 pr-3 text-[13px] transition-colors";

  if (!item.href) {
    return (
      <span
        aria-disabled
        className={`${shared} cursor-default text-white/35 ${collapsed ? "" : "border-transparent"}`}
        // The only thing naming an unbuilt tab once the chip is gone.
        title={`${item.label} is not built yet`}
      >
        <Icon name={item.icon} />
        {collapsed ? (
          <span className="sr-only">{item.label} — not built yet</span>
        ) : (
          <>
            <span className="flex-1">{item.label}</span>
            <span className="rounded-xs bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">
              Soon
            </span>
          </>
        )}
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
      // Collapsed, the label is no longer on screen, so it has to reach the
      // accessibility tree and the tooltip some other way.
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`${shared} ${
        active
          ? `bg-highlight-300/15 font-semibold text-highlight-300 ${collapsed ? "" : "border-highlight-300"}`
          : `text-white/70 hover:bg-white/10 hover:text-white ${collapsed ? "" : "border-transparent"}`
      }`}
    >
      <Icon name={item.icon} />
      {collapsed ? null : item.label}
    </Link>
  );
}

/**
 * The rail's own toggle. A chevron pointing the way the rail will move, which
 * is the one icon nobody has to be taught.
 */
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand navigation" : "Collapse navigation to icons";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={collapsed ? "M8 5l4 5-4 5M4 4v12" : "M12 5l-4 5 4 5M16 4v12"} />
      </svg>
    </button>
  );
}

function Divider() {
  return <hr className="my-3 border-white/10" />;
}

export function Sidebar({ email, tier }: { email?: string; tier?: string }) {
  const pathname = usePathname();
  const { prefs, update } = useShell();
  const collapsed = prefs.railCollapsed;

  return (
    <nav
      aria-label="Main"
      // `w-rail` is the shell's live token, not a fixed width: the drag handle
      // and the collapse toggle both write it. `overflow-x-hidden` because a
      // 60px rail would otherwise grow a horizontal scrollbar mid-transition.
      className={`hidden h-full w-rail shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-primary-600 py-4 md:flex ${
        collapsed ? "px-2" : "px-3"
      }`}
    >
      <div
        className={`pb-4 ${
          collapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between gap-2 px-2"
        }`}
      >
        {collapsed ? (
          // The wordmark does not fit, so the rail keeps the mark alone — the
          // same square the launcher uses, which is the product's short form.
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-highlight-300 font-sans text-[11px] font-bold text-primary-600"
          >
            A
          </span>
        ) : (
          <Logo onDark />
        )}
        <CollapseToggle
          collapsed={collapsed}
          onToggle={() => update({ railCollapsed: !collapsed })}
        />
      </div>

      <div className="space-y-0.5">
        {PRIMARY.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </div>

      <Divider />

      <div className="space-y-0.5">
        {SECONDARY.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Pushed to the bottom of the rail. Collapsed, the address and the tier
          are the first things to go: neither is something a seller comes to
          the rail for, and signing out is. */}
      <div
        className={`mt-auto space-y-2 border-t border-white/10 pt-3 ${collapsed ? "" : "px-3"}`}
      >
        {email && !collapsed ? (
          <p className="truncate text-[11px] text-white/50" title={email}>
            {email}
          </p>
        ) : null}
        <div
          className={`flex items-center gap-2 ${collapsed ? "justify-center" : "justify-between"}`}
        >
          {tier && !collapsed ? (
            <span className="rounded-xs bg-highlight-300/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-highlight-300">
              {tier}
            </span>
          ) : null}
          {!tier && !collapsed ? <span /> : null}
          {/* A form, not a link: signing out mutates the session cookie. */}
          <form action="/api/auth/logout" method="post">
            {collapsed ? (
              <button
                type="submit"
                aria-label={email ? `Sign out of ${email}` : "Sign out"}
                title={email ? `Sign out — ${email}` : "Sign out"}
                className="grid h-7 w-7 place-items-center rounded-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.5 6.5V4.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2M9 10h7.5M14 7.5l2.5 2.5-2.5 2.5" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                className="text-[11px] text-white/50 underline-offset-2 hover:text-white hover:underline"
              >
                Sign out
              </button>
            )}
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
