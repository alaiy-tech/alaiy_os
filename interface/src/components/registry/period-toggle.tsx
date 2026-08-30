"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";

/**
 * Self-contained period switcher - reads/writes its own `?<paramName>=`
 * query param, so a Server Component page can read the same value (via
 * `readPeriod(await searchParams)`) with no state threaded between them.
 * Drop it directly into a page.tsx as the PageHeader's `action`.
 *
 * `options` is the full, author-ordered button list (e.g.
 * `["1D","1W","1M","1Y"]`) - the *first* entry is the default. Picking it
 * back deletes the param rather than writing it explicitly (mirrors
 * `usePaginationParam`'s own "default value means delete the param"
 * convention), so a page left at its default period keeps a clean URL - and
 * there is no separate `defaultPeriod`/`defaultValue` prop to keep in sync
 * with `options` by hand.
 */
export function OSPeriodToggle({
  paramName = "period",
  options,
}: {
  paramName?: string;
  options: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultOption = options[0];
  const raw = searchParams.get(paramName);
  const period = raw && options.includes(raw) ? raw : defaultOption;

  function setPeriod(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === defaultOption) params.delete(paramName);
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
          key={option}
          type="button"
          size="sm"
          variant={option === period ? "default" : "outline"}
          onClick={() => setPeriod(option)}
        >
          {option}
        </Button>
      ))}
    </ButtonGroup>
  );
}
