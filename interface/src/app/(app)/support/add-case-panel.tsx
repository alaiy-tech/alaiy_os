"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import { CASE_TYPES, isoDate } from "@/lib/support/cases";
import { buildDraft } from "@/lib/support/draft";
import type { CaseType, SupportCase } from "@/lib/support/types";
import { SlideOver } from "@/components/data/slide-over";

/**
 * The V1 way a case gets into Alaiy at all.
 *
 * Amazon's SP-API has no endpoint to list or read Seller Support cases, so
 * this manual form is the primary mechanism the issue describes, not a
 * fallback for when the API happens to be down. Case ID and subject are the
 * only things Jordan must supply; everything else sharpens the draft.
 */
export function AddCasePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created: SupportCase) => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<CaseType>("general");
  const [orderRef, setOrderRef] = useState("");
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedCaseId = caseId.trim();
    const trimmedSubject = subject.trim();
    if (!trimmedCaseId || !trimmedSubject) {
      setError("Case ID and subject are both needed before Alaiy can draft a reply.");
      return;
    }
    setError(null);
    setDrafting(true);

    // There is no backend call to await here — this stands in for the
    // couple of seconds Alaiy would spend reading order, listing and
    // inventory data before writing a draft, so the button does not just
    // flash and the panel does not feel like it skipped a step.
    setTimeout(() => {
      const today = isoDate(new Date());
      const trimmedOrderRef = orderRef.trim() || undefined;
      const trimmedNotes = notes.trim() || undefined;

      onCreated({
        caseId: trimmedCaseId,
        subject: trimmedSubject,
        type,
        status: "open",
        openedDate: today,
        orderRef: trimmedOrderRef,
        notes: trimmedNotes,
        thread: [{ from: "seller", date: today, text: trimmedSubject }],
        draft: buildDraft({
          caseId: trimmedCaseId,
          subject: trimmedSubject,
          type,
          orderRef: trimmedOrderRef,
          notes: trimmedNotes,
        }),
      });
    }, 900);
  }

  return (
    <SlideOver eyebrow="New" title="Add a case" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[12px] leading-snug text-muted">
          Amazon doesn&apos;t give us a way to pull this in automatically — enter what Seller
          Central shows, and Alaiy drafts a reply from your orders, listings and inventory data.
        </p>

        <Field label="Case ID">
          <Input
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
            placeholder="14981-22843"
            required
          />
        </Field>

        <Field label="Subject">
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="FBA inventory discrepancy — 45 units missing"
            required
          />
        </Field>

        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as CaseType)}
            options={CASE_TYPES}
          />
        </Field>

        <Field
          label="Order, shipment or ASIN"
          hint="Optional — gives Alaiy something concrete to reference in the draft."
        >
          <Input
            value={orderRef}
            onChange={(event) => setOrderRef(event.target.value)}
            placeholder="FBA15JKPL382"
          />
        </Field>

        <Field label="Notes" hint="Optional context Amazon's own notice doesn't cover.">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-muted-soft hover:border-primary-600/40 focus:border-highlight-600"
          />
        </Field>

        {error ? <p className="text-[12px] text-alert-ink">{error}</p> : null}

        <Button type="submit" disabled={drafting} className="w-full">
          {drafting ? <Spinner /> : null}
          {drafting ? "Drafting a response…" : "Add case and draft a reply"}
        </Button>
      </form>
    </SlideOver>
  );
}
