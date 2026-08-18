"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Ban, Check, FileText, Printer, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/primitive/alert-dialog";
import { Button } from "@/components/primitive/button";
import { Spinner } from "@/components/primitive/spinner";
import { salesOrderHref } from "@/constants/sales-orders";
import {
  amendSalesOrder,
  cancelSalesOrder,
  makeDeliveryNote,
  makeSalesInvoice,
  submitSalesOrder,
} from "@/lib/frappe/sales-order-actions";

/** Which actions a Sales Order offers is decided by its docstatus, not its
 * status: "To Deliver and Bill" and "On Hold" are both submitted orders and
 * take the same actions, while a draft and a cancelled order share none of
 * them. Print is the one action every state has. */
export function OrderActions({
  name,
  docstatus,
}: {
  name: string;
  docstatus: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const busy = pending !== null;

  /** Every action either changes the order in place or creates a document from
   * it, so each one ends by refreshing the server-rendered page rather than
   * patching local state — the header, progress strip, linked tables and the
   * action set itself all move together, and re-reading is both simpler and
   * the only way the linked-document tables can be right. */
  async function run(
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setPending(key);
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setPending(null);
    }
  }

  async function createAndOpen(
    key: string,
    action: () => Promise<{ name: string; doctype: string }>,
    label: string,
  ) {
    setPending(key);
    try {
      const created = await action();
      toast.success(`${label} ${created.name} created as a draft.`);
      // The document lands as a draft for the user to check, so they are taken
      // straight to it. Neither doctype has a page in this app yet — see the
      // /os/open handler for why that is a redirect out to the desk.
      router.push(
        `/os/open/${created.doctype.toLowerCase().replace(/\s+/g, "-")}/${encodeURIComponent(created.name)}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      setPending(null);
    }
  }

  function icon(key: string, fallback: React.ReactNode) {
    return pending === key ? <Spinner /> : fallback;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {docstatus === 0 && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            run(
              "submit",
              () => submitSalesOrder(name),
              `${name} was submitted.`,
            )
          }
        >
          {icon("submit", <Check />)} Submit
        </Button>
      )}

      {docstatus === 1 && (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              createAndOpen(
                "delivery-note",
                () => makeDeliveryNote(name),
                "Delivery Note",
              )
            }
          >
            {icon("delivery-note", <Truck />)} Create Delivery Note
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              createAndOpen(
                "sales-invoice",
                () => makeSalesInvoice(name),
                "Sales Invoice",
              )
            }
          >
            {icon("sales-invoice", <FileText />)} Create Sales Invoice
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmingCancel(true)}
          >
            {icon("cancel", <Ban />)} Cancel
          </Button>
        </>
      )}

      {docstatus === 2 && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            run(
              "amend",
              async () => {
                const amended = await amendSalesOrder(name);
                router.push(salesOrderHref(amended.name));
              },
              "A new draft was opened from this order.",
            )
          }
        >
          {icon("amend", <RotateCcw />)} Amend
        </Button>
      )}

      <Button asChild variant="outline" size="sm">
        <a
          href={`${salesOrderHref(name)}/print`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer /> Print
        </a>
      </Button>

      <AlertDialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This reverses the order in ERPNext — reserved stock is released
              and the order stops counting toward your sales figures. It can be
              amended into a new draft afterwards, but not un-cancelled. Any
              submitted delivery note or invoice raised against it has to be
              cancelled first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                setConfirmingCancel(false);
                void run(
                  "cancel",
                  () => cancelSalesOrder(name),
                  `${name} was cancelled.`,
                );
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
