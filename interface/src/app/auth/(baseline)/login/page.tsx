import { Suspense } from "react";

import Link from "next/link";

import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

import { LoginForm } from "../../../../components/baseline/auth/login-form";
import { GoogleButton } from "../../../../components/baseline/auth/google-button";

export default function LoginV2() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-bold text-3xl">Sign In</h1>
          <p className="text-muted-foreground text-sm">
            Enter your credentials to continue to {APP_CONFIG.name}.
          </p>
        </div>
        <div className="space-y-4">
          {/* <GoogleButton className="w-full" />
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div> */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}
