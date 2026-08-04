import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DEFAULT_TEMPLATE, TEMPLATE_WIREFRAME } from "@/config/templates";
import { useAskPanel } from "@/contexts/ask-panel-context";

function doctypeToErpnextRoute(doctype: string) {
  return doctype.toLowerCase().replace(/\s+/g, "-");
}

export default function ComingSoonPage({
  title,
  section,
  doctype,
  icon: Icon,
  template = DEFAULT_TEMPLATE,
}: {
  title: string;
  section: string;
  doctype?: string;
  icon: LucideIcon;
  template?: string;
}) {
  const { open: openAsk } = useAskPanel();
  const wireRows = TEMPLATE_WIREFRAME[template] ?? TEMPLATE_WIREFRAME[DEFAULT_TEMPLATE];

  return (
    <div className="max-w-[1440px] px-8 pt-7 pb-14">
      <h1 className="text-[26px] font-semibold tracking-[-.025em] text-ink">{title}</h1>
      <p className="mt-[5px] text-[13px] text-slate">
        {section} · {doctype ?? "—"} doctype
      </p>

      <div className="mt-7 grid grid-cols-1 items-center gap-12 rounded-xl border border-line-subtle bg-background p-11 md:grid-cols-[1fr_1.15fr]">
        <Empty className="items-start p-0 text-left md:p-0">
          <EmptyHeader className="items-start text-left">
            <EmptyMedia variant="icon" className="rounded-[10px] border border-line-subtle bg-paper text-navy">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>{title} is coming soon</EmptyTitle>
            <EmptyDescription>
              The {doctype ?? title} doctype is wired and readable in ERPNext today. This screen isn't designed yet — here's the layout
              it will get, so you can tell whether it needs to move up the queue.
            </EmptyDescription>
            <p className="text-[12.5px] text-ash">
              Planned template: <span className="font-medium text-navy">{template}</span>
            </p>
          </EmptyHeader>
          <EmptyContent className="max-w-none flex-row items-start justify-start">
            {doctype && (
              <Button asChild className="uppercase tracking-[.09em]">
                <a href={`/app/${doctypeToErpnextRoute(doctype)}`} target="_blank" rel="noopener noreferrer">
                  Open in ERPNext
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => openAsk(title)}>
              Ask Alaiy instead
            </Button>
          </EmptyContent>
        </Empty>

        <div className="rounded-[10px] border border-dashed border-line-dashed bg-surface-dashed p-[18px]">
          <div className="text-[10.5px] font-medium tracking-[.09em] text-ash-3 uppercase">Planned layout — wireframe</div>
          <div className="mt-[14px] flex flex-col gap-[10px]">
            {wireRows.map((row, i) => (
              <div
                key={row}
                className="flex items-center rounded-md border border-line-subtle px-3"
                style={{ height: i === 0 || i === wireRows.length - 1 ? 30 : 54, background: i === 0 ? "#F1EDE6" : "#F7F4EF" }}
              >
                <span className="text-[11px] tracking-[.02em] text-ash-3">{row}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
