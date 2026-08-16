import { Settings2 } from "lucide-react";

import { DashboardFilters } from "@/app/(main)/os/_components/dashboard-filters";
import { Button } from "@/components/primitive/button";
import { Separator } from "@/components/primitive/separator";

/** The dashboard registry's `os-filter-bar` component. `/os/page.tsx` places
 * the period and channel selects beside a vertical separator and a
 * (non-functional) settings icon button, all as siblings inside one flex
 * row. Rather than inventing a semantic type for two purely decorative,
 * non-interactive elements, this wrapper reproduces that exact trio - the
 * real `DashboardFilters` client component is reused as-is; nothing about
 * its filter/URL-param behaviour is touched. */
export function FilterBarNode({ channels }: { channels: string[] }) {
  return (
    <>
      <DashboardFilters channels={channels} />
      <Separator orientation="vertical" />
      <Button size="icon-sm" variant="outline">
        <Settings2 />
      </Button>
    </>
  );
}
