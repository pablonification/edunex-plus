# 14. A problem report carries what a fix needs, and can send itself

Status: accepted (2026-10-27). Adds to [0007](0007-report-a-page-the-app-couldnt-read.md): the report
it describes now says whether its scrubbed pages still go wrong the same way, shows the rows that
didn't fit as the page wrote them, says what the problem cost the Student, and carries what the app
did in the last hour. Changes two rules of 0007. On GitHub the report file is saved whenever it
carries the app's log, not only when a page goes with it. And 0007's "nothing is sent until the
Student chooses how" now has a second way to choose: the Student can say once that reports go by
themselves (below), and "Kirim" sends with one click.

## Context

#237 was the first report a Student sent: SIX wrote a sick-day Student's attendance as
"82.35% / 94.12%", and three of their courses went missing. The report named the rows and the
check that failed them, but the page never arrived (the Student had to drag a file into GitHub, and
didn't), and the tooltip that explained the two numbers was only in the page. The maintainer had to
ask for screenshots. A report that leaves out one thing the fix needs costs a round trip with a
Student who may not answer.

Three more gaps showed. The scrubber decides what's personal on pages nobody has seen, and nothing
said when it had also taken out what went wrong. Nothing said what the problem cost the Student
(a course gone, a screen out of date since when). And the app kept no log: errors went to a console
nobody sees, so a sign-in that went round, a notification that never showed or the window breaking
left no trace for a report to carry.

## Decision

- **The scrubbed pages are read again, offline, the way the feed read them** (`src/engine/report/reread.ts`).
  SIX's pages go through SIX's own client and the feed's own code (the record feeds as they're
  registered, the status page and the timetable through the readers their feeds call), an Edunex
  answer through the check its call ran on it, which travels with the request
  (`HttpRequest.check`) so it's the same schema. The real pages are read first as a control: when
  even they don't go wrong the same way offline (a page the read needed wasn't kept, what the app
  knew then has changed), the report says `unknown`. Otherwise `yes` when the scrubbed pages fail
  the same check, or leave out the same rows for the same reasons, and `no` when they don't.
- **Each row left out is found in its scrubbed page by its text**, with its table's header row,
  each up to 2,000 characters, as written (the tooltip too): the public issue can show exactly what
  didn't fit without the page. Its **shape** comes from the real row before scrubbing, every run of
  letters an "a" and of digits a "9" ("82.35% / 94.12%" → "9.9% / 9.9%"): nothing of the Student's
  is left, and the clue stays even where scrubbing made the value up.
- **Each problem says what it cost**: the datasets it touched (for a page that changed, all the feed
  fills, as far as the app has seen), how many rows it left out, how many details it left blank (a
  row read with a detail SIX writes another way, marked `blank` where it's noted), and when the
  screens' data was last read whole (null: never). When each feed last read whole, and what it
  stores, is saved with the app's state, so a restart doesn't make it "never".
- **The app keeps its own log of the last hour, in memory only** (`src/engine/app-log.ts`): each feed's
  read and how it went, sign-in steps and every change of a source's state, actions that failed,
  the update check and the updater's steps, which notifications showed and which didn't, what broke
  in main with nobody to catch it, and the window's own errors (one nobody caught, a promise nobody
  waited for, a panel its crash guard caught), sent to main over the bridge. 300 lines at most, a
  line cut to 500 characters, an error by its kind and message, never its stack. Never on disk,
  never sent anywhere by itself.
- **Every report carries the log**, scrubbed with that report's rules (which also learn from the log:
  a NIM in an address, the Student's Edunex id in the address of their notifications), a home
  folder in any line keeps no owner ("/Users/~/…"), and an id in an address becomes zeros. A report
  from Settings with no page carries it too, so sign-in problems, crashes and missing notifications
  come with what led up to them. On GitHub the report file is saved whenever it holds a page or the
  log, since an issue's address can carry neither. The log starts again when the Student signs out
  or another Student's data arrives: what the app did for one isn't the next one's to send.
- **The report's format is 2.** The new fields are optional, and `npm run fixtures:from-report` takes
  1 and 2 and prints whether the scrubbed pages still fail, the rows as written and the cost.
- **The Student still sees exactly what goes.** "Laporkan masalah" says the log goes too, and its
  folded technical details show the verdict, the cost, the rows' markup and shapes, and the log.

### Sending, with one click or by itself

#237 also showed the other half: a Student who has to drag a file into GitHub often doesn't. 0007
left the relay for the maintainer to decide; it's built now (`relay/`, its own pull request), and
this is the app's side.

- **The relay's address is one constant** (`REPORT_RELAY_URL`, `src/core/links.ts`), shipped
  empty. While it's empty there's no "Kirim", no question, nothing sent by itself: the app is as it
  was. The maintainer fills it in once the relay runs, and has. Tests and the demo never use it:
  they have no relay unless they ask for the pretend one. Requests go through the engine's door to
  the network with the app's User-Agent, as every other request it makes (API v1:
  `src/engine/report/relay.ts`).
- **"Kirim langsung" sits first, with LINE and GitHub**, across the dialog (three tiles side by
  side don't fit it), and posts exactly the report the Student was shown, with their note, which
  the box says goes public. LINE and GitHub stay as they were.
- **The app asks once.** The first time it keeps a problem it asks, in a quiet card in the
  window's corner under any dialog, whether reports like it go by themselves (saying a public
  issue is filed), ask each time, or never. Closed without an answer, that's "ask each time", the
  default. The choice is a Settings field (`reportSending`, "ask" by default) and whether the
  question was answered another (`reportAsked`), both optional so older settings load; a new
  Student signing in is asked again. Answering "by themselves" sends the problem it asked about;
  the others go as they're read again. "Ask each time" asks about each new problem, with a way to
  see its report.
- **By itself, each problem goes once.** It's known by a signature (its feed, its kind, its checks
  with every number a "9"), and only that signature's hash and when it went are saved, never what
  was in the report, so a restart doesn't send it again. It goes again only once it went away (its
  page read well) and came back, 7 days or more after it went: a page that stays changed is one
  problem, however long. Nothing goes while every source the Student is signed in to gets no
  answer, and a relay that didn't answer, or answered as a deploy gone wrong (any status but its
  own refusals), is tried again quietly, later each time. A report it refuses (odd, too big,
  something in it looks personal) isn't tried again until it comes back. Signing out of everything
  forgets all of it, and a send still under way then lands nowhere.
- **After it went**, "Laporan terkirim. Mau tambah cerita?": the issue's number, a way to open it,
  and a box of up to 1,000 characters for the Student's story, said to be public. Its token lives
  in memory only, so the story can be added while the app stays open.
- **Settings lists what went**: when, which page, by itself or by the Student, and its issue,
  which opens in the browser. That's the one page the app opens outside its official-links rule:
  only the issue of a report it sent, its address made from the issue's number
  (`report.openIssue`), so the window can't open any other page that way.
- **Who sees what**: the whole report (its pages, the log) stays private on the relay, for the
  maintainer. The public issue shows its summary, its check, the rows that didn't fit (scrubbed),
  whether the scrubbed page still fails, what it cost, the app's version and system, how it was
  sent, and the Student's story.

## Consequences

- A report can be turned into a failing test without asking the Student anything, and says so
  when it can't (`no`, `unknown`).
- The re-read already caught one scrubbing slip: an attendance figure under 5% ("1.00%") is made up
  as if it were an IP, so a report can say `no` where the Student's attendance is that low. The
  row's shape still shows "9.9%".
- A report is built a little slower (each problem's pages are read twice more), only when asked.
- With the relay running, a report reaches the maintainer even when the Student wouldn't have
  dragged a file anywhere, and a problem many Students meet becomes one issue counted many times
  (the relay's own deduplication), not many.
- The app now sends something by itself, which it never did: only a scrubbed problem report, only
  when the Student said so, and Settings turns it off. README and docs/privacy.md say exactly what.
- Main's own errors no longer reach only a console. An uncaught error is only watched, so Electron
  handles it as before; an unhandled rejection is now caught, logged and printed, instead of being
  left to Electron's default.
