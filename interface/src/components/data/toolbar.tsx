import Form from "next/form";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { pressClass } from "@/components/ui";

/**
 * The filter bar above a listing.
 *
 * A GET form via `next/form`, so submitting writes the filters into the URL and
 * navigates client-side. Three things fall out of that for free: the server
 * does the filtering, the back button works, and a filtered view can be pasted
 * to someone else. It also degrades to a plain form submit without JavaScript.
 *
 * Sort state rides along as hidden inputs — a GET form submits only its own
 * fields, so without these, changing a filter would silently reset the sort.
 * `start` is deliberately *not* carried: a new filter should land on page one
 * rather than on whatever offset the previous result set happened to reach.
 */

type Href = ComponentProps<typeof Link>["href"];

export function Toolbar({
  action,
  sort,
  dir,
  children,
  clearHref,
  filtered,
}: {
  /** The route this listing lives on. */
  action: string;
  sort: string;
  dir: string;
  children: ReactNode;
  clearHref: Href;
  filtered: boolean;
}) {
  return (
    <Form
      action={action}
      // A deeper paper rather than a blue tint: the bar sits inside the page,
      // and a cold ground here would fight the one the product is printed on.
      className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3"
    >
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />

      {children}

      <button type="submit" className={pressClass({ size: "sm" })}>
        Apply
      </button>

      {/* Quiet, not a second press. Clearing a filter is a way back, not the
          thing the bar is for. */}
      {filtered ? (
        <Link href={clearHref} className={`${pressClass({ ground: "quiet", size: "sm" })}`}>
          Clear
        </Link>
      ) : null}
    </Form>
  );
}

/** A labelled control in the bar. The label is small and above, not beside. */
export function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const CONTROL =
  "h-9 rounded-sm border border-line bg-white px-3.5 text-[13px] text-ink transition-colors hover:border-primary-600/40 focus:border-highlight-600";

export function FilterInput({
  className = "w-full",
  ...props
}: ComponentProps<"input">) {
  // The width is the only thing a call site overrides — a pair of amount
  // boxes should not each be as wide as the search field — so it is a
  // parameter rather than something a `className` prop silently loses.
  return <input {...props} className={`${CONTROL} ${className}`} />;
}

export function FilterSelect({
  options,
  ...props
}: ComponentProps<"select"> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={CONTROL}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
