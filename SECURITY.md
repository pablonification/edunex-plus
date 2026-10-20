# Security

Edunex Plus holds students' Edunex and SIX sessions, so a security problem in
it can expose someone's grades, Tasks or account. Thank you for looking.

## Reporting a problem

Please report it **privately**, not in a public issue: open this repository's
**Security** tab and choose **Report a vulnerability**. Only the maintainers
see the report, and you can talk it through with them there.

- Describe what someone could do and how to make it happen. If you can, show
  it on the demo's made-up data (`npm run demo`) rather than on a real account.
- Don't include real tokens, cookies, student numbers, grades or other personal
  data, yours or anyone else's.
- Edunex Plus is a volunteer student project: expect a first answer within a
  week. Once it's fixed and released, you're credited in the advisory if you
  want to be.

## What's in scope

The app and this repository:

- **Sessions and tokens:** the Edunex token and the SIX cookie. How they're
  stored (only through the system keychain, `src/desktop/vault.ts`), whether
  they can end up in logs, files, screenshots or requests to other hosts, and
  whether **Settings → Keluar** really removes them (`src/desktop/traces.ts`).
- **The bridge between the window and the app** (`src/desktop/ipc.ts`,
  `src/desktop/preload.ts`, `src/core/actions/`): the window being able to do
  more than its actions allow, such as reading files or sessions.
- **The window's protections** (`src/desktop/security.ts`,
  `src/desktop/protocol.ts`, `src/desktop/window.ts`): the sandbox, the content
  policy, which pages may load or open, and content from Edunex (course pages,
  Task descriptions) running as code in the window.
- **Requests going anywhere** other than the hosts [docs/privacy.md](docs/privacy.md)
  lists, or sending more than it says.
- **Packaging:** Electron's security switches (`scripts/package-fuses.mjs`) and
  the update check (it only links to GitHub Releases).
- **This repository's workflows** (`.github/`): ways to reach its secrets or to
  write to it from a pull request.

Not in scope:

- Edunex, SIX or ITB's Microsoft sign-in themselves: report those to ITB.
- The installers not being signed by Apple or Microsoft ([docs/install.md](docs/install.md) explains
  the warnings this causes).
- Someone who already controls your unlocked computer or user account.

## Supported versions

Only the latest release gets fixes. The app tells you when a newer one exists.
