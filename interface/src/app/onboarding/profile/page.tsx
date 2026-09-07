import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";
import { effectiveStep } from "@/lib/auth/session";
import { Stepper } from "@/components/onboarding/stepper";
import { Eyebrow } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Your profile — Alaiy" };

export default async function ProfilePage() {
  const session = await requireSession();

  // Google users are handed a name and photo at sign-in, so this step is moot.
  // Resolved through `effectiveStep`, or a cookie naming a retired step would
  // be redirected verbatim to a route that no longer exists.
  const step = effectiveStep(session.onboardingStep);
  if (step !== "profile") redirect(`/onboarding/${step}`);

  return (
    <div className="space-y-8">
      <Stepper current="profile" skipProfile={false} />
      <header className="space-y-1.5">
        <Eyebrow>Step one</Eyebrow>
        <h1 className="text-display-lg">Tell us who you are</h1>
        <p className="text-sm text-muted">
          We use this to set up your workspace and address you properly.
        </p>
      </header>
      <ProfileForm />
    </div>
  );
}
