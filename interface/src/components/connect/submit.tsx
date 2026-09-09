"use client";

import { useFormStatus } from "react-dom";
import { Spinner, pressClass } from "@/components/ui";

/**
 * A submit button that knows its own form is in flight.
 *
 * `useFormStatus` only reports the form it is rendered inside, which is why
 * this is a component and not a prop on the form: two connect forms on one
 * screen have to spin independently.
 */
export function ConnectSubmit({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${pressClass({ size: "sm" })} ${className}`}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
