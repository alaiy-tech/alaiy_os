"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A table row that opens the thing it describes.
 *
 * The real control is the link inside it — on the order number, on the listing
 * title — and that is what a keyboard reaches, what a screen reader announces,
 * and what still works with no JavaScript. This adds the thing a seller
 * expects from a table of four hundred rows: that clicking anywhere on one
 * opens it.
 *
 * That is navigation, not state. Every filter, the sort, the page and which
 * row is open still live in the URL, and this component holds nothing — it
 * pushes the same href the link points at. Which also means a row whose href
 * closes it (an open row, on a tab where the panel toggles) closes from a
 * click anywhere, exactly as its own link does.
 *
 * A click that ends a text selection is ignored, because copying an order
 * number or a SKU out of a table is a thing people do and having the row
 * navigate out from under them is not.
 */
export function ClickableRow({
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
        // The links inside handle their own clicks, including modified clicks
        // that should open a new tab, and the ones that leave for the channel.
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
