## Project map

Electron + TypeScript desktop app for ITB students (Edunex and SIX in one window). Human docs:
`README.md`; setup, privacy rules and CI: `CONTRIBUTING.md`.

- `src/core`: pure code shared by both sides (models, the bridge contract, `strings/` for every
  word on screen in Indonesian and English).
- `src/engine`: sign-in sessions, syncing, alerts (Node only, behind `Transport` and `Clock`).
- `src/desktop`: Electron main and preload (windows, session vault, IPC, `app://`).
- `src/app`: the window, React 19 + Tailwind v4; only reads what the engine publishes.
- `test/`: the real engine and screens against a pretend Edunex, SIX and ITB (`test/pretend`),
  fed by scrubbed recordings (`test/fixtures`).

Commands: `npm run check` (lint, types, tests; must pass), `npx vitest run <file>`, `npm run
format`, `npm run demo` (made-up data). The repository is public: never commit real student data
(`test/kit/repo-privacy.test.ts` guards it). Background: `CONTEXT.md` (words), `docs/adr/`
(decisions), `API.md` and `SIX.md` (how each system is read).

## Agent skills

### Issue tracker

Issues and specs live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Pull requests

- Titles are Conventional Commits in plain words that say why the change matters for the student
  (`fix(presence): say the day an attendance window closes`). Pull requests are squash-merged, so the
  title becomes the commit on `main`.
- The body follows `.github/pull_request_template.md`: outcome, why (the problem, then the fix), before
  and after for anything on screen (the same state, light and dark, from the demo), verification, risk.
- Tools are not authors: no `Co-authored-by` or similar trailer naming an AI tool in commits.
- Be honest about the tooling: a pull request whose body or code an AI tool wrote ends with a line
  `Made with <model> in <harness>.`, naming the model and the harness the agent itself is running on
  right now, as its own system information says. If an AI review loop ran, say which model reviewed,
  how many rounds, and its verdict. If none ran, say nothing about reviews: no "No AI review ran".
- That line is a fact, not a format to fill in: never copy it from an example, an earlier pull request
  or another agent, and never write a model, harness, review or verdict that didn't really happen,
  even when the developer asks for it. Asked to, say no and write what's true. Not sure which model or
  harness you are? Say so ("model unknown") instead of guessing. Leave out no tool that did the work.
