import { isoDate } from "@/lib/dates";
import { themeTagFor } from "./presentation";
import type { OpsNote, PositiveAttribution, ProductRef, Review, SellerRating } from "./types";

/**
 * Seed data for the Ratings tab.
 *
 * Two different constraints shape what is real here and what is not. Amazon's
 * Feedback API genuinely covers seller feedback and the seller rating, so
 * that part of the mock stands in for a real, buildable integration. Amazon
 * product review *text* does not exist via any SP-API endpoint — see the
 * issue's open question — so every Amazon `product_review` entry below is
 * illustrative only, previewing the experience a chosen data source (a paid
 * provider, most likely) would need to unlock. The banner on the page says
 * so; this comment is why the mock includes them anyway rather than only
 * shipping the Shopify half of the story.
 *
 * Dates are built relative to `today` rather than hardcoded, so "9 days" and
 * "60 days" stay true however long after this was written someone opens the
 * tab — the same reasoning as Support's mock-data.
 */

const PRODUCTS = {
  wallet: { sku: "LWS-BRN-01", title: "Leather Wallet Slim" } satisfies ProductRef,
  toteBlack: { sku: "CTB-BLK-01", title: "Canvas Tote Bag (Black)" } satisfies ProductRef,
  toteLinen: { sku: "LTN-NAT-01", title: "Linen Tote Natural" } satisfies ProductRef,
  crossbody: { sku: "SCB-TAN-01", title: "Suede Crossbody Bag" } satisfies ProductRef,
};

/** The catalogue the filter bar and the "log a business event" form pick
 *  from — a stand-in for a product search against real inventory data. */
export const PRODUCT_LIST: ProductRef[] = Object.values(PRODUCTS);

function tag(snippet: string, rating: number, id: string, extra: Omit<Review, "id" | "snippet" | "rating" | "themeTag">): Review {
  return { id, snippet, rating, themeTag: themeTagFor(snippet), ...extra };
}

export function buildMockRatingsData(today = new Date()) {
  const ago = (days: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    return isoDate(d);
  };

  const reviews: Review[] = [
    // Leather Wallet Slim — the issue's own defect-cluster example. Four
    // Amazon reviews in nine days, all naming the same failed part.
    tag("The zipper broke after 2 uses. Very disappointed.", 1, "rev-lws-am-1", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.wallet,
      date: ago(9),
    }),
    tag(
      "Stitching came apart within a week, and the zipper feels flimsy too.",
      2,
      "rev-lws-am-2",
      { channel: "amazon", kind: "product_review", product: PRODUCTS.wallet, date: ago(7) },
    ),
    tag("Zipper broke on first use — unusable.", 1, "rev-lws-am-3", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.wallet,
      date: ago(4),
    }),
    tag("The zipper came off in the first week.", 1, "rev-lws-am-4", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.wallet,
      date: ago(1),
    }),
    tag("Beautiful wallet, holds up great, zipper works perfectly.", 5, "rev-lws-sh-1", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.wallet,
      date: ago(20),
    }),

    // Canvas Tote Bag (Black) — a packaging fix, before and after. See the
    // "packaging" ops note below at ago(35): every prior review complains
    // about shipping damage, every recent one does not.
    tag(
      "Box arrived with a crushed corner — packaging was too thin for shipping.",
      2,
      "rev-ctb-am-1",
      { channel: "amazon", kind: "product_review", product: PRODUCTS.toteBlack, date: ago(88) },
    ),
    tag("Bag is fine but the box was a bit banged up in transit.", 3, "rev-ctb-am-2", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(70),
    }),
    tag("Corner smashed on arrival, disappointing for the price.", 2, "rev-ctb-am-3", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(55),
    }),
    tag("Great tote, holds a lot.", 5, "rev-ctb-am-4", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(45),
    }),
    tag("Arrived perfectly packaged this time — no damage at all.", 5, "rev-ctb-am-5", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(28),
    }),
    tag("Nice bag, box was solid and protective.", 4, "rev-ctb-am-6", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(20),
    }),
    tag("Great quality, arrived safely, very happy.", 5, "rev-ctb-am-7", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(12),
    }),
    tag("Good tote, no issues.", 4, "rev-ctb-am-8", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(5),
    }),
    tag("Love this tote, use it every day.", 5, "rev-ctb-sh-1", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(60),
    }),
    tag("Great bag for the price.", 5, "rev-ctb-sh-2", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteBlack,
      date: ago(15),
    }),

    // Linen Tote Natural — good on Shopify, and the Amazon reviews are about
    // delivery time and packaging, never the product itself.
    tag("Beautiful natural linen, exactly as pictured.", 4, "rev-ltn-sh-1", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(85),
    }),
    tag("Love the color and the fabric feels premium.", 5, "rev-ltn-sh-2", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(60),
    }),
    tag("Great tote, a bit smaller than I expected but still lovely.", 4, "rev-ltn-sh-3", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(30),
    }),
    tag("Perfect everyday bag, gets compliments constantly.", 5, "rev-ltn-sh-4", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(10),
    }),
    tag("Bag is fine but took almost 3 weeks to arrive.", 3, "rev-ltn-am-1", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(75),
    }),
    tag("Nice tote, shipping was slower than expected.", 4, "rev-ltn-am-2", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(50),
    }),
    tag("Product is okay, box was pretty beat up though.", 3, "rev-ltn-am-3", {
      channel: "amazon",
      kind: "product_review",
      product: PRODUCTS.toteLinen,
      date: ago(25),
    }),
    tag(
      "Good quality tote, delivery just took longer than other Amazon orders.",
      4,
      "rev-ltn-am-4",
      { channel: "amazon", kind: "product_review", product: PRODUCTS.toteLinen, date: ago(8) },
    ),

    // Suede Crossbody Bag — a second attribution story, on Shopify, after a
    // supplier switch instead of a packaging change.
    tag("Strap felt a bit flimsy but held up ok.", 3, "rev-scb-sh-1", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(85),
    }),
    tag("Strap tore after light use, disappointing.", 2, "rev-scb-sh-2", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(70),
    }),
    tag("Decent bag, strap could be sturdier.", 3, "rev-scb-sh-3", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(55),
    }),
    tag("New strap is so much sturdier, love it.", 5, "rev-scb-sh-4", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(25),
    }),
    tag("Great bag, strap feels solid now.", 4, "rev-scb-sh-5", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(15),
    }),
    tag("Nice crossbody, holds up well.", 4, "rev-scb-sh-6", {
      channel: "shopify",
      kind: "product_review",
      product: PRODUCTS.crossbody,
      date: ago(5),
    }),

    // Amazon seller feedback — genuinely available via the Feedback API, and
    // genuinely not about any one product. Kept visually and semantically
    // separate from the product reviews above, per the issue.
    tag("Fast shipping, item as described. Would buy again.", 5, "fb-am-1", {
      channel: "amazon",
      kind: "seller_feedback",
      date: ago(25),
    }),
    tag("Good communication, minor delay in dispatch.", 4, "fb-am-2", {
      channel: "amazon",
      kind: "seller_feedback",
      date: ago(18),
    }),
    tag("Excellent seller, no issues at all.", 5, "fb-am-3", {
      channel: "amazon",
      kind: "seller_feedback",
      date: ago(10),
    }),
    tag("Order took a bit longer than expected but got there.", 3, "fb-am-4", {
      channel: "amazon",
      kind: "seller_feedback",
      date: ago(3),
    }),
  ];

  const opsNotes: OpsNote[] = [
    {
      id: "note-packaging-ctb",
      date: ago(35),
      category: "packaging",
      note: "Switched to a reinforced shipping box with corner protectors for all tote bags, after repeated reports of corner-crush damage in transit.",
      product: PRODUCTS.toteBlack,
    },
    {
      id: "note-supplier-scb",
      date: ago(50),
      category: "supplier",
      note: "Switched leather supplier for the crossbody line after repeated complaints about strap durability.",
      product: PRODUCTS.crossbody,
    },
  ];

  const positiveAttributions: PositiveAttribution[] = [
    {
      id: "attr-ctb",
      product: PRODUCTS.toteBlack,
      channel: "amazon",
      from: 3.8,
      to: 4.4,
      windowDays: 60,
      opsNoteId: "note-packaging-ctb",
    },
    {
      id: "attr-scb",
      product: PRODUCTS.crossbody,
      channel: "shopify",
      from: 2.7,
      to: 4.3,
      windowDays: 60,
      opsNoteId: "note-supplier-scb",
    },
  ];

  const sellerRating: SellerRating = {
    current: 4.3,
    threshold: 4.0,
    history: [
      { date: ago(30), value: 3.9 },
      { date: ago(24), value: 4.0 },
      { date: ago(18), value: 4.0 },
      { date: ago(12), value: 4.1 },
      { date: ago(6), value: 4.2 },
      { date: ago(0), value: 4.3 },
    ],
  };

  return { reviews, opsNotes, positiveAttributions, sellerRating };
}
