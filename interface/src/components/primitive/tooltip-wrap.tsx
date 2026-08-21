"use client";

import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/primitive/tooltip";

/** Wraps a single trigger element in a Tooltip; skips the tooltip machinery entirely when there's no label. */
export function TooltipWrap({
  label,
  children,
}: {
  readonly label?: ReactNode;
  readonly children: ReactNode;
}) {
  if (!label) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
