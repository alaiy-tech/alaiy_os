"use client";

import { Td } from "@/components/data/table";
import { Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { STATUS_PRESENTATION, caseTypeLabel, daysOpen, urgency } from "@/lib/support/cases";
import type { SupportCase } from "@/lib/support/types";

/**
 * One case, opened in the slide-over panel on click.
 *
 * There is no href underneath the way there is on an Orders row — the table
 * is mock data held in the workspace's own state, so a URL to "this case"
 * would resolve to nothing after a reload. The Case ID is still a real
 * button rather than the row's onClick alone, so it stays reachable from the
 * keyboard and is announced as something to activate.
 */
export function CaseRow({
  supportCase,
  selected,
  onOpen,
}: {
  supportCase: SupportCase;
  selected: boolean;
  onOpen: () => void;
}) {
  const status = STATUS_PRESENTATION[supportCase.status];
  const flag = urgency(supportCase);

  return (
    <tr
      onClick={(event) => {
        if (window.getSelection()?.toString()) return;
        if ((event.target as HTMLElement).closest("button")) return;
        onOpen();
      }}
      className={`cursor-pointer transition-colors ${
        selected ? "bg-highlight-100" : "hover:bg-primary-600/[0.04]"
      }`}
    >
      <Td>
        {flag ? (
          <span
            title={
              flag.tone === "alert"
                ? "Amazon auto-closes a case with no seller reply after 7 days."
                : "Nobody has responded to this case in over a week."
            }
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 font-sans text-[11px] font-medium ${
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
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>
      <Td className="font-medium">
        <button
          type="button"
          onClick={onOpen}
          className="whitespace-nowrap underline-offset-2 hover:text-primary-600 hover:underline"
        >
          {supportCase.caseId}
        </button>
      </Td>
      <Td className="max-w-[16rem]">
        <span className="block truncate" title={supportCase.subject}>
          {supportCase.subject}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-muted">{caseTypeLabel(supportCase.type)}</Td>
      <Td>
        <Pill tone={status.tone}>{status.label}</Pill>
      </Td>
      <Td align="right">{daysOpen(supportCase)}</Td>
      <Td className="whitespace-nowrap text-muted">{formatDate(supportCase.lastResponseDate)}</Td>
      <Td>
        {supportCase.draft ? (
          <span className="text-[12px] font-medium text-ok-ink">Ready</span>
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>
    </tr>
  );
}
