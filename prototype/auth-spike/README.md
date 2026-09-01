# EduNex auth-loop spike — PROTOTYPE, throwaway

Answers wayfinder ticket [#5](https://github.com/pablonification/edunex-desktop/issues/5):
does **login webview → capture `localStorage.auth` → direct API client** actually work in Electron, and what are the exact mechanics?

Lives on the `prototype/auth-spike` branch only. Never merge to main; the validated decision moves on without this code.

## Run

```sh
cd prototype/auth-spike
npm install
npm start
```

Two windows open: a console (this spike's findings, live) and an EduNex window — **log in there with your INA account**. That step is the thing being proven; no credentials ever touch this code.

## What it observes

1. SSO completion inside an Electron `BrowserWindow` with a persistent partition (`persist:spike-edunex-auth`), including redirects and any popups.
2. `localStorage.auth` after redirect-back: shape (`accessToken`/`refreshToken`/`expirationDate`/`accounts`), JWT claims, expiry.
3. Refresh mechanics: token-endpoint POSTs are summarized (grant_type, body keys) from live traffic, plus an active refresh probe using the SPA's own `client_id` (parsed from its `authorize` call).
4. Direct API calls to `api-edunex.cognisia.id` with the captured bearer token.
5. `safeStorage` availability — candidate home for tokens on this platform.

Results land in `findings.json` (gitignored, local only). Tokens are never written in full — only previews and claims.

## Caveats

- The refresh probe may rotate a single-use refresh token; that's fine, this is a throwaway login.
- `findings.json` may contain API response previews — don't paste it into issues in full.
