/**
 * Auth contracts shared between main and renderer (#18). Dependency-free so
 * every side can use it (see src/shared/shell.ts).
 */

/** The shape of `localStorage.auth` on edunex.itb.ac.id after the SSO
 * redirect-back (verified by prototype/auth-spike). The app never sees the
 * password — only this post-login artifact. */
export interface CapturedAuth {
  accessToken: string;
  refreshToken: string;
  /** 2069 sentinel in practice; the SPA never refreshes (spec: auth & session). */
  expirationDate: string;
  verified: boolean;
  /** The student's identities (array from the SSO webhook — student +
   * lecturer rows) or the SPA's keyed map; v1 is single-account, unused. */
  accounts: unknown[] | Record<string, unknown>;
}

/**
 * The auth state machine, owned by main and mirrored in the renderer:
 * - signed-out: no stored session — embedded login webview fills the panel.
 * - authenticating: the login webview is open (first sign-in or relogin).
 * - signed-in: tokens captured/restored and accepted.
 * - session-expired: a 401 or missing token paused the app; the "please sign
 *   in again" modal is up. Recovery is interactive by design — no refresh
 *   logic anywhere (spec: auth & session).
 */
export type AuthStatus = "signed-out" | "authenticating" | "signed-in" | "session-expired";

/** Start of the SSO journey: the ITB broker straight to Azure AD — skipping
 * the cluttered EduNex login page entirely. The redirect-back lands on
 * edunex.itb.ac.id, where the capture polls (auth-spike). Used by the
 * renderer's webview src. */
export const EDUNEX_SSO_URL = "https://sso-edunex.itb.ac.id/";

/** Persistent partition for the login webview — survives restarts so the SSO
 * broker can remember the device. Never share across app instances (the
 * single-instance lock guards this; spec: auth & session). */
export const AUTH_PARTITION = "persist:edunex-auth";
