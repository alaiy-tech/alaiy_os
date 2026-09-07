"use server";

import { redirect } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/backend/auth";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { establishSession } from "@/lib/auth/establish";
import { initialOtpState, type OtpState } from "./otp-state";

/**
 * Server Actions for the email + OTP path.
 *
 * These run on the Next.js server, so the call to os.alaiy.com is never made
 * from the browser and there is no cross-origin request to configure.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


async function send(email: string): Promise<OtpState> {
  if (!EMAIL_PATTERN.test(email)) {
    return { stage: "email", email, error: "Enter a valid email address." };
  }
  try {
    const { expires_in } = await requestOtp(email);
    return { stage: "code", email, expiresIn: expires_in, sentAt: Date.now() };
  } catch (error) {
    return {
      stage: "email",
      email,
      error: userFacingError(error, OUR_FAULT),
    };
  }
}

/**
 * Single entry point for the form so it can drive `useActionState`. The hidden
 * `intent` field says which stage of the flow the submit came from.
 */
export async function authAction(
  prev: OtpState,
  formData: FormData,
): Promise<OtpState> {
  const intent = String(formData.get("intent") ?? "send");
  const email = String(formData.get("email") ?? prev.email).trim().toLowerCase();

  if (intent === "send" || intent === "resend") {
    return send(email);
  }

  if (intent === "restart") {
    return initialOtpState;
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) {
    return { ...prev, stage: "code", email, error: "Enter the 6-digit code." };
  }

  let step: string;
  try {
    step = await establishSession(await verifyOtp(email, code));
  } catch (error) {
    return {
      ...prev,
      stage: "code",
      email,
      error: userFacingError(error, OUR_FAULT),
    };
  }

  // `redirect` throws to unwind, so it has to sit outside the try block.
  redirect(`/onboarding/${step}`);
}
