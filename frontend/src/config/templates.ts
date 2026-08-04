/**
 * Planned-layout wireframe rows per template, keyed exactly as they appear
 * in navigation.ts's `template` field. Lifted verbatim from the WIRE map in
 * mydesign/Alaiy OS Dashboard.dc.html - this is what the Coming Soon screen's
 * dashed preview panel renders for a not-yet-built doctype.
 */
export const TEMPLATE_WIREFRAME: Record<string, string[]> = {
  "T8 — lightweight reference list": ["Filter bar · Select + search", "Compact table · 6 columns", "Pagination · showing X of Y"],
  "T8 cards — plan grid": ["Header · New plan button", "Card grid · 3 up, price + features", "Comparison strip"],
  "T7 — config form": ["Tab strip", "Condition builder · applies-to rows", "Rate / discount section", "Save · bottom right"],
  "T7 — settings with tab strip": ["Tab strip · 5 tabs", "Single-column field group", "Switch rows · notifications", "Save · bottom right"],
  "T6 — ledger / movement feed": ["Latest / Upcoming tabs", "Date-grouped rows · in / out", "Signed amount column", "Running balance footer"],
  "T6 — rate-update ledger": ["Currency pair selector", "Date-grouped rate rows", "Per-pair trend sparkline"],
  "T2 — transactional list + detail": ["Status tab strip", "Filter bar · 3 selects", "Table · id, party, amount, status", "Pagination"],
  "T2 variant — goods received": ["Status tab strip", "Table · accepted / rejected qty", "Warehouse column", "Pagination"],
  "T1 variant — bundle contents": ["Title + meta line", "Media grid", "Bundle contents line-item table", "Activity feed"],
  "T4 — directory / profile": ["Avatar + name column", "Group / status filter chips", "Table", "Pagination"],
  "T4 lite — list + side drawer": ["Compact table", "Row click opens Sheet drawer", "Contact panel inside drawer"],
  "T4 variant — profile per warehouse": ["Profile card · address", "Stat strip · stock value", "Bin table"],
  "T5 — stage tracker": ["Stage columns · count + value", "Progress bars per stage", "Task list · due-date badges"],
  "T5 — tiers as stage bars": ["Tier blocks · thresholds", "Progress per tier", "Redemption table"],
  "T5 + T7 — reach and rules": ["Reach breakdown by source", "Rule condition section", "Save"],
};

export const DEFAULT_TEMPLATE = "T8 — lightweight reference list";
