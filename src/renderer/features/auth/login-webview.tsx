import { EDUNEX_SSO_URL } from "@shared/auth";
import { AUTH_PARTITION } from "@shared/auth";

/**
 * The embedded SSO webview (#18), starting at the ITB broker. The full INA
 * SSO — Azure AD, MFA included — completes inside this view with zero popups
 * (main folds any window.open back into it). The password only ever reaches
 * Microsoft/Azure pages; main captures localStorage.auth out of this
 * partition after the redirect-back and the app never sees the credentials.
 */
export function LoginWebview() {
  return (
    <webview
      src={EDUNEX_SSO_URL}
      partition={AUTH_PARTITION}
      className="h-full w-full bg-white"
    />
  );
}
