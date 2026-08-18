import type { ReactNode } from "react";

const EM_DASH = "—";

/** Label above value, the unit every card on this page is built from. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-sm">{children}</span>
    </div>
  );
}

/** A Field that draws an em dash when the value is unset. Frappe returns `""`
 * for an unset Data/Link field and `null` for an unset Date/Float, and a `0`
 * on a Float is a real value that has to survive — so the emptiness test is
 * spelled out rather than left to a falsy check. */
export function ValueField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const isEmpty = value === null || value === undefined || (typeof value === "string" && !value.trim());
  return <Field label={label}>{isEmpty ? <span className="text-muted-foreground">{EM_DASH}</span> : value}</Field>;
}
