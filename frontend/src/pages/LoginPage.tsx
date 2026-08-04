import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useFrappeAuth } from "frappe-react-sdk";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoHorizontal from "@/assets/logo-hor.png";

export default function LoginPage() {
  const { currentUser, isLoading: authLoading, login } = useFrappeAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && currentUser) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
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
      setError(message && !message.includes("<") ? message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-navy p-6">
      <div className="w-full max-w-[404px] rounded-[10px] bg-white p-10 shadow-[0_24px_60px_rgba(0,20,36,.36)]">
        <img src={logoHorizontal} alt="Alaiy OS" className="mb-7 h-[26px] w-auto" />
        <h1 className="text-[22px] font-semibold tracking-[-.02em] text-ink">Sign in to Alaiy OS</h1>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-slate">Enter your credentials to access the operating platform.</p>

        {error && (
          <Alert variant="destructive" className="mt-5">
            <CircleAlert className="size-[15px]" />
            <AlertDescription className="text-[12.5px] leading-[1.45]">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-[12.5px] font-medium text-ink">
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
              className="h-11 rounded-md border-line-strong px-3 text-[13.5px] focus-visible:border-blue focus-visible:ring-blue/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password" className="text-[12.5px] font-medium text-ink">
                Password
              </Label>
              <a href="#" className="text-[12px] text-navy decoration-blue decoration-2 underline-offset-[3px] hover:underline">
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
              className="h-11 rounded-md border-line-strong px-3 text-[13.5px] focus-visible:border-blue focus-visible:ring-blue/40"
            />
          </div>
          <Button type="submit" disabled={submitting} className="mt-2 h-11 text-[13px] tracking-[.09em] uppercase">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
