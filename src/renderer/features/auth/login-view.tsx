import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoginWebview } from "./login-webview";

/**
 * The sign-in surface (#18). Two phases, both ours — the cluttered EduNex
 * login page never appears:
 * 1. A calm branded intro; nothing loads until the user asks for it.
 * 2. The embedded webview starting at the ITB SSO broker, which hands off to
 *    Microsoft's own Azure AD page (MFA included). The password only ever
 *    reaches Microsoft; main captures the session after the redirect-back.
 */
export function LoginView() {
  const [ssoStarted, setSsoStarted] = useState(false);

  if (ssoStarted) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-1 pb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">ITB Single Sign-On</h2>
          <p className="mt-1 max-w-prose text-[13px] leading-5 text-text-secondary">
            Sign in on Microsoft's page below — MFA included. Edunex Plus never sees
            your password; the session is captured automatically once the redirect
            finishes.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-black/[0.06]">
          <LoginWebview />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-[400px] text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-linear-to-b from-accent-500 to-accent-600 text-[19px] font-bold text-white">
          e+
        </span>
        <h2 className="mt-5 text-[19px] font-semibold tracking-tight">
          Sign in with your INA account
        </h2>
        <p className="mx-auto mt-2 max-w-[340px] text-[13px] leading-5 text-text-secondary">
          One sign-in through ITB's SSO and Edunex Plus takes care of the rest. Your
          password goes only to Microsoft's own sign-in page — the app captures the
          resulting session and never sees your credentials.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={() => setSsoStarted(true)}>
            Continue to ITB SSO
          </Button>
        </div>
        <p className="mt-4 text-caption-1-regular text-text-tertiary">
          ITB Single Sign-On · Azure AD · MFA supported
        </p>
      </div>
    </div>
  );
}
