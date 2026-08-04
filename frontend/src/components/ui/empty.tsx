import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Empty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-center", className)} {...props} />
));
Empty.displayName = "Empty";

const EmptyHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)} {...props} />
));
EmptyHeader.displayName = "EmptyHeader";

const emptyMediaVariants = cva("mb-2 flex shrink-0 items-center justify-center", {
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line-subtle bg-secondary text-navy [&_svg]:size-[21px]",
    },
  },
  defaultVariants: { variant: "default" },
});

const EmptyMedia = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof emptyMediaVariants>
>(({ className, variant, ...props }, ref) => <div ref={ref} className={cn(emptyMediaVariants({ variant }), className)} {...props} />);
EmptyMedia.displayName = "EmptyMedia";

const EmptyTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-[20px] font-semibold tracking-[-.02em] text-ink", className)} {...props} />
));
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("max-w-[44ch] text-[13.5px] leading-[1.6] text-slate", className)} {...props} />
  ),
);
EmptyDescription.displayName = "EmptyDescription";

const EmptyContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm", className)} {...props} />
));
EmptyContent.displayName = "EmptyContent";

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
