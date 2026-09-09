"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Pill, Select, pressClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  STATUS_OPTIONS,
  STATUS_PRESENTATION,
  caseTypeLabel,
  daysOpen,
  isoDate,
  urgency,
} from "@/lib/support/cases";
import type { CaseStatus, SupportCase } from "@/lib/support/types";
import { SlideOver } from "@/components/data/slide-over";

/**
 * One case, slid in over the table.
 *
 * The parent keys this by `caseId` (see support-workspace.tsx), so opening a
 * different case remounts it rather than leaving the previous one's draft
 * text and tone selection on screen — the same trick Home uses to keep a
 * chat's state from leaking into the next one.
 */
export function CasePanel({
  supportCase,
  onClose,
  onUpdate,
}: {
  supportCase: SupportCase;
  onClose: () => void;
  onUpdate: (patch: Partial<SupportCase>) => void;
}) {
  return (
    <SlideOver eyebrow="Case" title={supportCase.caseId} onClose={onClose}>
      <Body supportCase={supportCase} onUpdate={onUpdate} />
    </SlideOver>
  );
}

function Body({
  supportCase,
  onUpdate,
}: {
  supportCase: SupportCase;
  onUpdate: (patch: Partial<SupportCase>) => void;
}) {
  const [tone, setTone] = useState<"standard" | "formal">("standard");
  const [draftText, setDraftText] = useState(supportCase.draft?.standard ?? "");
  const [copied, setCopied] = useState(false);

  const status = STATUS_PRESENTATION[supportCase.status];
  const flag = urgency(supportCase);

  function selectTone(next: "standard" | "formal") {
    setTone(next);
    if (supportCase.draft) setDraftText(supportCase.draft[next]);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser. The textarea above it
      // is still there to select and copy by hand.
    }
  }

  function markSent() {
    onUpdate({
      status: "pending_amazon",
      lastResponseBy: "seller",
      lastResponseDate: isoDate(new Date()),
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="text-[12px] text-muted">{caseTypeLabel(supportCase.type)}</span>
        {flag ? (
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 text-[11px] font-medium ${
              flag.tone === "alert"
                ? "border-alert/40 bg-alert-soft text-alert-ink"
                : "border-warn/40 bg-warn-soft text-warn-ink"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${flag.tone === "alert" ? "bg-alert" : "bg-warn"}`}
            />
            {flag.label}
          </span>
        ) : null}
      </div>

      <p className="text-[13.5px] font-medium leading-snug text-ink">{supportCase.subject}</p>

      <Facts>
        <Fact label="Opened">{formatDate(supportCase.openedDate)}</Fact>
        <Fact label="Days open">{daysOpen(supportCase)}</Fact>
        <Fact label="Last response">{formatDate(supportCase.lastResponseDate)}</Fact>
        <Fact label="Reference">{supportCase.orderRef || supportCase.asin || "—"}</Fact>
      </Facts>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Status
        </span>
        <Select
          value={supportCase.status}
          onChange={(event) => onUpdate({ status: event.target.value as CaseStatus })}
          options={STATUS_OPTIONS}
        />
        <span className="block text-[11px] text-muted-soft">
          Nothing syncs from Seller Central yet — set this yourself as the case moves.
        </span>
      </label>

      {supportCase.notes ? (
        <p className="rounded-sm border border-line bg-surface px-3.5 py-2.5 text-[12.5px] leading-snug text-muted">
          {supportCase.notes}
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Thread
        </h3>
        <ul className="space-y-2.5 rounded-sm border border-line bg-white px-3.5 py-3">
          {supportCase.thread.map((message, index) => (
            <li key={index} className="text-[12.5px] leading-snug">
              <p>
                <span
                  className={`font-medium ${message.from === "amazon" ? "text-warn-ink" : "text-primary-600"}`}
                >
                  {message.from === "amazon" ? "Amazon" : "You"}
                </span>{" "}
                <span className="text-muted-soft">· {formatDate(message.date)}</span>
              </p>
              <p className="text-muted">{message.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] leading-snug text-muted-soft">
          Amazon&apos;s Seller Support API does not expose case threads yet, so this is only what
          has been typed in here — not a live copy of Seller Central.
        </p>
      </section>

      {supportCase.draft ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
              AI-drafted response
            </h3>
            <div className="flex gap-1 rounded-sm border border-line bg-surface p-0.5">
              <ToneButton active={tone === "standard"} onClick={() => selectTone("standard")}>
                Standard
              </ToneButton>
              <ToneButton active={tone === "formal"} onClick={() => selectTone("formal")}>
                Formal
              </ToneButton>
            </div>
          </div>
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={10}
            className="w-full rounded-sm border border-line bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink transition-colors focus:border-highlight-600"
          />
          <p className="text-[11.5px] leading-snug text-muted-soft">
            Not sent automatically — copy this into Seller Central yourself.
          </p>
          <button
            type="button"
            onClick={copyDraft}
            className={`${pressClass({ size: "sm" })} w-full`}
          >
            {copied ? "Copied" : "Copy draft"}
          </button>
        </section>
      ) : (
        <p className="text-[12px] text-muted">
          No draft yet — add an order, shipment or ASIN reference and Alaiy has something concrete
          to write from.
        </p>
      )}

      {supportCase.status !== "resolved" ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {supportCase.status !== "pending_amazon" ? (
            <Button size="sm" onClick={markSent}>
              Copied it — mark as sent
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => onUpdate({ status: "resolved" })}
            className={pressClass({ ground: "quiet", size: "sm" })}
          >
            Resolve case
          </button>
        </div>
      ) : null}
    </>
  );
}

function ToneButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xs px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
        active ? "bg-primary-600 text-white" : "text-muted hover:text-primary-600"
      }`}
    >
      {children}
    </button>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-sm border border-line bg-white px-3.5 py-3">
      {children}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </dt>
      <dd className="font-data text-[13px] text-ink">{children}</dd>
    </div>
  );
}
