"use client";

import { useState } from "react";
import { Alert, Button, Eyebrow, pressClass } from "@/components/ui";
import { EmptyRow, TableFrame, Th } from "@/components/data/table";
import { Figure, TotalsBar } from "@/components/data/summary";
import { FilterField, FilterInput, FilterSelect } from "@/components/data/toolbar";
import { formatNumber } from "@/lib/format";
import { CASE_TYPES, sortByUrgency, urgency } from "@/lib/support/cases";
import type { CaseType, SupportCase } from "@/lib/support/types";
import { AddCasePanel } from "./add-case-panel";
import { CasePanel } from "./case-panel";
import { CaseRow } from "./case-row";

/**
 * The Support tab's state and layout.
 *
 * A client component holding the case list itself, unlike Orders and
 * Inventory, which keep everything in the URL and let the server do the
 * filtering. Those tabs can do that because a real backend paginates and
 * filters real rows; this tab has seven mock cases and a form that adds more
 * to a list that exists nowhere but this component's own state, so there is
 * nothing for a URL-driven filter to survive a reload *of*. The one thing
 * still worth a plain callback-driven panel rather than a link is the
 * detail view, and that is what SlideOver is for.
 */
export function SupportWorkspace({ initialCases }: { initialCases: SupportCase[] }) {
  const [cases, setCases] = useState(initialCases);
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CaseType | "">("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const active = cases.filter((c) => c.status !== "resolved");
  const resolved = cases.filter((c) => c.status === "resolved");
  const pendingSeller = active.filter((c) => c.status === "pending_seller");
  const attentionCount = active.filter((c) => urgency(c)).length;

  const scoped = tab === "resolved" ? resolved : active;
  const filtered = scoped.filter((c) => {
    if (type && c.type !== type) return false;
    if (attentionOnly && !urgency(c)) return false;
    if (search) {
      const query = search.toLowerCase();
      if (!c.caseId.toLowerCase().includes(query) && !c.subject.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });
  const rows = tab === "resolved" ? filtered : sortByUrgency(filtered);

  const openCase = cases.find((c) => c.caseId === openCaseId) ?? null;
  const isFiltered = Boolean(search || type || attentionOnly);

  function openCasePanel(caseId: string) {
    setAdding(false);
    setOpenCaseId(caseId);
  }

  function handleCreated(created: SupportCase) {
    setCases((current) => [created, ...current]);
    setAdding(false);
    setOpenCaseId(created.caseId);
  }

  function handleUpdate(caseId: string, patch: Partial<SupportCase>) {
    setCases((current) => current.map((c) => (c.caseId === caseId ? { ...c, ...patch } : c)));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1.5">
          <Eyebrow>Your data</Eyebrow>
          <h1 className="text-display-md">Support</h1>
          <p className="text-[13px] text-muted">
            Every Amazon Seller Support case you&apos;re tracking, with a draft ready to copy into
            Seller Central — so replying never starts from a blank page.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            setOpenCaseId(null);
            setAdding(true);
          }}
        >
          Add case
        </Button>
      </div>

      <Alert tone="info">
        Amazon doesn&apos;t give sellers a way to list or read Seller Support cases automatically
        yet, so nothing below syncs on its own. Add a case with its Case ID and subject, and Alaiy
        drafts a reply from your orders, listings and inventory data — you copy that into Seller
        Central yourself; Alaiy never posts on your behalf.
      </Alert>

      <TotalsBar>
        <Figure value={formatNumber(active.length)} label="open cases" />
        <Figure value={formatNumber(pendingSeller.length)} label="waiting on you" />
        <button
          type="button"
          onClick={() => {
            setTab("active");
            setAttentionOnly((value) => !value);
          }}
          title="Idle more than 7 days, or within 2 days of Amazon's auto-close."
          className={`ml-auto rounded-xs border px-2.5 py-1 text-[12px] font-medium transition-colors ${
            attentionCount
              ? "border-alert/40 bg-alert-soft text-alert-ink hover:border-alert"
              : "border-ok/30 bg-ok-soft text-ok-ink hover:border-ok"
          }`}
        >
          {!attentionCount
            ? "Nothing needs attention"
            : attentionOnly
              ? `Showing ${formatNumber(attentionCount)} that need attention`
              : `${formatNumber(attentionCount)} need attention`}
        </button>
      </TotalsBar>

      <StatusTabs
        active={tab}
        resolvedCount={resolved.length}
        onChange={(next) => {
          setTab(next);
          setAttentionOnly(false);
        }}
      />

      <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
        <FilterField label="Search" className="min-w-[13rem] flex-1">
          <FilterInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Case ID or subject"
          />
        </FilterField>
        <FilterField label="Type">
          <FilterSelect
            value={type}
            onChange={(event) => setType(event.target.value as CaseType | "")}
            options={[{ value: "", label: "Any" }, ...CASE_TYPES]}
          />
        </FilterField>
        {isFiltered ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setType("");
              setAttentionOnly(false);
            }}
            className={pressClass({ ground: "quiet", size: "sm" })}
          >
            Clear
          </button>
        ) : null}
      </div>

      <TableFrame minWidth="60rem">
        <thead>
          <tr>
            <Th>Urgency</Th>
            <Th>Case ID</Th>
            <Th>Subject</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th align="right">Days open</Th>
            <Th>Last response</Th>
            <Th>AI draft</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              {tab === "resolved"
                ? "No resolved cases yet — they land here once you mark one resolved."
                : isFiltered
                  ? "No cases match those filters."
                  : "No open cases. Add one with its Case ID and subject to start tracking it."}
            </EmptyRow>
          ) : (
            rows.map((supportCase) => (
              <CaseRow
                key={supportCase.caseId}
                supportCase={supportCase}
                selected={supportCase.caseId === openCaseId}
                onOpen={() => openCasePanel(supportCase.caseId)}
              />
            ))
          )}
        </tbody>
      </TableFrame>

      {openCase ? (
        <CasePanel
          key={openCase.caseId}
          supportCase={openCase}
          onClose={() => setOpenCaseId(null)}
          onUpdate={(patch) => handleUpdate(openCase.caseId, patch)}
        />
      ) : null}

      {adding ? <AddCasePanel onClose={() => setAdding(false)} onCreated={handleCreated} /> : null}
    </div>
  );
}

/** All / Resolved, the same tab visuals as Orders' channel filter — a status
 *  archive rather than a channel, but the same "one click, always visible"
 *  reasoning applies: it is the one split every seller checks constantly. */
function StatusTabs({
  active,
  resolvedCount,
  onChange,
}: {
  active: "active" | "resolved";
  resolvedCount: number;
  onChange: (next: "active" | "resolved") => void;
}) {
  const tabs: { value: "active" | "resolved"; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "resolved", label: resolvedCount ? `Resolved (${resolvedCount})` : "Resolved" },
  ];

  return (
    <nav
      aria-label="Filter by status"
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-sm border border-line bg-surface p-1"
    >
      {tabs.map((tab) => {
        const current = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-current={current ? "page" : undefined}
            className={`rounded-xs px-3.5 py-1.5 text-[13px] transition-colors ${
              current
                ? "bg-primary-600 font-semibold text-white"
                : "text-muted hover:bg-primary-600/5 hover:text-primary-600"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
