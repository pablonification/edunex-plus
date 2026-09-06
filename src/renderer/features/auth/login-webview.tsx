import { AUTH_PARTITION, EDUNEX_LOGIN_URL } from "@shared/auth";

/**
 * The embedded login webview (#18). The full INA SSO — Azure AD via ITB's
 * broker, MFA included — completes inside this view with zero popups (main
 * folds any window.open back into it). The password only ever reaches
 * Microsoft/Azure pages; main captures localStorage.auth out of this
 * partition after the redirect-back and the app never sees the credentials.
 */
export function LoginWebview() {
  return (
    <webview
      src={EDUNEX_LOGIN_URL}
      partition={AUTH_PARTITION}
      className="h-full w-full bg-white"
    />
  );
}
