import { isoDate } from "./cases";
import { seedFormal } from "./draft";
import type { SupportCase } from "./types";

/**
 * Seed data for the Support tab.
 *
 * There is no SP-API endpoint to list or read a seller's Seller Support
 * cases (see the issue's API constraint note), so in the real product every
 * one of these would have started as something Jordan typed into the "Add
 * case" form. This is what that log looks like a few weeks in: a case idle
 * for over a week, three waiting on Jordan's own reply, one closing in on
 * Amazon's auto-close, and one already resolved and archived.
 *
 * Dates are built relative to `today` rather than hardcoded, so the tab
 * looks the same age — "idle 11 days" — however many days after this was
 * written someone actually opens it.
 */
export function buildMockCases(today = new Date()): SupportCase[] {
  const ago = (days: number): string => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    return isoDate(d);
  };

  const cases: SupportCase[] = [
    {
      caseId: "14981-22843",
      subject: "FBA inventory discrepancy — 45 units missing",
      type: "fba_inventory",
      status: "pending_amazon",
      openedDate: ago(11),
      lastResponseDate: ago(11),
      lastResponseBy: "seller",
      orderRef: "FBA15JKPL382",
      thread: [
        {
          from: "seller",
          date: ago(11),
          text: "Shipment FBA15JKPL382, received Sep 1, contained 300 units across 6 boxes per the Box Content information. Only 255 units are reflected in available inventory — 45 units short.",
        },
      ],
      draft: {
        standard:
          "Dear Amazon Seller Support,\n\nI am following up on case #14981-22843 regarding 45 units missing from FBA shipment FBA15JKPL382, received Sep 1, 2024. Per the Box Content information provided, the shipment contained 300 units across 6 boxes. I am requesting reconciliation and reimbursement per Amazon's FBA inventory reimbursement policy. Please advise.",
        formal:
          "Dear Amazon Seller Support,\n\nI am escalating case #14981-22843, open 11 days with no update. 45 units remain missing from FBA shipment FBA15JKPL382 (received Sep 1, 2024; 300 units across 6 boxes per the Box Content information). I am requesting immediate reconciliation and reimbursement under Amazon's FBA inventory reimbursement policy, and a response from a senior member of the Seller Support team.\n\nPlease treat this case as overdue.",
      },
    },
    {
      caseId: "15002-77219",
      subject: "Canvas Tote Bag listing suppressed — image policy violation",
      type: "listing",
      status: "pending_seller",
      openedDate: ago(3),
      lastResponseDate: ago(3),
      lastResponseBy: "amazon",
      asin: "B0C4Q7XPLM",
      thread: [
        {
          from: "amazon",
          date: ago(3),
          text: "Your listing has been suppressed. Reason: main image does not meet image requirements — a pure white (RGB 255,255,255) background is required for the main image.",
        },
      ],
      draft: {
        standard:
          "Dear Amazon Seller Support,\n\nWe have identified the non-compliant image and are uploading a corrected main image with a pure white background within 24 hours. Please un-suppress the listing once the new image is processed.",
        formal:
          "Dear Amazon Seller Support,\n\nCase #15002-77219 — the corrected main image (pure white background, per Amazon's image policy) has been uploaded. This listing has been suppressed for 3 days and is losing active sales; I am requesting that it be un-suppressed at the earliest opportunity, and confirmation once review is complete.",
      },
    },
    {
      caseId: "14993-50871",
      subject: "Payment discrepancy — settlement short by $312.40",
      type: "payment",
      status: "pending_seller",
      openedDate: ago(6),
      lastResponseDate: ago(4),
      lastResponseBy: "amazon",
      orderRef: "AMZ-SETTLE-8842",
      thread: [
        { from: "seller", date: ago(6), text: "Settlement AMZ-SETTLE-8842 is $312.40 short of the total order value for the period — see attached breakdown." },
        { from: "amazon", date: ago(4), text: "Thank you for reaching out. Could you confirm the affected order IDs and the expected settlement amount per order?" },
      ],
      draft: null,
    },
    {
      caseId: "15011-40218",
      subject: "Policy warning — inauthentic complaint on ASIN B0CTQ7XKPL",
      type: "policy",
      status: "pending_seller",
      openedDate: ago(7),
      lastResponseDate: ago(5),
      lastResponseBy: "amazon",
      asin: "B0CTQ7XKPL",
      thread: [
        { from: "amazon", date: ago(5), text: "We have received a complaint alleging this listing is inauthentic. Please provide invoices from your supplier for the last 365 days." },
      ],
      draft: null,
    },
    {
      caseId: "15024-19205",
      subject: "Return window question for the AE marketplace",
      type: "general",
      status: "open",
      openedDate: ago(0),
      thread: [
        { from: "seller", date: ago(0), text: "Is the standard 30-day return window extended for Ramadan the way it was last year? Want to update our listing copy if so." },
      ],
      draft: {
        standard:
          "Dear Amazon Seller Support,\n\nI am writing regarding \"Return window question for the AE marketplace.\" Could you confirm whether the standard return window is extended for the current promotional period, and if so, for which categories?\n\nThank you,",
        // Filled in below — a same-day question has nothing to escalate yet,
        // but the toggle should still work if Jordan tries it.
        formal: "",
      },
    },
    {
      caseId: "15006-88134",
      subject: "FBA inventory discrepancy — 6 units received under wrong SKU",
      type: "fba_inventory",
      status: "pending_amazon",
      openedDate: ago(2),
      lastResponseDate: ago(2),
      lastResponseBy: "seller",
      orderRef: "FBA18MNPQ104",
      thread: [
        { from: "seller", date: ago(2), text: "6 units from shipment FBA18MNPQ104 were received and credited to SKU TOTE-BLK-L instead of TOTE-BLK-M. Requesting a correction." },
      ],
      draft: {
        standard:
          "Dear Amazon Seller Support,\n\nI am following up on an FBA inventory discrepancy: \"FBA inventory discrepancy — 6 units received under wrong SKU.\" This relates to order/shipment FBA18MNPQ104. 6 units were received and credited to SKU TOTE-BLK-L instead of TOTE-BLK-M.\n\nPlease reconcile the discrepancy and process reimbursement under Amazon's FBA inventory reimbursement policy where applicable.\n\nThank you,",
        formal: "",
      },
    },
    {
      caseId: "14872-30456",
      subject: "Payment discrepancy — refund not reflected in settlement",
      type: "payment",
      status: "resolved",
      openedDate: ago(34),
      lastResponseDate: ago(21),
      lastResponseBy: "amazon",
      thread: [
        { from: "seller", date: ago(34), text: "A $58.20 refund to the customer was not deducted from our settlement total — please review." },
        { from: "amazon", date: ago(28), text: "We have located the discrepancy — it will be corrected in the next settlement cycle." },
        { from: "amazon", date: ago(21), text: "This has been corrected in settlement AMZ-SETTLE-8710. Closing this case." },
      ],
      draft: null,
    },
  ];

  // The two cases above with no hand-written formal variant get the shared
  // escalation instead, built from their own dates so the day count in the
  // draft always matches the "Idle" chip in the table.
  for (const supportCase of cases) {
    if (supportCase.draft && !supportCase.draft.formal) {
      supportCase.draft.formal = seedFormal(supportCase.draft.standard, supportCase, today);
    }
  }

  return cases;
}
