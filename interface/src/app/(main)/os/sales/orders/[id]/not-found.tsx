import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SALES_ORDER_BASE_PATH } from "@/constants/sales-orders";

/** Co-located so a missing order renders inside the OS chrome. Without this,
 * the detail page's notFound() would fall all the way through to the root
 * app/not-found.tsx, which sits outside this layout and drops the sidebar.
 *
 * "Or you can't see it" is not hedging: the endpoint answers the same way for
 * an order that doesn't exist and one this user has no permission to read, and
 * saying which is which would leak the difference. */
export default function SalesOrderNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-semibold text-2xl">Sales order not found.</h1>
      <p className="text-muted-foreground">There is no such order, or you can&apos;t see it.</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href={SALES_ORDER_BASE_PATH}>All Sales Orders</Link>
      </Button>
    </div>
  );
}
