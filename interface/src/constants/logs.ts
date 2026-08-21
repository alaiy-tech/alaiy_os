/** Every log row is shown with when it happened, whatever else its doctype
 * carries — it is the one column a log is always read by, and Frappe keeps it
 * on `creation` rather than a field of the doctype's own. */
export const TIMESTAMP_FIELD = "creation";
