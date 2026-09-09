import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import logoOnLight from "../../../public/alaiy-logo.png";
import logoOnDark from "../../../public/alaiy-logo-white.png";

/** Shared primitives. Server-safe — no client hooks, no state. */

/**
 * The wordmark.
 *
 * `onDark` swaps to the reversed lockup, in which "al" and "y" invert to white
 * and the "ai" at the centre stays accent blue — the standard mark is a navy
 * plate that would disappear against the navy rail, and a flat white
 * silhouette is not the mark.
 *
 * No "OS" beside it. The product is called Alaiy; "Alaiy OS" is the backend's
 * name and a seller has no reason to ever meet it.
 */
export function Logo({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    // The wrapper is not decoration. A bare `<img>` dropped into a column-flex
    // parent — which is what both the rail and the sign-in panel are — gets
    // stretched to the container's width by `align-items: stretch`, and `h-7`
    // then squashes the mark into a 20:1 smear. Inside an inline-flex box its
    // `w-auto` is measured against its own intrinsic aspect instead.
    <span className={`inline-flex ${className}`}>
      <Image
        src={onDark ? logoOnDark : logoOnLight}
        alt="Alaiy"
        priority
        className="h-7 w-auto"
      />
    </span>
  );
}

/**
 * A section's name, above its heading.
 *
 * The squiggle is the system's own mark and always accent blue; it is
 * decorative, so it is hidden from the accessibility tree and the label
 * carries the meaning.
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`eyebrow ${className}`}>
      <Squiggle />
      {children}
    </p>
  );
}

function Squiggle() {
  return (
    <svg
      width="18"
      height="8"
      viewBox="0 0 18 8"
      fill="none"
      aria-hidden
      className="shrink-0 text-highlight-500"
    >
      <path
        d="M1 5.5C2.5 2 4.5 2 6 5.5C7.5 9 9.5 9 11 5.5C12.5 2 14.5 2 16 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The arcade press, and the only button shape in the product.
 *
 * There is no filled "primary" any more, so there is nothing to rank: two
 * buttons side by side are the same shape, and which one a screen wants taken
 * is said by where it is and what it says, not by how loud it is. `ground` is
 * the only choice — which colour the button is standing on — and `quiet` is
 * the exception below.
 *
 * The shape itself, the lift and the press live in `.press-*` in globals.css,
 * because they are also needed by the row-scale actions in the connect step
 * and by a couple of anchors, and a second copy of that geometry would drift.
 */
type Ground = "light" | "dark" | "alert" | "quiet";

const grounds: Record<Ground, string> = {
  light: "press press-light",
  dark: "press press-dark",
  /** The destructive confirm, and the only press that is not navy. */
  alert: "press press-alert",
  /**
   * Not a press at all: no border, no shadow, no travel.
   *
   * For an action that must be available without being offered — "Cancel"
   * beside a confirm, "Clear" beside a filter. Making these the full shape
   * would give a way out the same weight as the thing itself, and a screen
   * where every control is a key to press has no emphasis left anywhere.
   */
  quiet:
    "inline-flex items-center justify-center gap-2 rounded-sm text-[13px] font-medium text-muted transition-colors hover:bg-primary-600/5 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-45",
};

/** Two heights: the form-scale default, and `sm` for a control inside a row. */
type Size = "md" | "sm";

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[13px]",
  sm: "h-9 px-4 text-[12px]",
};

type PressProps = { ground?: Ground; size?: Size };

/** The class list, exported for the few call sites that need it on an element
 *  this component cannot be — a `<summary>`, or a submit inside a row form. */
export function pressClass({ ground = "light", size = "md" }: PressProps = {}) {
  return `${grounds[ground]} ${sizes[size]}`;
}

export function Button({
  ground,
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & PressProps) {
  return <button {...props} className={`${pressClass({ ground, size })} ${className}`} />;
}

export function ButtonLink({
  ground,
  size,
  className = "",
  ...props
}: ComponentProps<typeof Link> & PressProps) {
  return <Link {...props} className={`${pressClass({ ground, size })} ${className}`} />;
}

/**
 * A text field.
 *
 * White on paper, because a card is the one thing that is white here and a
 * field is a card you can type in. Square-cornered like everything else; the
 * border brightens to the accent on focus, which is the ring the app uses
 * everywhere.
 */
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-sm border border-line bg-white px-3.5 text-sm text-ink transition-colors placeholder:text-muted-soft hover:border-primary-600/40 focus:border-highlight-600 ${className}`}
    />
  );
}

/**
 * The same shape as `Input`, for a native select.
 *
 * `disabled` on an option is what makes a "Select a role" placeholder a prompt
 * rather than an answer — `required` alone stops the form submitting but still
 * lets the seller choose the blank.
 */
export type Option = { value: string; label: string; disabled?: boolean };

export function Select({
  options,
  className = "",
  ...props
}: ComponentProps<"select"> & { options: Option[] }) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-sm border border-line bg-white px-3 text-sm text-ink transition-colors hover:border-primary-600/40 focus:border-highlight-600 ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * A card: white, one line, square.
 *
 * No shadow. The system's shadow is the button's hard block, and putting a
 * blurred one under a card would be a different design — the 1px line against
 * paper is what separates the two surfaces, and it is enough because paper is
 * not white.
 */
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`rounded-sm border border-line bg-white p-6 ${className}`}
    />
  );
}

/**
 * A notice. Soft ground, its own border, dark text — the -ink colours exist so
 * this stays readable at 13px, which bright-on-soft does not (see globals.css).
 */
export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success" | "warn";
  children: ReactNode;
}) {
  const tones = {
    error: "border-alert/30 bg-alert-soft text-alert-ink",
    warn: "border-warn/40 bg-warn-soft text-warn-ink",
    success: "border-ok/30 bg-ok-soft text-ok-ink",
    // Info is the brand's own note, so it is the accent rather than a fourth
    // hue: the blue plate the system reserves for exactly this.
    info: "border-highlight-400 bg-highlight-100 text-primary-600",
  };
  return (
    <p
      role="status"
      className={`rounded-sm border px-3.5 py-2.5 text-[13px] ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

/**
 * A status chip with a dot.
 *
 * Square, like every other shape — the dot is the only round thing in it, and
 * it is round because it is a dot. The dot is what makes a state readable at a
 * glance down a table; the label is what makes it readable to a screen reader
 * and to anyone who cannot tell the greens from the ambers.
 */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "alert" | "brand" | "accent" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    ok: "border-ok/30 bg-ok-soft text-ok-ink",
    warn: "border-warn/40 bg-warn-soft text-warn-ink",
    alert: "border-alert/40 bg-alert-soft text-alert-ink",
    brand: "border-primary-600 bg-primary-600 text-white",
    accent: "border-highlight-400 bg-highlight-300 text-primary-600",
    neutral: "border-line bg-surface text-muted",
  };
  const dots = {
    ok: "bg-ok",
    warn: "bg-warn",
    alert: "bg-alert",
    brand: "bg-highlight-300",
    accent: "bg-primary-600",
    neutral: "bg-muted/50",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
