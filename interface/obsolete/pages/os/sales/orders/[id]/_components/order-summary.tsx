import Link from "next/link";

import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { Separator } from "@/components/primitive/separator";
import {
  DEFAULT_STATUS_BADGE_CLASS,
  STATUS_BADGE_CLASS,
} from "@/constants/sales-orders";
import { formatDate, labelOr } from "@/lib/format";
import { isDeliveryPastDue } from "@/lib/sales-orders";
import { cn } from "@/lib/utils";
import type { SalesOrderHeader } from "@/types/sales-orders";

import { OrderProgress } from "./order-progress";

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

export function OrderSummary({
  order,
  deliveryNoteCount,
  invoiceCount,
}: {
  order: SalesOrderHeader;
  deliveryNoteCount: number;
  invoiceCount: number;
}) {
  const pastDue = isDeliveryPastDue(order.delivery_date, order.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">
          Order
        </CardTitle>
        <CardDescription className="text-foreground text-xl leading-none tracking-tight">
          {/* The customer's own page doesn't exist yet (#114), so this goes out
              to the desk record — see the /os/open route handler. */}
          <Link
            href={`/os/open/customer/${encodeURIComponent(order.customer)}`}
            className="underline-offset-4 hover:underline"
          >
            {labelOr(order.customer_name, order.customer)}
          </Link>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          <Field label="Customer">{order.customer}</Field>
          <Field label="Order Date">{formatDate(order.transaction_date)}</Field>
          <Field label="Delivery Date">
            <span
              className={cn(
                "inline-flex rounded px-1.5 py-0.5",
                pastDue && "bg-warning/15 font-medium text-warning-foreground",
              )}
              title={pastDue ? "Delivery is past due" : undefined}
            >
              {formatDate(order.delivery_date)}
            </span>
          </Field>
          {order.po_no && <Field label="Customer PO">{order.po_no}</Field>}
          {order.sales_channel && (
            <Field label="Channel">{order.sales_channel}</Field>
          )}
        </div>

        <Separator />

        <OrderProgress
          order={order}
          deliveryNoteCount={deliveryNoteCount}
          invoiceCount={invoiceCount}
        />
      </CardContent>
    </Card>
  );
}
