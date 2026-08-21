import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { cn } from "@/lib/utils";

/** The `os-card` registry entry - generic shadcn chrome with no page-specific
 * logic. Used to wrap a single child component under a titled card, exactly
 * the way `/os`'s `kpi-strip.tsx` wraps `SalesOverviewChart` today (`Card` >
 * `CardHeader` with a title + decorative arrow > `CardContent`). */
export function OsCard({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={cn("h-full", className)}>
      {title ? (
        <CardHeader>
          <CardTitle className="font-normal">{title}</CardTitle>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
