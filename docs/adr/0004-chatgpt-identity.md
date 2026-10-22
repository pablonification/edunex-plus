# 4. Optional ChatGPT identity in the desktop app

Status: proposed in #186 (2026-10-22).

## Context

Future AI features need a recognizable way to connect a ChatGPT account. Edunex
Plus has no application server or app-wide user database: its academic accounts
and encrypted vault are local, as decided in ADR 0001. OpenAI's website sign-in
guide describes identity-only OIDC and supports provisioned public clients.

## Decision

- Adapt the [website flow](https://developers.openai.com/siwc/website) to Electron
  main as a public client. Authentication stays in the system browser. A temporary
  loopback listener receives the registered callback. This adds no persistent
  server process and preserves the main/renderer boundary in ADR 0001.
- Require an approved client and exact loopback callback at launch. Fail closed
  without them. Never ship a confidential client secret in the desktop app.
- Keep state, PKCE and nonce in main's memory for at most ten minutes. Consume the
  callback once; verify tokens with the maintained `jose` library. Store only the
  verified issuer/client/subject mapping and display name in the existing vault.
- Keep ChatGPT separate from academic sources, account linking and engine sync.
  Only display information crosses IPC. Local disconnect and full sign-out abort
  pending work and erase the identity, including when a vault write is in flight.
- Request identity scopes only. No AI requests, academic-data uploads, offline
  access or retained provider tokens. Future AI capabilities need a separate design.

## Consequences

Contributors can exercise the whole local feature with generated keys and pretend
identities, without OpenAI credentials. The demo is isolated from OpenAI too.
Maintainers must obtain the public client and verify the desktop callback before
enabling real sign-in; this PR does not provision a client. The saved identity is
a record of a connection, not authorization for future AI requests. A web deployment
would need its own secure server-side transaction and session implementation.
