# The report relay

When the app can't read a page, a Student can send the maintainer a problem report
([ADR 0007](adr/0007-report-a-page-the-app-couldnt-read.md)). The report relay lets them send it with
one press, without a GitHub or LINE account: the app posts the report, already scrubbed on their
computer, and the relay files it as an issue here, one issue per problem, keeping the page itself
private. Why it's built this way: [ADR 0015](adr/0015-a-relay-files-reports-and-a-bot-drafts-the-fix.md).

It's a small Cloudflare Worker in [`relay/`](../relay), on Cloudflare's free plan. Its tests run with
the app's (`npx vitest run relay/test`, part of `npm run check`).

## What it keeps, and what goes public

- **Each report, as the app sent it**: the scrubbed pages, the app's log of the last hour (scrubbed),
  the app's version, the computer's system and the Student's note. It's kept in the relay's storage on
  Cloudflare for 60 days, and only the maintainer's token can read it. It's never public by itself:
  when the [fix bot](fix-bot.md) fixes the reader, the pages it adds to `test/fixtures` are public in
  its draft, like any test data.
- **For each problem**: its issue, how many reports have seen it, and the latest report ids.
- **Counts for the daily caps**: by address, hashed with the day and a secret, gone after a day.

The issue shows only the problem, the check that failed, the rows the app left out as SIX wrote them
(their HTML, their table's header row, and their shape: letters as `a`, digits as `9`), whether the
scrubbed pages fail the same way, what it cost the Student, the app's version and system, whether the
report was sent by hand or by itself, and the Student's note. Never the pages or the log.

A report, a note or a log that still holds something shaped like a personal detail (a student
number, an email, a phone number, a meeting or file link, a token: `test/kit/privacy-rules.ts`) is
refused, and the app is told which kinds it found.

## Setting it up (once)

`bash scripts/setup-relay.sh` walks you through all of it. By hand:

1. **A Cloudflare account.** Free, no card: [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. **Sign in from the relay's folder.**

   ```sh
   cd relay
   npm ci
   npx wrangler login
   ```

3. **Put it online.** `npx wrangler deploy`. The first time, it asks you to pick a `workers.dev`
   subdomain. It ends by printing the relay's address, like
   `https://edunex-plus-relay.<your-subdomain>.workers.dev`. Its storage (one Durable Object) and the
   cron trigger every ten minutes are made by this same command.
4. **The token it files issues with.** On GitHub, [make a fine-grained token](https://github.com/settings/personal-access-tokens/new):
   - Token name: `edunex-plus-relay`. Resource owner: `pablonification`.
   - Expiration: the longest offered. Put a reminder in your calendar a week before it ends.
   - Repository access: **Only select repositories**, then `pablonification/edunex-plus`.
   - Permissions, under Repository: **Issues: Read and write**. Nothing else (GitHub adds "Metadata:
     Read" by itself).

   Generate it, copy it, then `npx wrangler secret put GITHUB_TOKEN` and paste it.
5. **Your own token, to read reports.** Make one with `openssl rand -hex 32` and keep it in your
   password manager. Then `npx wrangler secret put MAINTAINER_TOKEN` and paste it. The fix bot reads
   reports with it too, so put it on GitHub as well, with the relay's address:

   ```sh
   gh secret set RELAY_MAINTAINER_TOKEN
   gh variable set RELAY_URL --body "https://edunex-plus-relay.<your-subdomain>.workers.dev"
   ```

6. **Check it answers.** `curl https://edunex-plus-relay.<your-subdomain>.workers.dev/v1/health`
   says `{"ok":true}`.
7. **The `from-relay` label.** The relay marks its issues with it; no issue form can, so it says an
   issue really came from the relay. It's made once:
   `gh label create from-relay --color 5319e7 --description "Filed by the report relay from a Student's report"`.
8. **Turn it on in the app.** The app's side of the relay (sending with one press, or by itself when
   the Student allows it) comes in its own pull request, with `REPORT_RELAY_URL` empty: until it's
   set, the app offers only LINE and GitHub. Once that's merged, set `REPORT_RELAY_URL` to the
   relay's address, without a slash at the end, in a pull request, and release.

## When the GitHub token runs out

GitHub refuses the relay, and reports wait: the app is told they'll be filed later. Make a new token
(step 4) and `npx wrangler secret put GITHUB_TOKEN` from `relay/`. Within ten minutes the relay
files what waited.

## Reading a report

Each relay issue's first line is a hidden marker with the report ids, newest first:

```sh
gh issue view 237 --json body --jq '.body | split("\n")[0]'
mkdir -p .scratch
curl -sH "Authorization: Bearer $MAINTAINER_TOKEN" https://edunex-plus-relay.<your-subdomain>.workers.dev/v1/reports/<id> > .scratch/report.json
npm run fixtures:from-report -- .scratch/report.json <name>
```

`.scratch/` is git-ignored: keep downloaded reports there. The fixtures script writes each page into
`test/fixtures` and refuses any that still look personal; read them before committing.

## Limits

They're in `relay/src/relay.ts` (`LIMITS`). Change them there and deploy again.

| What | Limit | Past it |
|---|---|---|
| One report | 3 MB | Refused (413) |
| All of a day's reports together | 50 MB (60 days of it fit in the free plan's 5 GB) | "Slow down" (429) until midnight UTC |
| Reports from one address | 30 a day (a campus network puts many Students behind one) | "Slow down" (429) until midnight UTC |
| Reports from everyone | 500 a day | "Slow down" (429) until midnight UTC |
| Problems in one report that open an issue | 5 | The others are kept in the report, without an issue |
| New issues | 20 a day | The report is kept, and its issue opens on a later day, oldest first |
| Waiting for an issue to open | 14 days | The problem stops waiting; its reports are kept until they expire |
| Reports with no problem in them (from Settings) | 5 a day, each its own issue | "Slow down" (429) |
| Notes | 3 on a report, 30 a day from one address | "Slow down" (429) |
| Changes to one issue | Once per 10 minutes | The count waits for the next one |
| New issues the fix bot starts on by itself | 3 a day | The bot waits for your `ready-for-agent` |
| Keeping a report | 60 days | Deleted |

On Cloudflare's free plan, the relay gets 100,000 requests a day, 5 GB of storage, and 10 ms of
computing for each request. A report of a few pages fits; a 3 MB one goes over, which Cloudflare
allows now and then. If the relay starts failing on that, Workers Paid ($5 a month) lifts it.

## Watching it, and stopping it

- `npm run logs` in `relay/` shows each request as it comes, and what the relay noted.
- Cloudflare's dashboard → Workers & Pages → edunex-plus-relay shows requests, errors and logs.
- Spam gets through? Lower the caps and deploy. To stop the relay at once: in the dashboard, the
  Worker's Settings → Domains & Routes → turn off `workers.dev`. Turn it on again to resume; what it
  kept is still there.

## Its API (v1)

JSON in and out. The app sends its usual User-Agent.

```
POST /v1/reports   (at most 3 MB)
  { "envelope": 1, "report": <the report, scrubbed; format 1 or 2>, "os": "Windows 10.0.26200 (x64)",
    "lang": "id" | "en", "how": "auto" | "manual", "note": "<optional, at most 1000 characters>" }
  201 { "id", "noteToken", "issue": { "number", "url" } | null, "duplicate": bool, "seen": number }
      issue is null when the day's new issues are used up: it opens the next day.
  400 {"error":"invalid"} · 413 {"error":"too-big"} · 422 {"error":"personal","found":[the kinds]}
  429 {"error":"slow-down"} with Retry-After · 503 {"error":"later"}: kept, and filed when GitHub answers

POST /v1/reports/{id}/note   Authorization: Bearer <noteToken>
  { "note": "<1 to 1000 characters>" } → 200 {"ok":true} · 401 · 404 · 422 {"error":"personal",…} · 429
  Not in v1: 400 {"error":"invalid"} for a note that's empty, too long or not JSON.
  Posted as a comment on that report's issue.

GET /v1/reports/{id}   Authorization: Bearer <MAINTAINER_TOKEN>
  → the report as the app sent it

POST /v1/reports/{id}/ticket   Authorization: Bearer <MAINTAINER_TOKEN>   (not in v1: for the fix bot)
  { "run": "<the GitHub Actions run>" } → 201 { "ticket", "until" }
  The ticket reads that one report, 3 times in 3 hours, with GET /v1/reports/{id}, and only
  from that run of .github/workflows/drift-fix.yml on main: the request also carries the run's own
  token from GitHub (x-github-oidc), which the relay checks with GitHub's keys. The job that runs
  Claude gets the ticket, never the maintainer's token, and a ticket that shows in the run's public
  log is no use to anyone else.

GET /v1/health → {"ok":true}

Anything that fails inside the relay: 500 {"error":"failed"}, and the reason in its log (npm run logs).
```

A report's own fields are read loosely: fields the relay doesn't know are kept and passed on. Format
2 adds, to each problem, `reproduces` ("yes", "no" or "unknown": whether re-reading the scrubbed pages
fails the same way), `cells` (each row left out: its text, its HTML, its table's header row, its
shape), `impact` (the datasets, rows left out, details left blank, the last good read), and to the
report a `log` (the app's last hour, scrubbed).

## Trying it on your computer

`npm run dev` in `relay/` runs it on Cloudflare's runtime at `http://localhost:8787`, with its
secrets in `relay/.dev.vars` (git-ignored: `GITHUB_TOKEN=…` and `MAINTAINER_TOKEN=…`). Add
`-- --test-scheduled` to run the cron trigger with `curl "localhost:8787/__scheduled"`, and
`--var GITHUB_API:http://localhost:…` to file issues on a pretend GitHub instead of the real one.
