# Contributing to Edunex Plus

Thanks for your interest in contributing. The project is pre-MVP and in active design; this file describes how to plug in today.

## Ground rules

- Read the [README disclaimer](README.md) first: this is an **unofficial** client for EduNex. Contributions must preserve that framing — no vendor or institute logos, no wording that implies official affiliation, and no features that talk to anyone's EduNex account but the logged-in user's own.
- The API courtesy guardrails are not optional. Reads must respect the polling budget (jittered, ≥ 60 s interval, backoff on 429/5xx); anything that writes EduNex state must be an explicit user action, never automated or batched. Storage stays on-device; no telemetry, analytics, or tokens in logs or error reports.
- The EduNex API is undocumented. Do not probe it beyond what the client needs; when you learn something about an endpoint, document it in `API.md` (created as the client is built) so the community shares one accurate picture.
- No public release happens without the courtesy transparency email to Cognisia/ITB first (per the API-usage stance in issue #4): one short message introducing the project, the `User-Agent` string, and the polling profile — not asking permission, offering a point of contact.

## Domain language

[CONTEXT.md](CONTEXT.md) is the project glossary and the shared vocabulary for decisions, issues, and code. Use its terms (Task, Presence, To Do, Period, Answer…) and its _Avoid_ list; if you introduce or sharpen a term, update the glossary in the same change.

## How decisions get made

The product spec is a decision map in [issue #1](https://github.com/pablonification/edunex-plus/issues/1): each open question is a ticket, resolved with evidence recorded in the issue thread. If you want to influence a decision, comment on the relevant ticket before writing code for it.

## Submitting changes

1. Fork/branch, keep changes focused; one logical change per pull request.
2. Follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description` (e.g. `feat(client):`, `fix(auth):`, `docs(context):`, `chore(spike):`). Throwaway spike work uses the `spike` scope and is marked "throwaway, never merge".
3. Match the existing code style and the glossary's language.
4. Run the typechecker and test suite before submitting; include tests for behavior changes.
5. Describe not just what the change does, but which pain point or ticket it serves.

## Code of Conduct

Everyone participating is expected to uphold the [Code of Conduct](CODE_OF_CONDUCT.md).
