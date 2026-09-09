/**
 * The Support tab's own shapes.
 *
 * There is no backend module for these — see the issue's API constraint
 * note: Amazon's SP-API has no endpoint to list a seller's Seller Support
 * cases, read a case thread, or post a reply. V1 is Jordan typing a case in
 * and Alaiy drafting a reply from context already in Alaiy, so this whole
 * tab is frontend-only, backed by mock data (see mock-data.ts) until that
 * changes.
 */

export type CaseType =
  | "listing"
  | "fba_inventory"
  | "payment"
  | "policy"
  | "general";

/**
 * Amazon's own case lifecycle, as Jordan reports it — nothing here is read
 * back from Seller Central, so it is only ever as current as the last time
 * someone updated it by hand.
 */
export type CaseStatus = "open" | "pending_amazon" | "pending_seller" | "resolved";

export type CaseThreadMessage = {
  from: "seller" | "amazon";
  /** YYYY-MM-DD, same convention as every other date in the app. */
  date: string;
  text: string;
};

/** The two tones the panel's toggle switches between. */
export type CaseDraft = {
  standard: string;
  formal: string;
};

export type SupportCase = {
  /** Amazon's own Case ID. Unique, so it doubles as this case's key. */
  caseId: string;
  subject: string;
  type: CaseType;
  status: CaseStatus;
  openedDate: string;
  lastResponseDate?: string;
  /** Whoever spoke last — which side owes the next reply. */
  lastResponseBy?: "seller" | "amazon";
  /** An order id, FBA shipment id, or settlement id Jordan typed in. */
  orderRef?: string;
  asin?: string;
  notes?: string;
  thread: CaseThreadMessage[];
  /** Null for a case entered before there was enough to go on. */
  draft: CaseDraft | null;
};
