/** Default cell renderer for a doctype-driven column, keyed by Frappe fieldtype.
 * Shared by every generic list table (Products, Sales Orders, ...) so a new
 * fieldtype only needs to be taught here once. */
export function GenericCell({ value, fieldtype }: { value: unknown; fieldtype: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (fieldtype === "Check") {
    return <span>{value ? "Yes" : "No"}</span>;
  }
  if (["Int", "Float", "Currency", "Percent"].includes(fieldtype)) {
    return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
  }
  return (
    <span className="block truncate" title={String(value)}>
      {String(value)}
    </span>
  );
}
