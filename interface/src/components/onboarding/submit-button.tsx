"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button, Spinner } from "@/components/ui";

/** Submit button that disables itself while its enclosing form is pending. */
export function SubmitButton({
  children,
  className = "",
  disabled = false,
  ground,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  ground?: ComponentProps<typeof Button>["ground"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      ground={ground}
      disabled={disabled || pending}
      className={className}
    >
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
