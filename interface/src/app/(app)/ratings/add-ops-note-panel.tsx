"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { SlideOver } from "@/components/data/slide-over";
import { Button, Field, Select } from "@/components/ui";
import { isoDate } from "@/lib/dates";
import { OPS_CATEGORY_OPTIONS } from "@/lib/ratings/presentation";
import type { OpsNote, OpsNoteCategory, ProductRef } from "@/lib/ratings/types";

/**
 * The one manual-entry mechanism this tab needs.
 *
 * Reviews themselves are read-only — Amazon's Feedback API and a Shopify
 * review app both sync on their own once wired up. What cannot be synced is
 * *why* a rating moved, so this is how Jordan tells Alaiy about a packaging
 * change or a supplier switch, which the positive-attribution panel then
 * looks for a rating change to explain.
 */
export function AddOpsNotePanel({
  products,
  onClose,
  onCreated,
}: {
  products: ProductRef[];
  onClose: () => void;
  onCreated: (note: OpsNote) => void;
}) {
  const [category, setCategory] = useState<OpsNoteCategory>("packaging");
  const [sku, setSku] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Add a short note about what changed.");
      return;
    }
    setError(null);

    onCreated({
      id: `note-${Date.now()}`,
      date: isoDate(new Date()),
      category,
      note: trimmed,
      product: products.find((product) => product.sku === sku),
    });
  }

  return (
    <SlideOver eyebrow="New" title="Log a business event" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-[12px] leading-snug text-muted">
          A packaging change, a supplier switch, a 3PL change — log it here with today&apos;s date,
          and Alaiy can trace a rating change back to it instead of leaving the two as a
          coincidence.
        </p>

        <Field label="What changed">
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value as OpsNoteCategory)}
            options={OPS_CATEGORY_OPTIONS}
          />
        </Field>

        <Field label="Product" hint="Optional — leave blank for something that isn't product-specific.">
          <Select
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            options={[
              { value: "", label: "Not product-specific" },
              ...products.map((product) => ({ value: product.sku, label: product.title })),
            ]}
          />
        </Field>

        <Field label="Note">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Switched to a reinforced shipping box for tote bags."
            className="w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-muted-soft hover:border-primary-600/40 focus:border-highlight-600"
          />
        </Field>

        {error ? <p className="text-[12px] text-alert-ink">{error}</p> : null}

        <Button type="submit" className="w-full">
          Log event
        </Button>
      </form>
    </SlideOver>
  );
}
