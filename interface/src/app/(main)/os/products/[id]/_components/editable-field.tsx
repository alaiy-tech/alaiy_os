"use client";

import { useId, useState } from "react";

import { useRouter } from "next/navigation";

import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ItemApiError, updateItem } from "@/lib/frappe/item-actions";
import { searchLinkOptions } from "@/lib/frappe/link";
import { cn } from "@/lib/utils";

const EM_DASH = "—";

/** How the value is typed, which decides the control and how the draft is sent.
 * `link` is a Frappe Link field: free text with type-ahead against the target
 * doctype, since the value has to be an existing docname. */
export type EditableKind = "text" | "multiline" | "number" | "link" | "date";

type EditableFieldProps = {
  /** The Item's docname — what the write is addressed to. */
  item: string;
  /** The Frappe fieldname. Must appear in WRITABLE_FIELDS server-side. */
  field: string;
  /** Names the field for assistive tech and for the failure toast. */
  label: string;
  kind: EditableKind;
  /** The stored value, straight off the server render. */
  value: string | number | null;
  /** What to show when not editing, where the raw value is not what a reader
   * wants — a formatted currency, a localised date. Defaults to the value. */
  display?: React.ReactNode;
  /** The Link field's target doctype. Required when kind is "link". */
  linkDoctype?: string;
  /** False when the user cannot write Item: the value renders as plain text
   * with no affordance, rather than a control that would fail on save. */
  canWrite: boolean;
  /** Shown under the control while editing — for a consequence the operator
   * should know about before they save, not after. */
  hint?: string;
  className?: string;
};

/** The draft as a string, which is what every control here edits. Numbers come
 * back from Frappe as numbers and dates as `YYYY-MM-DD`; both round-trip
 * through text without losing anything the field can hold. */
function toDraft(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** The draft as the API should receive it. An emptied number is null rather
 * than 0 — the server decides what empty means for the fieldtype, and sending 0
 * would assert a figure the operator did not type.
 *
 * Typed narrower than ItemFieldValue on purpose: none of the kinds here is a
 * Check, so a boolean can never come out, and keeping it out means the committed
 * value below can be compared against the stored one without a cast. */
function fromDraft(kind: EditableKind, draft: string): string | number | null {
  const trimmed = draft.trim();
  if (kind === "number") return trimmed === "" ? null : Number(trimmed);
  return trimmed === "" ? "" : trimmed;
}

export function EditableField({
  item,
  field,
  label,
  kind,
  value,
  display,
  linkDoctype,
  canWrite,
  hint,
  className,
}: EditableFieldProps) {
  const router = useRouter();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(value));
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  // Bridges the gap between a successful save and the server re-render that
  // follows it: `just` holds what was saved and the value it replaced, so the
  // new value shows immediately and stops overriding the moment the prop
  // catches up. A committed value that lingered would outlast a later edit
  // made from another tab.
  const [just, setJust] = useState<{ from: string | number | null; to: string | number | null } | null>(null);

  const multiline = kind === "multiline";
  const committed = just && just.from === value;
  // The committed value is the one just written, held until the server render
  // catches up. It is shown raw rather than through `display`, which formats the
  // stored value — for the fraction of a second before the refresh lands, that
  // means a rate reads as what was typed rather than as currency.
  const stored = committed ? just.to : value;
  const isEmpty = stored === null || stored === undefined || (typeof stored === "string" && !stored.trim());
  const shown = committed ? just.to : (display ?? value);

  if (!canWrite) {
    return (
      <span className={className}>{isEmpty ? <span className="text-muted-foreground">{EM_DASH}</span> : shown}</span>
    );
  }

  const startEditing = () => {
    setDraft(toDraft(stored));
    setEditing(true);
  };

  const save = async () => {
    const next = fromDraft(kind, draft);
    // Nothing to write, and nothing to report: an operator who opens a field
    // and closes it unchanged has not made a change to fail.
    if (next === (stored ?? (kind === "number" ? null : ""))) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateItem(item, { [field]: next });
      setJust({ from: value, to: next });
      setEditing(false);
      // The page is a Server Component: the status badge, the gallery and the
      // stock state are all derived from this document server-side, so a saved
      // field has to re-render the route rather than just this control.
      router.refresh();
    } catch (error) {
      // Editing stays open with the draft intact. The stored value was never
      // replaced, so there is nothing to roll back — but closing the editor
      // would drop what the operator typed and leave them guessing which
      // value is now live.
      toast.error(error instanceof ItemApiError ? error.message : `Could not save ${label}.`);
    } finally {
      setSaving(false);
    }
  };

  const loadOptions = async (term: string) => {
    if (!linkDoctype) return;
    try {
      const found = await searchLinkOptions(linkDoctype, term);
      setOptions(found.map((option) => option.name));
    } catch {
      // A failed lookup costs the suggestions, not the edit: the field is still
      // free text, and Frappe validates the link on save either way.
    }
  };

  if (!editing) {
    const valueNode = isEmpty ? <span className="text-muted-foreground">{EM_DASH}</span> : shown;

    // A multiline value is a paragraph: it lays out as a block with the pencil
    // beside its first line, must not be truncated the way a single-line value
    // in a table cell is, and cannot be wrapped in the click target below —
    // the description's own "Read more" is a button, and a button inside a
    // button is invalid markup that browsers resolve by dropping one of them.
    return (
      <span
        className={cn(
          "group/edit min-w-0 gap-1.5",
          multiline ? "flex items-start" : "inline-flex items-center",
          className,
        )}
      >
        {multiline ? (
          <span className="min-w-0 flex-1 break-words">{valueNode}</span>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            title={`Edit ${label}`}
            // Wraps rather than truncates: this renders into a page heading as
            // well as into table cells, and a heading that ellipsises its
            // document's name hides the one thing the page is about.
            // break-words is the backstop for a name with no spaces in it.
            className="min-w-0 cursor-text break-words text-left hover:underline hover:decoration-dotted hover:underline-offset-4"
          >
            {valueNode}
          </button>
        )}
        {/* Muted rather than hidden. An affordance that only appears on hover
         * cannot be seen before it is found, is not there at all on a touch
         * screen, and left the page looking read-only — which is exactly how it
         * was read. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${label}`}
          onClick={startEditing}
          className="shrink-0 text-muted-foreground opacity-60 transition-opacity duration-100 focus-visible:opacity-100 group-hover/edit:opacity-100"
        >
          <Pencil />
        </Button>
      </span>
    );
  }

  const control = multiline ? (
    <Textarea
      id={inputId}
      autoFocus
      rows={5}
      value={draft}
      disabled={saving}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setEditing(false);
      }}
    />
  ) : (
    <Input
      id={inputId}
      autoFocus
      // Numbers stay `inputMode`-hinted text rather than type="number": a
      // spinner on a rate is a way to change a price by scrolling past it.
      inputMode={kind === "number" ? "decimal" : undefined}
      type={kind === "date" ? "date" : "text"}
      list={kind === "link" ? `${inputId}-options` : undefined}
      value={draft}
      disabled={saving}
      aria-label={label}
      className="h-7"
      onChange={(event) => {
        setDraft(event.target.value);
        if (kind === "link") void loadOptions(event.target.value);
      }}
      onFocus={() => {
        if (kind === "link" && options.length === 0) void loadOptions("");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") void save();
        if (event.key === "Escape") setEditing(false);
      }}
    />
  );

  return (
    <span className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1">{control}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Save ${label}`}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Spinner /> : <Check />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Cancel editing ${label}`}
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          <X />
        </Button>
      </span>

      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}

      {kind === "link" && (
        <datalist id={`${inputId}-options`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </span>
  );
}
