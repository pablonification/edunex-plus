# API.md — how Edunex Plus uses the EduNex API

The EduNex API (`https://api-edunex.cognisia.id`) is **undocumented and vendor-hosted** by
Cognisia. Edunex Plus is not an official client: it talks to the same API the EduNex web app
uses, with the user's own session, under the guardrails below.

This file is the project's API-usage stance. Every contributor inherits it; any PR that adds
or changes an API call must update this file and keep the guardrails true.

## The guardrails

1. **Unofficial.** Edunex Plus is an independent, community-built client. It is not an ITB or
   Cognisia product, and the lowercase-n "Edunex Plus" mark is deliberately distinct from
   Cognisia's EduNex trademark.
2. **Bring-your-own-session.** The app uses the logged-in user's own session. Login happens
   through the real INA account SSO inside an embedded webview; the password only ever reaches
   Microsoft's sign-in page and never touches Edunex Plus.
3. **Read-mostly.** Reads dominate. The only writes anywhere in the client are the Task
   Answer draft-save and submit (on explicit user action) — see [The only writes](#the-only-writes).
4. **≥60s jittered polling, with backoff.** One unified main-process tick, cadence 90s ± 30s
   jittered. The hard floor is 60 seconds between polls; never poll faster. Errors back off
   exponentially. Presence detection is clock math on the explicit window fields in the
   payload — it never becomes extra polling. All background work lives in the main process;
   renderers never poll.
5. **Explicit-only writes.** A write fires only on a deliberate user action (Save draft,
   Submit). Nothing in the sync tick or any background path ever writes.
6. **On-device-only storage.** Tokens (Electron safeStorage), the JSON snapshot cache per feed
   per account, and the seen-ledger live on the user's device. Nothing syncs to any server,
   ours or otherwise; no telemetry.
7. **Distinctive User-Agent.** Every request carries
   `EdunexPlus/<version> (+https://github.com/pablonification/edunex-plus)`. Never spoof a
   browser User-Agent. The point is recognizability: Cognisia can identify — and optionally
   allowlist or rate-limit — this client's traffic.
8. **Courtesy notice, shipped regardless.** Shipping does not wait for permission or for a
   reply: the owner sends a courtesy email to Cognisia/ITB describing the project and these
   guardrails, and offering to coordinate.

## Base URL and auth

- Base URL: `https://api-edunex.cognisia.id` (vendor-hosted by Cognisia, not by ITB).
- The login webview completes the real SSO flow (broker `sso-edunex.itb.ac.id` → Azure AD/Entra,
  MFA included) with zero popups. After the redirect back, the app reads `localStorage.auth`
  from the webview partition and extracts `accessToken`, `refreshToken`, `expirationDate`,
  `verified`, and the `accounts` map.
- Every API call sends `Authorization: Bearer <accessToken>`.
- **No refresh logic.** The SPA never refreshes either (the refresh token is write-only; tokens
  are minted server-side; observed JWTs live ~1 year while the SPA's `expirationDate` is a 2069
  sentinel). On a 401 or a missing token, sync pauses and the app opens the interactive
  "please sign in again" moment — recovery is never silent, because the Azure AD and SSO-broker
  cookies do not survive app restarts.
- Auth0 code in the SPA is dead code; the app ignores it.

## Endpoints the app calls

All facts below were verified against the live API with a real student session (prototype
spikes, September 2026). Reads only — all of these are `GET`:

| Endpoint | Purpose | Response shape |
| --- | --- | --- |
| `GET /todo` | Aggregated To Do feed for the account (pending Tasks, exams, questions, modules) | Plain JSON: `{tasks: [], exams: [], questions: [], modules: []}` |
| `GET /course/courses` | Courses of the current Period | Plain JSON |
| `GET /course/tasks` | Tasks for a course | JSON-API envelope: `{meta, data, links}`, items `type` / `id` / `attributes` / `links` — unlike `/todo`'s plain shape |
| `GET /exam/exams` | Exams list (read-only in v1) | Plain JSON |
| `GET /course/agenda` | Course agenda (meetings, with Vicon tags for online sessions) | Plain array: items carry `type`, `course_name`, `name`, `start_at`, `end_at` |
| `GET /course/presences/list` | Presence records per course | Plain array: items carry `course_id`, `course_code`, `courses_name`, `class_id`, `class_name`, `semester`, `year`, `presences` |
| `GET /notifications/{userId}` | Notification feed | `{data: …}`. Note the bare path **404s**: `GET /notifications` without the user id returns 404 |

Two envelope regimes exist — `/todo` returns plain JSON while `/course/tasks` speaks JSON-API —
so the API client normalizes at the boundary rather than letting callers care.

Also verified but **not called**: `PATCH /notifications` (notification read-state) exists;
v1 has no flow that uses it. It is recorded here so nobody rediscovers it — and if it is ever
adopted, it is a write and falls under the explicit-only rule.

## The only writes

Task Answers (the "saved ≠ submitted" surface) and nothing else:

- `POST /course/task/answers` — create a draft Answer, `task_id` in the body → `201`.
- `PATCH /course/task/answers/{answerId}` — update a draft Answer.
- Final submit: the exact wire contract is a **bounded known-unknown** — expected
  `is_sent: 1` plus a sender field, captured on the user's next real submission (tracked in
  issue #12). Until then the app never guesses it, and there is **no resubmit affordance**.
- Status derivation uses **`is_sent` only** (`0` = draft): `sent_at` is stamped on drafts too,
  so the app never displays it.
- Both draft calls fire only on an explicit click. There are no other `POST`/`PATCH`/`PUT`/
  `DELETE` calls in the client.

## What the app deliberately does not do

- **No writes beyond the list above.** No profile changes, no discussion/CRS posts, no
  notification mutations in v1.
- **No past-period browsing.** The server refuses it; v1 shows current/available Periods only.
- **No socket usage.** The vendor's sockets carry only CRS and messaging; the app uses HTTP
  polling exclusively.
- **No SPA-internal endpoints.** The web app calls many more paths (`/public/*`, `/login/me`,
  `/message/unread`, announcements, …); the app calls only the subset listed above.
- **No scraping or replay** of endpoints not listed here, and no polling under the 60s floor.

## Verification status

- Endpoint existence, response shapes, and the auth capture were verified live via the
  prototype spikes (`prototype/auth-spike`, `prototype/sync-spike`, September 2026).
- The final-submit contract and the file-attachment upload endpoint behind
  `answers[].files[]` are pending capture (issue #12); the submission slice's final wiring
  waits on it.
- Any new endpoint must land here first, verified, before the client calls it.
