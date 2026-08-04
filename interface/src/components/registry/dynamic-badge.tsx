import React from "react";
import { Badge, badgeVariants } from "@/components/primitive/badge";
import { cn } from "@/utils";
import {
  resolveBadgeStyle,
  ERPNextBadgeCategory,
} from "@/utils/get-badge-style";
import { type VariantProps } from "class-variance-authority";

export interface DynamicBadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  category?: ERPNextBadgeCategory;
  content: string;
  icon?: React.ReactNode;
}

export function DynamicBadge({
  category = "generic",
  content,
  icon,
  variant,
  className,
  ...props
}: DynamicBadgeProps) {
  const mappedStyle = resolveBadgeStyle(content, category);

  return (
    <Badge
      variant={category !== "generic" ? "outline" : variant || "default"}
      className={cn(
        "flex items-center gap-1.5 w-fit font-medium capitalize",
        mappedStyle,
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {content}
    </Badge>
  );
}
