"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A table row that opens its order.
 *
 * The real control is the link on the order number inside it — that is what a
 * keyboard reaches, what a screen reader announces, and what still works with
 * no JavaScript. This adds the thing a seller expects from a table of four
 * hundred rows: that clicking anywhere on one opens it.
 *
 * That is navigation, not state. Every filter, the sort, the page and which
 * order is open still live in the URL, and this component holds nothing —
 * it pushes the same href the link points at.
 *
 * A click that ends a text selection is ignored, because copying an order
 * number out of a table is a thing people do and having the row navigate out
 * from under them is not.
 */
export function OrderRow({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      onClick={(event) => {
        if (window.getSelection()?.toString()) return;
        // The link inside handles its own click, including modified clicks
        // that should open a new tab.
        if ((event.target as HTMLElement).closest("a")) return;
        router.push(href);
      }}
      className={`cursor-pointer transition-colors ${
        selected ? "bg-highlight-100" : "hover:bg-primary-600/[0.04]"
      }`}
    >
      {children}
    </tr>
  );
}
