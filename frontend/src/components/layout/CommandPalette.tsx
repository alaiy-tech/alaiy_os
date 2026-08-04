import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Package, Sparkles, User } from "lucide-react";
import { useSearch } from "frappe-react-sdk";

import { flattenNavItems, settingsItem } from "@/config/navigation";
import { useAskPanel } from "@/contexts/ask-panel-context";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const RECORD_ICON = { Item: Package, "Sales Order": FileText, Customer: User } as const;

/** Live cross-doctype record search for the palette's "Records" group - real backend hits, not seeded examples. */
function useRecordMatches(query: string) {
  const item = useSearch("Item", query, [], 3);
  const order = useSearch("Sales Order", query, [], 3);
  const customer = useSearch("Customer", query, [], 3);
  if (!query.trim()) return [];
  return [
    ...(item.data?.message ?? []).map((r) => ({ ...r, doctype: "Item" as const })),
    ...(order.data?.message ?? []).map((r) => ({ ...r, doctype: "Sales Order" as const })),
    ...(customer.data?.message ?? []).map((r) => ({ ...r, doctype: "Customer" as const })),
  ];
}

const ASK_SUGGESTIONS = [
  { label: "Which SKUs will stock out this week?", hint: "AI" },
  { label: "Draft a reorder for Havelock Retail", hint: "Agent" },
];

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { open: openAsk } = useAskPanel();
  const [query, setQuery] = useState("");
  const records = useRecordMatches(query);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (path: string) => {
    navigate(path ? `/${path}` : "/");
    onOpenChange(false);
  };

  const goRecord = (doctype: keyof typeof RECORD_ICON, value: string) => {
    if (doctype === "Item") navigate(`/products/${encodeURIComponent(value)}`);
    if (doctype === "Sales Order") navigate(`/sales-orders/${encodeURIComponent(value)}`);
    if (doctype === "Customer") navigate(`/customers/${encodeURIComponent(value)}`);
    onOpenChange(false);
  };

  const screens = [...flattenNavItems(), settingsItem];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search screens, orders, customers…" />
      <CommandList>
        <CommandEmpty>No matches for “{query}”</CommandEmpty>

        {records.length > 0 && (
          <CommandGroup heading="Records">
            {records.map((r) => {
              const Icon = RECORD_ICON[r.doctype];
              return (
                <CommandItem key={`${r.doctype}:${r.value}`} value={`record ${r.label}`} onSelect={() => goRecord(r.doctype, r.value)}>
                  <Icon />
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-xs text-ash">{r.doctype}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading="Go to screen">
          {screens.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.label + item.path} value={`${item.label} screen`} onSelect={() => go(item.path)}>
                <Icon />
                <span className="flex-1 truncate">{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {!query && (
          <CommandGroup heading="Ask Alaiy">
            {ASK_SUGGESTIONS.map((s) => (
              <CommandItem key={s.label} value={s.label} onSelect={() => { onOpenChange(false); openAsk(); }}>
                <Sparkles />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="text-xs text-ash">{s.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
