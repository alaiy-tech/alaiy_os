import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PRODUCT_BASE_PATH } from "@/constants/products";

/** Co-located so a missing item renders inside the OS chrome. Without this,
 * the detail page's notFound() would fall all the way through to the root
 * app/not-found.tsx, which sits outside this layout and drops the sidebar.
 *
 * "Or you can't see it" is not hedging: the endpoint answers the same way for
 * an item that doesn't exist and one this user has no permission to read, and
 * saying which is which would leak the difference. */
export default function ItemNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-semibold text-2xl">Item not found.</h1>
      <p className="text-muted-foreground">There is no such item, or you can&apos;t see it.</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href={PRODUCT_BASE_PATH}>All Products</Link>
      </Button>
    </div>
  );
}
