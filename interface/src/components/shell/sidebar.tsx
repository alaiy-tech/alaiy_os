"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui";
import { useShell } from "@/components/shell/shell";
import { useChatNav } from "@/components/ask/chat-nav";
import { ChatHistory } from "@/components/shell/chat-history";

/**
 * The left rail: one column holding both the destinations and the seller's
 * chats.
 *
 * ## Four rows, then the rest
 *
 * New Chat, Products, Orders, Connectors — the four things a seller does, in
 * the order they do them. Everything else the product has built (Dashboard,
 * Inventory, Shipping, Profitability, Ratings, Account Health) sits under a
 * "More" disclosure below them, shut by default. A ten-row rail makes the
 * reader choose before they have a question; four does not, and nothing that
 * was reachable has stopped being reachable.
 *
 * Products points at /listings, which is what each channel says about a
 * product. The route keeps its name because the URL is the backend's
 * vocabulary; the rail uses the seller's.
 *
 * New Chat is first and is a button, not a link. Home with no `?chat=` opens
 * the seller's *newest* chat, so navigating to it is the one thing that
 * reliably does not start a new one — see `components/ask/chat-nav.tsx`.
 *
 * ## The chats are in the rail, not beside it
 *
 * They used to be their own column on /home, which put two left-hand rails on
 * the product's main screen and no history at all on the other tabs. Now the
 * rail holds the list and the list travels; see `chat-history.tsx`.
 *
 * ## Settings is at the bottom, on the seller
 *
 * It is an account action, not a destination, so it belongs with the account
 * rather than ninth in a list of screens. The gear beside the seller's name
 * opens it, along with signing out — which has to stay reachable, and this is
 * the only place left for it now that the rail's foot is the identity block.
 *
 * A client component because a layout cannot know the current pathname on the
 * server, so the active row has to be decided with `usePathname`.
 *
 * It collapses to icons rather than disappearing. The rail is the only way
 * between tabs at this width, and a seller who reclaims the space still has to
 * be able to leave the screen they are on — so the toggle trades the labels
 * for the width, and keeps every destination reachable. The chat list goes
 * entirely when collapsed: a 60px column cannot carry a title, and a stack of
 * identical bubbles is not a list. Its width and its collapsed state come from
 * `useShell`, which is also what the drag handle on its edge writes to; see
 * `components/shell/shell.tsx`.
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
    | "/account-health"
    | "/channels";
  icon: keyof typeof ICONS;
};

/** The four. */
const PRIMARY: NavItem[] = [
  { label: "Products", href: "/listings", icon: "products" },
  { label: "Orders", href: "/orders", icon: "orders" },
  // "Channels" to the backend, which is also what the route is called. A
  // seller connects a connector; they do not connect a channel.
  { label: "Connectors", href: "/channels", icon: "connectors" },
];

/** Built, and still reachable, but not worth a permanent row. */
const MORE: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Inventory", href: "/inventory", icon: "inventory" },
  { label: "Shipping", href: "/shipping", icon: "shipping" },
  { label: "Profitability", href: "/profitability", icon: "profitability" },
  { label: "Ratings", href: "/ratings", icon: "ratings" },
  // Amazon-only, which no other row is. It is still here rather than a
  // footnote: a suspended Amazon account is the most expensive thing this
  // product can fail to warn about.
  { label: "Account Health", href: "/account-health", icon: "health" },
  { label: "Finance", icon: "finance" },
];

/** Every route the rail can reach, for deciding whether "More" opens itself. */
const MORE_HREFS = MORE.map((item) => item.href).filter(Boolean) as string[];

/** 16px line icons, currentColor, so they inherit the active/muted treatment. */
const ICONS = {
  // A pencil on a sheet: writing something that is not there yet.
  newChat: "M3.5 10.5v5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5M6 12.5l8-8 2.5 2.5-8 8H6v-2.5Z",
  // A price tag, which is the one shape that means "a thing you sell".
  products: "M3.5 3.5h5.3l7.7 7.7-5.3 5.3-7.7-7.7V3.5Zm2.6 2.6h.01",
  orders: "M4 5h12M4 10h12M4 15h8",
  // Nodes joined by a line: two systems, wired together.
  connectors:
    "M6 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM14 11.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM14 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM7.6 7.1h4.8M7 8.6l5.6 3.9",
  dashboard: "M3.5 3.5h5v5h-5v-5Zm8 0h5v5h-5v-5Zm-8 8h5v5h-5v-5Zm8 0h5v5h-5v-5Z",
  // A pulse line: the shape of a metric being watched.
  health: "M2.5 10.5h3l2-4.5 2.5 8 2-6 1.5 2.5h4",
  shipping:
    "M2.5 6h7v6h-7V6ZM9.5 8.5h2.8l2.2 2v1.5h-5V8.5ZM4.5 14.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12.5 14.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  inventory: "M3 6.5 10 3l7 3.5v7L10 17l-7-3.5v-7ZM3 6.5 10 10l7-3.5M10 10v7",
  profitability: "M3.5 15.5v-4M8 15.5V7M12.5 15.5v-8M17 15.5v-2",
  finance: "M10 3v14M6.5 6h5a2.5 2.5 0 0 1 0 5h-3a2.5 2.5 0 0 0 0 5h5",
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

/**
 * The row geometry, shared by the links, the New Chat button and the More
 * disclosure — so the four of them line up on one left edge whatever they are
 * underneath. A helper rather than a copied string: three of these rows are
 * not links, and a rail whose nav items and whose actions are a pixel apart
 * reads as two lists.
 *
 * No left-edge rule: the active row's plate and its ink label already carry
 * the signal, and this system's emphasis language is fill and shadow, not a
 * hairline down one edge.
 */
function rowClass(collapsed: boolean) {
  return collapsed
    ? "flex w-full items-center justify-center rounded-sm py-2 transition-colors"
    : "flex w-full items-center gap-2.5 rounded-sm py-2 pl-3 pr-3 text-[13px] transition-colors";
}

/**
 * The active row is a solid plate of the palest blue tint with ink text.
 *
 * The rule is that the current thing is the most contrasted thing against its
 * own ground. The rail IS ink, so it inverts that: the plate goes light and
 * the text goes ink. MobileNav, on the light ground, takes the rule the right
 * way up — see the bottom of this file.
 */
const ACTIVE = "bg-active font-semibold text-primary-600";
const RESTING = "text-white/70 hover:bg-white/10 hover:text-white";

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const shared = rowClass(collapsed);

  if (!item.href) {
    return (
      <span
        aria-disabled
        className={`${shared} cursor-default text-white/35`}
        // The only thing naming an unbuilt tab once the chip is gone.
        title={`${item.label} is not built yet`}
      >
        <Icon name={item.icon} />
        {collapsed ? (
          <span className="sr-only">{item.label} — not built yet</span>
        ) : (
          <>
            <span className="flex-1">{item.label}</span>
            <span className="rounded-xs bg-white/10 px-1.5 py-0.5 text-meta font-medium uppercase tracking-[0.12em] text-white/45">
              Soon
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // Collapsed, the label is no longer on screen, so it has to reach the
      // accessibility tree and the tooltip some other way.
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`${shared} ${active ? ACTIVE : RESTING}`}
    >
      <Icon name={item.icon} />
      {collapsed ? null : item.label}
    </Link>
  );
}

/**
 * The one row that is an action.
 *
 * It is never "active": a new chat is a thing you do, not a place you are, and
 * the moment it has a transcript it is a row in the list below instead.
 */
function NewChatRow({ collapsed }: { collapsed: boolean }) {
  const { startNew } = useChatNav();
  return (
    <button
      type="button"
      onClick={startNew}
      aria-label={collapsed ? "New chat" : undefined}
      title={collapsed ? "New chat" : undefined}
      className={`${rowClass(collapsed)} ${RESTING} ${collapsed ? "" : "border-transparent"} text-left`}
    >
      <Icon name="newChat" />
      {collapsed ? null : "New Chat"}
    </button>
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

/**
 * Everything that is built but is not one of the four.
 *
 * Open by default when the seller is standing on one of its rows — otherwise
 * the rail would show nothing marked as current on the screen they are
 * reading. Collapsed, there is no room for a disclosure, so the rows are
 * simply listed: the whole point of the collapsed rail is that no destination
 * stops being reachable.
 */
function MoreGroup({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  const inside = MORE_HREFS.includes(pathname);
  // Null until the seller has an opinion, so the group follows them by
  // default: landing on one of these rows from anywhere else — a Dashboard
  // link inside a page, a reloaded URL — opens the group that holds it,
  // rather than leaving the rail saying nothing about where they now are.
  const [opened, setOpened] = useState<boolean | null>(null);
  const open = opened ?? inside;

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {MORE.map((item) => (
          <NavRow key={item.label} item={item} active={pathname === item.href} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpened(!open)}
        aria-expanded={open}
        className={`${rowClass(false)} border-transparent ${RESTING} text-left`}
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 5l5 5-5 5" />
        </svg>
        More
      </button>
      {open
        ? MORE.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              active={pathname === item.href}
              collapsed={false}
            />
          ))
        : null}
    </div>
  );
}

/**
 * The seller, and the gear beside them.
 *
 * Settings is not built, so the menu says so rather than offering a link to a
 * 404. Sign out is the other half of why the menu exists at all: the rail's
 * foot used to be an email and a "Sign out" link, and folding the identity
 * into an avatar row has to leave a way out of the account.
 */
function AccountBlock({
  name,
  email,
  tier,
  collapsed,
}: {
  name?: string;
  email?: string;
  tier?: string;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // A menu that only closes by pressing its own trigger again is a menu the
  // seller leaves open behind them.
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = name?.trim() || email || "Your account";
  const initial = (display[0] ?? "A").toUpperCase();

  const gear = (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label="Settings and account"
      title="Settings"
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm transition-colors hover:bg-white/10 hover:text-white ${
        open ? "bg-white/10 text-white" : "text-white/50"
      }`}
    >
      <Icon name="settings" />
    </button>
  );

  return (
    <div
      ref={wrap}
      className={`relative mt-auto shrink-0 border-t border-white/10 pt-3 ${collapsed ? "" : "px-1"}`}
    >
      {open ? (
        // Above the trigger, because the trigger is on the floor of the rail.
        // Paper rather than navy: it is a card that has opened over the rail,
        // and the product's one card colour is white on paper.
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-52 overflow-hidden rounded-sm border border-line bg-white py-1 shadow-lg"
        >
          {email ? (
            <p className="truncate border-b border-line px-3 pb-2 pt-1.5 text-meta text-muted" title={email}>
              {email}
            </p>
          ) : null}
          <span
            role="menuitem"
            aria-disabled
            className="flex cursor-default items-center justify-between gap-2 px-3 py-2 text-[13px] text-muted-soft"
            title="Settings is not built yet"
          >
            Settings
            <span className="rounded-xs bg-surface px-1.5 py-0.5 text-meta font-medium uppercase tracking-[0.12em] text-muted">
              Soon
            </span>
          </span>
          {/* A form, not a link: signing out mutates the session cookie. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-primary-600/5 hover:text-primary-600"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}

      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <span
            aria-hidden
            title={display}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-highlight-300 text-[11px] font-bold text-primary-600"
          >
            {initial}
          </span>
          {gear}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-1.5 py-0.5">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-highlight-300 text-[12px] font-bold text-primary-600"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-white" title={email ?? display}>
              {display}
            </span>
            {tier ? (
              <span className="block truncate text-meta uppercase tracking-[0.1em] text-white/45">{tier}</span>
            ) : null}
          </span>
          {gear}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  name,
  email,
  tier,
}: {
  name?: string;
  email?: string;
  tier?: string;
}) {
  const pathname = usePathname();
  const { prefs, update } = useShell();
  const collapsed = prefs.railCollapsed;

  return (
    <nav
      aria-label="Main"
      // `w-rail` is the shell's live token, not a fixed width: the drag handle
      // and the collapse toggle both write it. `overflow-x-hidden` because a
      // 60px rail would otherwise grow a horizontal scrollbar mid-transition.
      // The column scrolls in one place now — the chat list — rather than as a
      // whole, so New Chat and the seller stay pinned at either end.
      className={`hidden h-full w-rail shrink-0 flex-col overflow-x-hidden bg-primary-600 py-4 md:flex ${
        collapsed ? "px-2" : "px-3"
      }`}
    >
      <div
        className={`shrink-0 pb-4 ${
          collapsed
            ? "flex flex-col items-center gap-3"
            : "flex items-center justify-between gap-2 px-2"
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

      <div className="shrink-0 space-y-0.5">
        <NewChatRow collapsed={collapsed} />
        {PRIMARY.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </div>

      <hr className="my-3 shrink-0 border-white/10" />

      {/* The one part of the rail that scrolls, and the only one that can grow
          without bound. Collapsed it is dropped entirely and "More" takes the
          space, so every destination is still one click away. */}
      {collapsed ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MoreGroup collapsed pathname={pathname} />
        </div>
      ) : (
        <>
          <div className="shrink-0">
            <MoreGroup collapsed={false} pathname={pathname} />
          </div>
          <hr className="my-3 shrink-0 border-white/10" />
          <ChatHistory />
        </>
      )}

      <AccountBlock name={name} email={email} tier={tier} collapsed={collapsed} />
    </nav>
  );
}

/**
 * The same destinations, for the widths where the rail does not fit.
 *
 * Only the built rows: on a strip this narrow, an inert "Soon" chip would eat
 * space that a working tab needs. The rail below md is what shows the shape of
 * the product; this is for getting somewhere.
 *
 * The chat list is not here. It is a scrolling column, and there is no column
 * at this width — below md, Home still opens the newest chat and the composer
 * is the screen.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { startNew } = useChatNav();
  const built = [...PRIMARY, ...MORE].filter((item) => item.href);

  const chip = "whitespace-nowrap rounded-sm px-3.5 py-1.5 text-[13px] transition-colors";
  const resting = "text-muted hover:bg-primary-600/5 hover:text-primary-600";

  return (
    <nav
      aria-label="Main"
      // The mask fades both edges so a scrollable strip this narrow always
      // shows a sliver of the next tab — a mobile visitor (Casey) never has
      // to guess there's more without an arrow or a scrollbar to notice.
      className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:hidden"
    >
      <button type="button" onClick={startNew} className={`${chip} ${resting}`}>
        New Chat
      </button>
      {built.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={`${chip} ${
              active ? "bg-primary-600 font-semibold text-white" : resting
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
