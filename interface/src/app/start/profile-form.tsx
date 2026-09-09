"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormState } from "./onboarding-actions";
import { SubmitButton } from "@/components/onboarding/submit-button";
import { Alert, Card, Field, Input, Select } from "@/components/ui";

const ROLES = [
  "Founder / Owner",
  "Operations",
  "Finance",
  "Marketing",
  "Supply chain",
  "Other",
];

export function ProfileForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveProfileAction,
    {},
  );

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required autoFocus />
        </Field>

        <Field label="Company">
          <Input name="company" autoComplete="organization" required />
        </Field>

        <Field label="Your role">
          <Select
            name="role"
            required
            defaultValue=""
            options={[
              { value: "", label: "Select a role", disabled: true },
              ...ROLES.map((role) => ({ value: role, label: role })),
            ]}
          />
        </Field>

        {state.error ? <Alert>{state.error}</Alert> : null}

        <SubmitButton className="w-full">Continue</SubmitButton>
      </form>
    </Card>
  );
}
