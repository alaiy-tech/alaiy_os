import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useFrappeAuth } from "frappe-react-sdk";
import { Check, CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoHorizontal from "@/assets/logo-hor.png";
import clientLogoSquare from "@/assets/client-logo-square.png";

const VALUE_PROPS = [
  "Real-time inventory across every warehouse",
  "Sales, procurement and fulfilment in one place",
  "Ask Alaiy — an AI copilot built into your daily ops",
];

export default function LoginPage() {
  const { currentUser, isLoading: authLoading, login } = useFrappeAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && currentUser) {
    const redirectTo =
      (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ username, password });
      navigate("/", { replace: true });
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(
        message && !message.includes("<")
          ? message
          : "Invalid email or password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - dropped below lg, matching how the rest of the dashboard handles narrow viewports. */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:bg-navy lg:p-12">
        <img
          src={logoHorizontal}
          alt="Alaiy OS"
          className="h-7 w-auto self-start brightness-0 invert"
        />

        <div className="max-w-md px-2.5">
          <h2 className="text-[40px] leading-[1.1] font-bold text-white">
            Welcome
          </h2>
          <p className="mt-3 text-[15px] leading-[1.5] text-white/70">
            Your commerce operating system — inventory, catalog, orders and
            fulfilment, all in one place.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {VALUE_PROPS.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 text-[14px] font-medium text-white/90"
              >
                <span className="mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-full bg-blue/20 text-blue">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-white/50">
          © {new Date().getFullYear()} Alaiy OS
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-[404px]">
          <img
            src={clientLogoSquare}
            alt=""
            className="mb-7 size-11 rounded-md object-contain"
          />
          <h1 className="text-[22px] font-semibold tracking-[-.02em] text-ink">
            Sign in to Alaiy OS
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-slate">
            Enter your credentials to access the operating platform.
          </p>

          {error && (
            <Alert variant="destructive" className="mt-5">
              <CircleAlert className="size-[15px]" />
              <AlertDescription className="text-[12.5px] leading-[1.45]">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="username"
                className="text-[12.5px] font-medium text-ink"
              >
                Email or username
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="you@company.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={submitting}
                className="h-11 rounded-md border-line-strong px-3 text-[13.5px] focus-visible:border-blue focus-visible:ring-blue/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label
                  htmlFor="password"
                  className="text-[12.5px] font-medium text-ink"
                >
                  Password
                </Label>
                <a
                  href="#"
                  className="text-[12px] text-navy decoration-blue decoration-2 underline-offset-[3px] hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                className="h-11 rounded-md border-line-strong px-3 text-[13.5px] focus-visible:border-blue focus-visible:ring-blue/40"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 text-[13px] font-semibold tracking-[.09em] uppercase"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Login
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
