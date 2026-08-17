import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { Progress } from "@/components/primitive/progress";
import {
  DEFAULT_STATUS_BADGE_CLASS,
  STATUS_BADGE_CLASS,
} from "@/constants/purchase-orders";
import { formatDate, labelOr } from "@/lib/format";
import { isReceiptPastDue } from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";
import type { PurchaseOrderHeader } from "@/types/purchase-orders";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

/** `per_received`/`per_billed` are maintained by ERPNext as it posts receipts
 * and invoices, so they are read rather than recomputed from the lines — the
 * order's own view of its progress is the one the rest of ERPNext acts on.
 * Clamped for display only: an over-receipt within tolerance can push these
 * past 100, which a progress bar cannot draw. */
function ProgressField({
  label,
  percent,
}: {
  label: string;
  percent: number | null;
}) {
  const value = Math.min(Math.max(percent ?? 0, 0), 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-sm tabular-nums">
          {(percent ?? 0).toFixed(0)}%
        </span>
      </div>
      <Progress value={value} />
    </div>
  );
}

export function OrderSummary({ order }: { order: PurchaseOrderHeader }) {
  const pastDue = isReceiptPastDue(order.schedule_date, order.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">
          Order
        </CardTitle>
        <CardDescription className="text-foreground text-xl leading-none tracking-tight">
          {labelOr(order.supplier_name, order.supplier)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <Badge
              variant="outline"
              className={cn(
                "border-0 font-medium",
                STATUS_BADGE_CLASS[order.status] ?? DEFAULT_STATUS_BADGE_CLASS,
              )}
            >
              {order.status}
            </Badge>
          </Field>
          <Field label="Supplier">{order.supplier}</Field>
          <Field label="Order Date">{formatDate(order.transaction_date)}</Field>
          <Field label="Expected Date">
            <span
              className={cn(
                "inline-flex rounded px-1.5 py-0.5",
                pastDue && "bg-warning/15 font-medium text-warning-foreground",
              )}
              title={pastDue ? "Receipt is past due" : undefined}
            >
              {formatDate(order.schedule_date)}
            </span>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ProgressField label="Received" percent={order.per_received} />
          <ProgressField label="Billed" percent={order.per_billed} />
        </div>
      </CardContent>
    </Card>
  );
}
