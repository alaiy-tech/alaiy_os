import { formatCurrency } from "@/lib/utils";

/** Default cell renderer for a doctype-driven column, keyed by Frappe fieldtype.
 * Shared by every generic list table (Products, Sales Orders, ...) so a new
 * fieldtype only needs to be taught here once. `currency` is the session's
 * default currency (see useCompany()) - only read for fieldtype "Currency". */
export function GenericCell({ value, fieldtype, currency }: { value: unknown; fieldtype: string; currency?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (fieldtype === "Check") {
    return <span>{value ? "Yes" : "No"}</span>;
  }
  if (fieldtype === "Currency") {
    return <span className="tabular-nums">{formatCurrency(Number(value), { currency })}</span>;
  }
  if (["Int", "Float", "Percent"].includes(fieldtype)) {
    return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
  }
  return (
    <span className="block truncate" title={String(value)}>
      {String(value)}
    </span>
  );
}
