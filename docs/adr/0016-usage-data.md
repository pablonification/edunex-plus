# 16. The app counts how it's used and sends the counts once a day, until the Student turns it off

Status: accepted (2026-11-16). Changes what the README and [privacy.md](../privacy.md) promised
until now ("No analytics, no tracking"): they now say what this ADR sends, and how to stop it.

## Context

The phone app came out on 13 November and a post about it brought more Students in two days than
in the month before. What the maintainer can see of it is GitHub's: running totals of each
release's downloads, and 14 days of page views. Neither says how many people still use the app a
week on, which screens they open, which features no one finds, or how often a feed fails for
everyone and not just for the Student who sent a problem report. The phone outnumbers the desktop
about four to one by downloads, so what matters most is what the phone's Students do.

Problem reports ([ADR 0007](0007-report-a-page-the-app-couldnt-read.md),
[0015](0015-a-relay-files-reports-and-a-bot-drafts-the-fix.md)) answer "what broke on this page",
one Student at a time and with their say-so. They don't answer "how many".

## Decision

- **Counts, a day at a time, by names from the app's own code** (`src/core/usage.ts`):
  - the screens opened ("home", "course", "settings"), never what they showed;
  - the actions the window asks the engine for ("tasks.submit", "schedule.export"), never their input;
  - each feed's reads and how they went ("six.bills.ok", "edunex.tasks.VendorChanged");
  - the errors the app logged, by area ("window", "update"), never their message;
  - with them, the app's version, platform and system, its language, and whether it was signed in to
    Edunex and to SIX that day.

  A name that isn't one of the app's (a course's name passed by mistake) is counted as "other". The
  relay refuses a day with any name that doesn't look like one.
- **Never sent**: anything read from Edunex or SIX, a NIM, a name, a course, a grade, what the
  Student typed, a file's name, an address. The relay doesn't keep the address a day came from.
- **One random id per app** (a UUID made on the device), so a day can be told from another app's and
  a Student who comes back counts once. It's made again when the Student signs out of everything or
  turns usage data off and on, so it never outlives the Student it counted.
- **Sent once the day is over**, one post a day, to the relay we already run (`POST /v1/usage`), in
  a Durable Object of its own (`relay/src/usage.ts`) so it never waits on the reports. A day waits
  on the device while it's offline, a week at most. The relay keeps days for 400 days and answers
  only the maintainer's token, and only with totals per day (`GET /v1/usage`): apps opened, apps
  running (a sync in the background counts here only), new, how many were opened again the next day
  and a week on, platforms, versions, and each count.
- **On by default, off in Settings.** The switch is "Kirim data pemakaian" at the end of Tentang,
  on the desktop and the phone. Turning it off forgets what was counted and not sent, and nothing is
  counted after. The README and privacy.md say what's sent and where to turn it off.
- **Only release builds count.** Development, the demo, the phone's QA build and a build with no
  relay pass nothing (`EngineDeps.usage`), so they never count.

## Considered

- **PostHog or another analytics service.** It would come with dashboards, but another company
  would get every Student's events and their IP address, and the privacy page would name one more
  server. The relay is already there, on the free plan, and holds only counts.
- **A ping without an id.** It counts active apps a day, but can't say whether anyone came back,
  which was the question.
- **Asking first (opt-in).** Most people leave such a question alone, and the counts would stand for
  the few who answer. Saying it plainly in the README and privacy.md, with a switch, is the
  trade-off this ADR makes.
- **Events one by one, with times.** A day's counts answer the questions above. Times and order
  would show one Student's day, which no question here needs.

## Consequences

- The maintainer can see active apps, retention, the screens and features used, and feeds failing
  for many Students at once, by version and platform.
- The promise changes. "No analytics, no tracking" is gone from the README, and privacy.md lists
  usage data among the requests the app makes. A Student who wants none of it turns it off.
- One post a day per app, about four writes each. With 2,000 apps that's 8,000 writes and a few
  thousand reads a day, inside the free plan's 100,000 writes and 5 million reads, which the reports
  share: the relay takes 15,000 days a day at most (60,000 writes), and 500 from one address. A summary of a month reads every app's
  every day in it: fine at this size, and the reason a summary covers 62 days at most.
- Apps on versions before this one send nothing. The daily stats snapshot (`.github/workflows/stats.yml`)
  keeps the download counts and GitHub's traffic for the time before, and alongside.
