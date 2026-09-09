/**
 * Shared shape for the OTP form.
 *
 * This lives outside actions.ts on purpose: a `"use server"` module may only
 * export async functions, so a plain constant exported from there is turned
 * into a server reference rather than the value itself.
 */
export type OtpState = {
  stage: "email" | "code";
  email: string;
  error?: string;
  /** Seconds the code stays valid. */
  expiresIn?: number;
  /** Bumped on every successful send so the UI can refocus the code field. */
  sentAt?: number;
};

export const initialOtpState: OtpState = { stage: "email", email: "" };
