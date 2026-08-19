"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/primitive/alert";
import { Button } from "@/components/primitive/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/primitive/field";
import { Input } from "@/components/primitive/input";
import { FrappeAuthError, loginWithFrappe } from "@/lib/frappe/auth";
import { safeNextPath } from "@/lib/frappe/redirect";

const formSchema = z.object({
  // Frappe's `usr` field accepts either a username (e.g. "Administrator") or
  // an email address, so this can't be validated as email-only.
  email: z.string().min(1, { message: "Please enter your email or username." }),
  password: z.string().min(1, { message: "Please enter your password." }),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setServerError(null);
    try {
      await loginWithFrappe(data.email, data.password);
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof FrappeAuthError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <form
      noValidate
      method="post"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Email/Username</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button
        className="w-full"
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Login"}
      </Button>
    </form>
  );
}
