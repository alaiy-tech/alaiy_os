import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useFrappeAuth } from "frappe-react-sdk";
import { AlertCircle, Loader2 } from "lucide-react";

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
    <div className="flex min-h-svh items-center justify-center bg-primary px-4">
      <div className="w-full max-w-sm rounded-lg bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoHorizontal} alt="Alaiy OS" className="mb-6 h-8 w-auto" />
          <h1 className="font-serif text-2xl font-bold text-foreground">Sign in to Alaiy OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to access the dashboard.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Email or username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="mt-2 uppercase tracking-wide">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
