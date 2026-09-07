import type { OnboardingStep } from "@/lib/auth/session";

/**
 * Two steps, and often one.
 *
 * Sign-up is already behind them by the time this shows. Import is not a step
 * — queueing it is the last thing Connect does, and the seller watches it from
 * the app. Neither is picking channels: connecting one is the only thing that
 * ever mattered, so asking first which they *intended* to connect was a screen
 * that collected an answer nothing read.
 */
const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "connect", label: "Connect" },
];

export function Stepper({
  current,
  /** Google users never see the profile step, so it is dropped from the rail. */
  skipProfile = false,
}: {
  current: OnboardingStep;
  skipProfile?: boolean;
}) {
  const steps = skipProfile ? STEPS.filter((s) => s.id !== "profile") : STEPS;
  const currentIndex = steps.findIndex((s) => s.id === current);

  // A Google user skips Profile, which leaves a one-item progress rail — a
  // "1 of 1" that tells them nothing. Better to show no rail than a bar that
  // implies there is somewhere else to be.
  if (steps.length < 2) return null;

  return (
    <ol className="flex items-center gap-2" aria-label="Onboarding progress">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                state === "todo" ? "text-muted" : "text-primary-600"
              }`}
            >
              {/* The counter is a square plate, like every other shape.
                  Done is the accent; current is navy, which is the strongest
                  thing on paper; to-do is an empty card. */}
              <span
                className={`grid h-7 w-7 place-items-center rounded-sm text-[11px] font-bold ${
                  state === "done"
                    ? "bg-highlight-300 text-primary-600"
                    : state === "current"
                      ? "bg-primary-600 text-white"
                      : "border border-line bg-white text-muted"
                }`}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={`h-[3px] w-7 ${
                  index < currentIndex ? "bg-highlight-300" : "bg-line"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
