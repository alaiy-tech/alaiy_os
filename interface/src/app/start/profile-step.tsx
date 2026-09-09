import { Stepper } from "@/components/onboarding/stepper";
import { Eyebrow } from "@/components/ui";
import { ProfileForm } from "./profile-form";

/**
 * Step one, email path only — Google SSO already handed us a name and photo,
 * so `effectiveStep` never routes those sellers here.
 *
 * The heading is an h2: the page's h1 is the masthead in the navy panel, and
 * signing in did not navigate away from it.
 */
export function ProfileStep() {
  return (
    <div className="space-y-6">
      <Stepper current="profile" skipProfile={false} />
      <header className="space-y-1.5">
        <h2 className="text-display-md">Tell us who you are</h2>
      </header>

      <ProfileForm />
    </div>
  );
}
