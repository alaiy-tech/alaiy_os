"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/utils";

import { PERIODS, type Period, readPeriod } from "../derived/list/period";

/** Self-contained period switcher - reads/writes its own `?period=` query
 * param, so a Server Component page can read the same value (via
 * `readPeriod(await searchParams)`) with no state threaded between them.
 * Drop it directly into a page.tsx as the PageHeader's `action`. */
export function OSPeriodToggle({
  paramName = "period",
  defaultPeriod = "1M" as Period,
}: {
  paramName?: string;
  defaultPeriod?: Period;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = readPeriod(
    Object.fromEntries(searchParams.entries()),
    paramName,
    defaultPeriod,
  );

  function setPeriod(next: Period) {
    const params = new URLSearchParams(searchParams);
    params.set(paramName, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPeriod(p)}
          className={cn(
            "rounded px-2 py-0.5 font-medium text-xs transition-colors",
            p === period
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
