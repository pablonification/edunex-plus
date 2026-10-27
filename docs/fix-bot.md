# The fix bot

When the [report relay](relay.md) files an issue about a page the app couldn't read, the fix bot
tries to fix it: Claude Code, in GitHub Actions, adds one report's scrubbed pages as test data,
writes a test that fails the way the Student's read did, changes the reader until the test passes and
`npm run check` does, and opens a **draft** pull request that closes the issue. On the issue it says,
in plain words, what SIX changed, what the reader expected, what the fix does and how sure it is, or
why it couldn't. It never merges anything: you review its pull request like anyone's. Why it's built
this way: [ADR 0015](adr/0015-a-relay-files-reports-and-a-bot-drafts-the-fix.md). The workflow is
[`.github/workflows/drift-fix.yml`](../.github/workflows/drift-fix.yml), and what it asks Claude to do
is [`.github/drift-fix.md`](../.github/drift-fix.md).

## When it starts

- **By itself**, when the relay opens an issue whose scrubbed pages fail the same way as the
  Student's read (the issue says "Reproduces: yes"). At most 3 issues a day start like this: the relay
  keeps count, so a flood of reports can't spend the Claude key's budget.
- **When you add `ready-for-agent`** to an issue the relay filed: one that didn't start by itself, or
  to try again.
- **By hand**: Actions → Fix bot → Run workflow on main, with the issue's number, or
  `gh workflow run drift-fix.yml -f issue=237`.

Nobody else can start it: only someone who can write to the repository (you, or the relay, which
files issues as you), and only on an issue the relay filed: labelled `from-relay`, which no issue
form can set, opened by you (the relay files as you), with the relay's marker on its first line.
One run per issue at a time, 45 minutes at most. A run that doesn't start says why on its summary
page.

Anyone can send the relay a report whose pages claim to fail the same way, so the runs that start by
themselves are what a stranger can set off: at most 3 a day. To turn them off and keep only yours,
set the repository variable `DRIFT_FIX_AUTOMATIC` to `off`.

## Setting it up

1. **The relay**, with its address and your maintainer's token on GitHub: the `RELAY_URL` variable and
   the `RELAY_MAINTAINER_TOKEN` secret ([docs/relay.md](relay.md), steps 5 and 7, or
   `bash scripts/setup-relay.sh`).
2. **A Claude key**: the `CLAUDE_CODE_OAUTH_TOKEN` secret (from `claude setup-token`) or
   `ANTHROPIC_API_KEY`. Until there's one, the bot skips itself.
3. **`BOT_TOKEN`, so the bot opens its pull requests, with CI.** This repository doesn't let GitHub
   Actions open pull requests (Settings → Actions → General → "Allow GitHub Actions to create and
   approve pull requests" is off), and GitHub doesn't start CI for pull requests the workflow's own
   token opens. A fine-grained token of yours does both:
   [make one](https://github.com/settings/personal-access-tokens/new) for `pablonification/edunex-plus`
   only, with **Contents** and **Pull requests** set to Read and write (no Workflows: it then can't
   change a workflow either), and add it as the `BOT_TOKEN` secret. The bot's pull requests then show
   as opened by you. Without it, the bot pushes its branch and says on the issue where to open the
   draft by hand; if you turn that setting on instead, its drafts say CI hasn't run (close and reopen
   one to run it).

## What keeps it safe

Anyone can send the relay a report, and a report can be written to trick Claude. So:

- **What Claude reads is data, not instructions.** The prompt says so, and Claude has no tool to
  browse the web. The tests it runs could still reach the internet, which is why the next point
  matters.
- **The job that runs Claude holds nothing worth taking.** Claude runs the tests, which means running
  the repository's code, so that job can't push or comment, and never sees the relay's token: it reads
  the report with a ticket that works for a few hours and only from that run (the relay checks the
  run's own token from GitHub), so a ticket that shows in the run's public log is no use to anyone.
- **It works on one report.** The job that runs Claude fetches only the issue's report whose pages
  fail the same way (or else the newest), so a report written to trick it can't reach another
  Student's.
- **What it made is checked again before anything is public,** by main's own code
  (`scripts/ci/drift-fix-guard.mjs`, which lists what a fix may not touch): no change to `.github/`,
  the packages, the checks' settings, the privacy tests, `scripts/`, `relay/` or `src/desktop/`, no
  link to another file, and nothing shaped like a personal detail in what it adds or in any word it
  posts, whatever the outcome. `npm run check` must pass first, privacy tests included. When the
  privacy tests fail, nothing is pushed, and the issue says so without saying what they found.
- **The report's pages become public test data when it pushes,** before anyone has read them, as
  ADR 0015 says. They passed the relay's privacy rules and the privacy tests; read them when you
  review the draft, as with any test data.
- **Its pull requests are drafts on `bot/drift-<issue>`.** A run again replaces that branch, and
  each run says what happened in a comment of its own.

## Reviewing what it made

Read its comment on the issue first: it says how sure it is. Then the draft: the new test data in
`test/fixtures/` (scrubbed pages: read them for anything personal, as with any test data), the test,
and the change to the reader. Once CI passes and you've tried it, mark it ready and squash-merge it
as usual. If it's wrong, close it and fix it by hand, or add `ready-for-agent` again to have it try
once more.
