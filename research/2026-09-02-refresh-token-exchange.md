# EduNex SPA — refresh token exchange (primary-source investigation)

Date: 2026-09-02
Sources: live-served bundles of https://edunex.itb.ac.id (downloaded with curl to /tmp/edunex-spa/):
- `index.html` (25,589 bytes)
- `app.79bf84f4.js` (521,975 bytes) — main app bundle, contains the Vuex `user` store, axios instances, router
- `chunk-vendors.624dabd4.js` (2,598,677 bytes)
- `auth-callback.eccfabbe.js` (lazy chunk for route `/callback`)
- `webhook-sso.1c429b7b.js` (lazy chunk for route `/webhook/sso`)
- `pages-login.df7e66b2.js` (lazy chunk for route `/pages/login`)

## Headline finding

**There is no refresh-token exchange in the SPA. The `refreshToken` is a write-only artifact: it is received, stored in localStorage, and never sent anywhere. No code path in the app bundle ever posts `grant_type=refresh_token`, calls `/refresh`, or otherwise uses the refresh token.**

- Searched `app.79bf84f4.js` for: `refresh_token`, `refreshToken`, `grant_type`, `/refresh`, `token/refresh`, `login/refresh`, `oauth/token`, `def50200`, `expires_in`, `interceptors`, `401`. Every occurrence of `refreshToken`/`refresh_token` in `app.79bf84f4.js` (3 distinct sites) is *storage* (Vuex mutation + `localStorage` persistence via vue-ls), never an HTTP payload.
- The only `grant_type` / `oauth/token` / `refresh_token`-as-request-param code lives in `chunk-vendors.624dabd4.js` and is **auth0.js SDK code (dead code, the known `your_domain` placeholder path)**, e.g.:
  `...grant_type=r.grant_type||"password",this.request.post(n).send(r)...` (chunk-vendors.624dabd4.js — auth0.js `login`).
- The single axios instance the app uses (module `bb36` in `app.79bf84f4.js`) has only two interceptors: request → attach `Bearer`, response → on 401 logout-and-redirect (details below). No refresh/retry logic.

## How tokens are actually obtained (3 paths, all mint tokens outside the SPA)

### 1. Credentials login
`app.79bf84f4.js`, Vuex action (used by `pages-login.df7e66b2.js` → `loginJWT` dispatching `user/loginJWT` with `{username, password}`):

```js
ce["a"].post("/user/auth/login", {username:r, password:c})
// then: Ye(s.access_token),
// a(pe, {accessToken:s.access_token, refreshToken:s.refresh_token,
//         expirationDate:Ne()(1e5*s.expires_in), verified:!0}),
// Xe["a"].set("auth", {accessToken:s.access_token, refreshToken:s.refresh_token, ...})
```
- Full URL: `https://api-edunex.cognisia.id/user/auth/login` (`ce` = module `bb36`, `baseURL:"https://api-edunex.cognisia.id"`), JSON body `{"username":..., "password":...}`, header `Content-Type: application/json`.
- Response shape consumed: `{access_token, refresh_token, expires_in, accounts?}`.
- `Ne` = `moment` (webpack module `c1df`): `expirationDate = moment(1e5 * expires_in)`.

### 2. Account switch
`app.79bf84f4.js`, Vuex action:

```js
ce["a"].get("https://sso-edunex.itb.ac.id/switch/"+btoa(c), {})   // c = account id
// then: a(pe, {accessToken:s.access_token, refreshToken:s.refresh_token,
//         expirationDate:Ne()(1e5*s.expires_in), verified:!0}), Xe["a"].set("auth", ...)
```
- GET against the **SSO host** `https://sso-edunex.itb.ac.id/switch/{base64(accountId)}` (absolute URL, so the axios `baseURL` is ignored; the request interceptor still attaches `Bearer <accessToken>` if an `auth` object exists).
- Response carries a freshly minted `access_token` + `refresh_token` + `expires_in` (+ `accounts` in some flows — the SSO callback variant of this mutation stores `accounts:r.accounts`). This is the only observed mechanism that rotates the refresh token.

### 3. SSO webhook (Azure AD flow lands here)
`webhook-sso.1c429b7b.js` (route `/webhook/sso`, name `webhook-sso`):

```js
var e = JSON.parse(this.$route.query.param),
    o = {token_type:e.token_type, expires_in:e.expires_in, access_token:e.access_token,
         refresh_token:e.refresh_token, accounts:e.accounts};
this.$store.dispatch("user/login_sso", {authInfo:o})
```
- The SPA receives the complete token set via a **URL query param** (`/webhook/sso?param=<JSON>`); the actual Azure AD dance happens server-side at `sso-edunex.itb.ac.id` (login page links out via `siteInfo.sso_url = "https://sso-edunex.itb.ac.id"`, `pages-login.df7e66b2.js`). The store action `login_sso` (`app.79bf84f4.js`) persists it:
  `a(pe,{accessToken:r.access_token, refreshToken:r.refresh_token, expirationDate:Ne()(1e5*r.expires_in), accounts:r.accounts, verified:!0})`.

## How `expirationDate` (2069 sentinel) is used

`app.79bf84f4.js`, getter:

```js
isLoggedIn: function(e){
  var t = Xe["a"].get("auth");
  return !!(t && e.loginInfo.verified && Object(He["b"])(e.loginInfo.expirationDate))
}
```
`He["b"]` is module `a5a1`'s `isValidDate`:
```js
i = function(e){ if(!e) return !1; var t = "string"===typeof e ? r()(e) : e; return t.isAfter() }
```
i.e. `moment(expirationDate).isAfter(now)`. Since the stored sentinel is `"2069-12-07T00:00:00.000Z"`, this is **always true** — there is no proactive expiry check and no scheduled refresh. `expires_in` is interpreted as `moment(1e5 * expires_in)` milliseconds (which is how the 2069 sentinel gets produced by the server sending a huge `expires_in`).

## 401 handling / refresh failure behavior

`app.79bf84f4.js`, module `bb36` (the only app axios instance, baseURL `https://api-edunex.cognisia.id`):

```js
u.interceptors.request.use(function(e){
  var t = i["a"].get("auth");
  return t && (e.headers.Authorization = "Bearer " + t.accessToken), e
})
u.interceptors.response.use(function(e){ return e }, function(e){
  if(e.response && 401 === e.response.status)
    return localStorage.removeItem("auth"), c["a"].push("/pages/login");
  throw e
})
```

**On 401: no refresh attempt at all.** The `auth` localStorage entry is dropped and the user is hard-navigated to the in-app login page `/pages/login` (which links to the SSO at `https://sso-edunex.itb.ac.id`). Not a redirect back to the SSO host directly — just the local login page.

Logout is also purely client-side (`app.79bf84f4.js`):
```js
logout: function(){ ... Xe["a"].clear(), n(pe,{accessToken:"", refreshToken:"", expirationDate:0, verified:!1}), ... }
```
No server-side logout/revocation call.

## What we can and cannot conclude

- **Cannot conclude from the SPA**: there is no observable client-driven refresh exchange, so *the endpoint that exchanges the `def50200…` refresh token is not present in any served JavaScript*. The refresh token exists in the payloads of `/user/auth/login`, `/switch/{id}`, and the `/webhook/sso?param=` handoff, all of which mint fresh token pairs — consistent with the refresh (Laravel Passport-style, `def50200` prefix) happening **server-side on the SSO/API hosts**, invisible to the client. Verifying that would require probing `sso-edunex.itb.ac.id` / `api-edunex.cognisia.id` endpoints (out of scope: no POSTs were made).
- The `auth-callback.eccfabbe.js` chunk (`/callback` route) calls only `this.$auth.handleAuthentication()` — the embedded auth0-js/auth0-spa-js dead code with placeholder `your_domain`; it never touches the real token flow.

## Search checklist (for reproducibility)

Grep patterns run over both main bundles: `refresh_token`, `refreshToken`, `grant_type`, `/refresh`, `token/refresh`, `login/refresh`, `oauth/token`, `def50200`, `expirationDate`, `expires_in`, `interceptors`, `401`, `logout`, `api-edunex`, `sso-edunex`, `v2/login`, `auth-callback`, `webhook/sso`, `"/token"`, `"id_token"`, `isLoggedIn`, `baseURL`. All hits accounted for above. No other axios instances or interceptors exist in `app.79bf84f4.js`. `def50200` appears nowhere (tokens are never hardcoded).
