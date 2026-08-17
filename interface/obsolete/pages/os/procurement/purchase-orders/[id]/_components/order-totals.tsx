import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { Separator } from "@/components/primitive/separator";
import { labelOr } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  PurchaseOrderTax,
  PurchaseOrderTotals,
} from "@/types/purchase-orders";

function Line({
  label,
  value,
  emphasis = false,
  muted = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        emphasis && "font-medium text-base",
      )}
    >
      <span
        className={cn(
          "text-sm",
          muted ? "text-muted-foreground" : "text-foreground",
          emphasis && "text-base",
        )}
      >
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** A tax row's own label: ERPNext lets the buyer type a free-text description
 * per row, and falls back to the account it posts to when they don't. */
function taxLabel(tax: PurchaseOrderTax): string {
  return labelOr(tax.description, labelOr(tax.account_head, "Tax"));
}

export function OrderTotals({
  totals,
  taxes,
  currency,
}: {
  totals: PurchaseOrderTotals;
  taxes: PurchaseOrderTax[];
  currency?: string;
}) {
  const money = (value: number | null | undefined) =>
    formatCurrency(value ?? 0, { currency });

  // ERPNext keeps writing `rounded_total` even when the order opts out of
  // rounding, so the flag decides which figure is the one that counts.
  const isRounded = !totals.disable_rounded_total && !!totals.rounded_total;
  const payable = isRounded ? totals.rounded_total : totals.grand_total;

  const discount = totals.discount_amount ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">
          Taxes &amp; Totals
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Line label="Net Total" value={money(totals.total)} muted />

        {taxes.length > 0 && (
          <>
            <Separator />
            {taxes.map((tax) => (
              <Line
                key={tax.idx}
                label={taxLabel(tax)}
                value={money(tax.tax_amount)}
                muted
              />
            ))}
            <Line
              label="Total Taxes and Charges"
              value={money(totals.total_taxes_and_charges)}
              muted
            />
          </>
        )}

        {discount > 0 && (
          <>
            <Separator />
            <Line
              label={`Discount${totals.apply_discount_on ? ` on ${totals.apply_discount_on}` : ""}`}
              value={`− ${money(discount)}`}
              muted
            />
          </>
        )}

        <Separator />
        <Line
          label="Grand Total"
          value={money(totals.grand_total)}
          emphasis={!isRounded}
          muted={isRounded}
        />

        {isRounded && (
          <Line label="Rounded Total" value={money(payable)} emphasis />
        )}
      </CardContent>
    </Card>
  );
}
