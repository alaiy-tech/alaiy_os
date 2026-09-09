import { requireOnboardedSession } from "@/lib/auth/dal";
import { Alert, Eyebrow } from "@/components/ui";
import { buildMockPnlRows } from "@/lib/profitability/mock-data";
import { BuyBoxPanel } from "./buy-box-panel";
import { PnlTable } from "./pnl-table";

export const metadata = { title: "Profitability — Alaiy" };

/**
 * The Profitability tab: margin per SKU, not just revenue.
 *
 * Every fee and price field the issue names is a real, buildable SP-API or
 * Shopify integration — the Fees API, Financial Events API, Competitive
 * Pricing API, Shopify's own orders and fee data. There is no backend module
 * behind this tab only because none of that is wired up yet.
 *
 * COGS is the one field V1 genuinely cannot fill in, and the issue is
 * explicit that the column should stay visible rather than disappear —
 * see the greyed "Coming soon" cells in the table, and why Net Margin % sits
 * beside Gross Margin % rather than duplicating it: Net is the number that
 * needs COGS, Gross is everything V1 can measure without it.
 */
export default async function ProfitabilityPage() {
  await requireOnboardedSession();

  const rows = buildMockPnlRows();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Profitability</h1>
        <p className="max-w-2xl text-[13px] text-muted">
          Fees, shipping and revenue per SKU — so your top seller and your best margin can turn
          out to be two different products.
        </p>
      </div>

      <Alert tone="info">
        COGS isn&apos;t connected yet — the column below stays visible and says so rather than
        disappearing, because a real build needs lot-level cost per PO line, not one averaged
        number. Until then, Gross Margin % is everything fees and shipping alone can tell you;
        Net Margin % is the figure that actually needs COGS, so it reads &quot;Coming soon&quot;
        too rather than silently repeating Gross.
      </Alert>

      <PnlTable rows={rows} />

      <BuyBoxPanel rows={rows} />
    </div>
  );
}
