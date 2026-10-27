# 15. A relay files each report as an issue, and a bot drafts the fix

Status: accepted (2026-10-27). Builds the two items [0007](0007-report-a-page-the-app-couldnt-read.md)
left "for the maintainer to decide": the relay, and the GitHub Action that turns a report into a fix.
The app's side (sending with one press, or by itself when the Student allows it, and the report's
format 2) is decided with the app.

## Context

SIX's pages differ from one Student to another, so the app keeps meeting pages it can't read. #237
shows what that costs today: a Student whose sick days SIX writes as a second percentage ("82.35% /
94.12%") lost three courses from the app. Their report reached GitHub without the page, because the
Student had to drag a file into the issue, and the maintainer had to ask for screenshots. Each such
report costs a round of asking, and the Students who meet a problem first aren't the ones with a
GitHub account.

## Decision

- **A relay on Cloudflare's free plan files each report as an issue** (`relay/`,
  [docs/relay.md](../relay.md)). The app posts the scrubbed report to it; the relay holds it to the
  privacy rules the test data is held to (`test/kit/privacy-rules.ts`), refuses anything that still
  carries something personal, keeps the whole report private, and opens or updates the issue. Its
  GitHub token can read and write this repository's issues and nothing else.
- **One issue per problem.** Reports with the same signature (the system, the feed, the kind, the
  check, its numbers aside; for rows left out, their reasons) go to one issue, which says how many
  reports have seen it. A burst of reports changes the issue once per ten minutes, and a closed issue
  that more reports reach says so once. A report with no problem in it (sent from Settings) opens a
  bug of its own.
- **What's public and what isn't.** The issue shows the problem, its check, the rows left out as SIX
  wrote them (their HTML, their table's header row, their shape), whether the scrubbed pages fail
  the same way, what it cost the Student, the app's version and system, whether it was sent by hand
  or by itself, and the Student's note. Never the pages or the app's log: those stay with the relay
  (60 days) for the maintainer's token, until the fix bot adds the pages as test data. Every word from a report is in code, behind a fence nothing
  in it can close, so a report can't mention anyone, link anywhere or change the page.
- **`from-relay` is the trust mark.** No issue form sets it, so only the relay's token (and the
  maintainer) can. The issue's first line carries a hidden marker with the report ids, the signature
  and whether the pages fail the same way; the fix bot reads it.
- **The endpoint is public, so spam is planned for.** A report is at most 3 MB, and a day's reports
  50 MB together, so spam can't fill the free plan's storage; each address sends at most 30 a day and
  everyone together 500; at most 20 new issues open a day (more wait, 14 days at most), 5 of them
  bugs from Settings, and 5 from one report; the app's version must look like one; a note needs the
  token its report was answered with, 3 notes a report. Past a cap the app is told to slow down until
  midnight UTC. The privacy rules run on anything anyone sends, so they must stay quick on any text:
  the email rule now stops 64 characters before an @, as addresses do.
- **GitHub down, nothing lost.** The relay keeps the report, answers "later", and its cron trigger
  files it when GitHub answers again; an expired token works the same way until it's renewed.
- **One Durable Object keeps everything**, not R2 and Workers KV. KV on the free plan takes 1,000
  writes a day, which one burst of reports would use up, and it's only eventually consistent: two
  reports seconds apart could open two issues. R2 needs a card on the account. A Durable Object's
  storage is consistent at once, free up to 100,000 writes a day, and created by `wrangler deploy`.
- **The fix bot drafts, the maintainer decides** (`.github/workflows/drift-fix.yml`). It starts by
  itself on a relay issue whose scrubbed pages fail the same way (the first 3 a day), on the
  maintainer's `ready-for-agent`, or by hand, and on nothing else. Claude Code adds the pages as test
  data, writes the failing test, changes the reader until it passes and `npm run check` does; a
  draft pull request and a plain comment on the issue follow. The job that runs Claude runs the
  repository's code, so it holds no write access and not the relay's token: it reads the report with
  a ticket that works for a few hours and only from that run (GitHub signs each job's identity, and
  the relay checks it), so a ticket that shows in the run's public log is no use to anyone. Another
  job, which runs nothing from the change, pushes the branch, refusing any change to `.github/` or to
  what judges a change.

## Considered

- **R2 for the pages and KV for the rest**, as 0007 sketched: above.
- **A GitHub App instead of a token**: it would show as a bot and never expire, but takes more setup
  for one repository. The token's expiry costs nothing but a delay: reports wait until it's renewed.
- **The bot in one job**, as 0007 sketched: a page written to trick Claude into running code would
  then reach the token that pushes to `main` (which has no branch protection) and the token that
  reads every Student's report.
- **Handing the report from job to job.** Artifacts are public on a public repository, and a value
  passed in a job's settings shows in its log, so the report can't travel that way; the ticket can,
  bound to the run.

## Consequences

- A Student sends a report with one press and no account; the maintainer gets each problem once,
  with its rows, and often a draft fix to review.
- A service to run: a Cloudflare account, two secrets, and a token to renew once a year.
- The free plan gives a request 10 ms of CPU. A report of a few pages fits; a 3 MB one goes over,
  which Cloudflare allows now and then. If the relay starts failing on that, Workers Paid ($5 a month)
  lifts it.
- The bot spends the Claude key's budget: at most 3 runs a day start without the maintainer, and
  anyone who sends the relay a report can set those off.
- When the bot pushes a fix, the report's scrubbed pages are public in its draft as test data, before
  anyone has read them. The privacy rules and tests have passed on them, as on any test data; the
  maintainer reads them when reviewing the draft.
