import { LoginWebview } from "./login-webview";

/**
 * First-run sign-in surface (#18): a short, calm explainer and the embedded
 * SSO webview filling the content panel.
 */
export function LoginView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-1 pb-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Sign in with your INA account</h2>
        <p className="mt-1 max-w-prose text-[13px] leading-5 text-text-secondary">
          The ITB SSO (including MFA) opens right here. Your password goes only to
          Microsoft/Azure — Edunex Plus captures the resulting session and never sees
          your credentials.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-black/[0.06]">
        <LoginWebview />
      </div>
    </div>
  );
}
