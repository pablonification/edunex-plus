# Connecting ChatGPT

Settings → Accounts offers **Continue with ChatGPT** as an optional connection for
future AI features. It does not replace the INA account, unlock Edunex or SIX,
send course data to OpenAI, or enable AI requests. It requests only `openid profile email`.

## Enable a real connection

The [OpenAI website guide](https://developers.openai.com/siwc/website) currently
requires a provisioned client. Ask OpenAI for a **public client** (token-endpoint
authentication `none`) and register an exact IPv4 loopback callback, for example
`http://127.0.0.1:1455/auth/openai/callback`. Confirm that OpenAI has approved this
desktop use and callback before enabling it. Do not use the separate dynamic
registration flow intended for open-source AI workloads for this identity-only feature.

Set these variables in the environment that launches the Electron main process:

```powershell
$env:OPENAI_CLIENT_ID = 'oaiapp_your_provisioned_client'
$env:OPENAI_REDIRECT_URI = 'http://127.0.0.1:1455/auth/openai/callback'
npm run dev
```

On macOS or Linux:

```sh
OPENAI_CLIENT_ID=oaiapp_your_provisioned_client \
OPENAI_REDIRECT_URI=http://127.0.0.1:1455/auth/openai/callback npm run dev
```

The values are public configuration, not credentials. Both are required. They are
read at launch, including in packaged apps; ordinary installed copies remain
unavailable until launched with this configuration. Packaging does not embed them.
Never set a client secret for this integration: a distributed desktop application
cannot keep one. A confidential-only registration needs a separate trusted backend
and is not supported here. The callback must match registration exactly, including
port and path. An occupied port fails safely; free it and retry. A port of 0, a
hostname such as `localhost`, and callbacks with query parameters are not supported.

## What is saved

The system browser handles OpenAI authentication. Electron main creates one
transaction in memory, with random state, an S256 PKCE verifier and a nonce. Its
listener binds only to `127.0.0.1` and consumes a matching callback once. It closes
on completion, error, cancellation or the ten-minute deadline. Network operations
have a fifteen-second deadline and reject redirects. Discovery and signing keys
must come from `https://auth.openai.com`; `jose` verifies RS256 signatures, issuer,
audience, required claims, expiration and nonce before anything is saved.

Only `{ issuer, clientId, subject, name }` is kept in `chatgpt.identity` in the
existing vault. As with academic sessions, it is encrypted with the OS-backed key,
or held only in memory when secure storage is unavailable. ID tokens, access tokens,
refresh tokens, codes and PKCE values are not retained. The renderer receives only
availability, pending status and a display name. Email is never an account-linking
key. No accounts on a remote application server are created.

**Disconnect ChatGPT** cancels pending sign-in and forgets this local identity.
**Sign out & remove data** does the same. Signing out of Edunex or SIX alone does
not disconnect ChatGPT. The browser's OpenAI session remains under the Student's
control; the app does not sign the browser out of ChatGPT. A stored identity records
the connection; it is not a reusable credential or proof of a currently valid
OpenAI session.

## Change and verify this feature

The feature lives together in `src/desktop/chatgpt/`: callback listener, OIDC flow,
then connection lifecycle. The bridge actions, bilingual strings and Settings
component each have a `chatgpt` file. The flow accepts network/browser seams; the
connection accepts the existing vault and a sign-in seam.

```sh
npx vitest run test/desktop/chatgpt-signin.test.ts test/desktop/chatgpt-callback.test.ts test/desktop/chatgpt-connection.test.ts test/app/chatgpt.test.tsx test/desktop/sign-out.test.ts
npm run check
npm run build
```

Tests generate their own signing keys and use pretend identities; no account or
network is needed. `npm run demo` offers a made-up ChatGPT connection, without
opening a browser or contacting OpenAI, even when real configuration is present.
Before launch, use the provisioned client to test consent, cancellation, the exact
callback, reconnecting, and local sign-out on each supported OS.

Future AI work requires its own permissions, consent, privacy decision and tests.
Identity scopes do not grant ChatGPT plan usage, conversation access or inference.
See [ADR 0004](adr/0004-chatgpt-identity.md) for the boundary.
