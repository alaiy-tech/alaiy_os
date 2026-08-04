import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Variants mirror the five status-pill tones defined in lib/status.ts -
// exact shape/sizing from the design (pill, 11.5px medium, 3px/9px padding).
const badgeVariants = cva("inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11.5px] font-medium", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border border-border text-foreground",
      success: "bg-success-bg text-success-fg",
      warning: "bg-warning-bg text-warning-fg",
      info: "bg-info-bg text-info-fg",
      danger: "bg-danger-bg text-danger-fg",
      neutral: "bg-neutralPill-bg text-neutralPill-fg",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
