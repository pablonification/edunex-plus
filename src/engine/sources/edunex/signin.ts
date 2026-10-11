// How an EduNex session is picked up after the Student signs in. EduNex's
// sign-in goes sso-edunex.itb.ac.id → Microsoft → back to edunex.itb.ac.id,
// whose website then keeps `localStorage.auth` =
// { accessToken, refreshToken, expirationDate, verified, accounts }.
// Only the access token is kept; the refresh token is never used, so never stored.

export const EDUNEX_SIGN_IN_URL = "https://sso-edunex.itb.ac.id/";
export const EDUNEX_SITE_HOST = "edunex.itb.ac.id";

const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/** The access token from the website's saved `auth` value, or null while sign-in hasn't finished. */
export function readSignInToken(raw: unknown): string | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const token = (value as { accessToken?: unknown }).accessToken;
  return typeof token === "string" && JWT.test(token) ? token : null;
}
