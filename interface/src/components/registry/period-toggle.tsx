"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";

/** One button in the toggle. `value` is both the button's own text and
 * what's written to/read from the URL - `label` is never shown on the
 * button itself; it's there for another component entirely to reference via
 * its own `data` binding (e.g. a KPI card's `trendLabel`, computed
 * server-side by a `"lookup"` transform step keyed on the same `value` - see
 * `runtime/data/transform-engine.ts`). Components can't read each other's
 * `props` in this runtime, so a page wiring both up (like `/os`'s
 * dashboard) necessarily repeats each `value`'s label in both places -
 * keep them next to each other in `seed.ts` so they don't quietly drift. */
export type PeriodOption = {
  value: string;
  label?: string;
};

/**
 * Self-contained period switcher - reads/writes its own `?<paramName>=`
 * query param, so a Server Component page can read the same value (via
 * `readPeriod(await searchParams)`) with no state threaded between them.
 * Drop it directly into a page.tsx as the PageHeader's `action`.
 *
 * `options` is the full, author-ordered button list (e.g.
 * `[{value:"1D"}, {value:"1W"}, {value:"1M"}, {value:"1Y"}]`) - the *first*
 * entry is the default. Picking it back deletes the param rather than
 * writing it explicitly (mirrors `usePaginationParam`'s own "default value
 * means delete the param" convention), so a page left at its default period
 * keeps a clean URL - and there is no separate `defaultPeriod`/`defaultValue`
 * prop to keep in sync with `options` by hand.
 */
export function OSPeriodToggle({
  paramName = "period",
  options,
}: {
  paramName?: string;
  options: PeriodOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultValue = options[1]?.value;
  const raw = searchParams.get(paramName);
  const period =
    raw && options.some((option) => option.value === raw) ? raw : defaultValue;

  function setPeriod(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === defaultValue) params.delete(paramName);
    else params.set(paramName, next);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <ButtonGroup>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === period ? "default" : "outline"}
          onClick={() => setPeriod(option.value)}
          className="cursor-pointer"
        >
          {option.value}
        </Button>
      ))}
    </ButtonGroup>
  );
}
