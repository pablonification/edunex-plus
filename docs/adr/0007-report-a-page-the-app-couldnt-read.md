# 7. A Student can report a page the app couldn't read, scrubbed on their computer

Status: accepted (2026-10-23). Follows [0005](0005-read-past-a-row-the-app-doesnt-know.md) and
[0006](0006-a-changed-six-page-is-said-on-its-screens.md): those make one odd row or one changed
page cost as little as possible; this gets the page that caused it to the maintainer, so the reader
can learn it.

## Context

SIX keeps showing Students pages and rows nobody recorded: an "SPI" row on one Student's fees page
(#210), a new program whose course tables SIX hasn't filled in (#211). Pages differ from one
account to another, so the app will meet more of them as more Students use it. Each time, the
maintainer has had to guess what the page really looked like: the app's saved sign-in is locked to
the app, and the real page carries the Student's name, NIM, grades and money. A Student who wanted
to help could describe what they saw, or send a screenshot, and neither says which tag or label
moved.

The app already knows exactly which page it couldn't read and which check failed (the status's
`changedPages`, the rows in `six.skipped`, a source's `detail`). What it lacked was the page itself,
safe to share.

## Decision

- **The page behind a read that went wrong is kept, in memory only.** When a feed's read fails a
  check (VendorChanged, Failed, Rejected) or leaves rows out, the engine keeps the responses that
  read got: SIX's HTML (every page of that read, up to six, since a check on one page is often
  about another: the transcript's rows against the IPK on the progress page), or the one Edunex
  answer its check names. The latest read per feed, pages over 2 MB left out. Never on disk, never
  in a dataset or an event, so the window never sees it raw. A read of that feed that goes right
  forgets it, and so does its source signing out, its session ending, or another Student signing in
  (`src/engine/report/kept-pages.ts`). How: the engine runs each feed's read inside an
  `AsyncLocalStorage`, and its door to the network and to the store note what passes for the read
  they're part of, however SIX's requests queue.
- **The report is scrubbed on the Student's computer, before it leaves the engine.**
  `engine.report(about)` builds it only when asked (`src/engine/report/report.ts`), with the rules
  the fixtures script uses, now one module both run (`src/engine/report/scrub.ts`; the script
  loads it with Node's own TypeScript support).
  - *Kept*: the page's structure (tags, attributes, classes), every label SIX writes, course codes
    and names (they're ITB's public catalog), terms, dates, counts (SKS, attendance), Edunex's
    field names, types and short values. That's what a reader checks, and what the maintainer
    needs to see what moved.
  - *Replaced with stable fakes*: the Student's name (from what the app read, and from the page's
    own details and top bar, for a first sign-in that failed), NIMs (to 18223901, 18223902, …, the
    ones the privacy tests allow), SIX's student ids, Edunex's ids for the Student, lecturers' and
    the advisor's names (from the app's data, the page's "Dosen Wali", Edunex's people, and anyone
    written with an academic title or degree), emails, phone numbers, meeting links and their ids
    and passcodes, signed file links, course join tokens, session tokens, form tokens, any number of
    nine digits or more (staff numbers, accounts), pictures of people, the Student's age and sex,
    their answers and lecturers' comments, and the chat with the academic advisor (who wrote when
    stays, each message becomes "Pesan.").
  - *Shape kept, values made up*: grades become made-up letter grades per course (D and E too);
    amounts are all multiplied by one made-up factor between ½ and 2, rounded to the thousand, so a
    bill and its payment still agree (paid stays paid) but the real amount can't be worked back; IP
    and IPK become made-up values of the same form ("3.26" → "3.71", "3,265" stays three decimals);
    Edunex's scores become made-up numbers of the same kind. The factor and picks are new for each
    report, so two reports can't be compared to undo them. A reader still parses every value.
  - *Dates stay as they are.* They're the term's and the class's (deadlines, meetings, instalments),
    the same for everyone in it, and the readers check them against each other (a meeting in the
    month asked for, a bill under its term's year): made-up dates would fail another check than the
    real page did. The one personal date SIX shows, the Student's age, is replaced.
  - The check and the rows in the report are scrubbed with the same fakes as the page. Tests prove
    both halves: a page full of a Student's details comes out with none of them (the privacy rules
    of `test/kit/privacy-rules.ts`, the ones `privacy.test.ts` holds the fixtures to), and the
    scrubbed page fails the same check, or leaves out the same rows, as the real one did.
  - The fixtures script keeps what only a whole recording allows: who the Student is from Edunex's
    account, and IP and IPK recomputed from the made-up grades so committed pages add up.
- **The maintainer drops it into test/fixtures.** The file the app saves for a report is the report
  itself, as JSON: `npm run fixtures:from-report -- <file> <name>` writes each page to
  `test/fixtures/<system>/report-<name>-….html|json` (refusing one that still has anything shaped
  like a personal detail), and prints the check it fails.
- **Nothing is sent until the Student chooses how** ("Laporkan masalah", reached from the SIX and
  Edunex status in the banner and the status panel, the screens' SIX page note, and Settings). It
  shows what goes: the app's version and the computer's system, which page and which check, and the
  scrubbed page to read through, with an optional "what were you doing?". Then two ways, side by
  side:
  - *GitHub*: a new issue on this repository, prefilled (title, labels, a summary) through an issue
    form whose labels apply for anyone (`six-drift`, `edunex-drift`). A web address can't carry a
    whole page, so the app saves the report file and says plainly to drag it into the issue.
  - *LINE*, for the many Students without a GitHub account: the app copies the summary, saves the
    same file to send along, shows the maintainer's LINE ID and opens LINE to that contact. The ID
    and its link live in one constant.
  The GitHub page and the LINE address pass the app's official-links rule by their exact address,
  nothing wider. The report the Student sends is the one they were shown: the window gets the
  scrubbed copy to show and names it back to send.
- **No AI on the Student's side.** Using a free model (OpenRouter) to read the page and write the
  report was considered and dropped: the page carries personal data before it's scrubbed, free
  model providers may keep prompts, a key inside a public desktop app can be pulled out and abused,
  and the app already knows which page and which check failed.

## For the maintainer to decide (not built)

1. **A relay, so a Student sends with one click.** A small Cloudflare Worker that takes a report
   and creates the issue with a token only it holds: a fine-grained GitHub token that can open
   issues on this repository and nothing else, rate-limited per address and per day, refusing
   bodies over a size, and checking each page against the same privacy rules before posting. The
   app would offer "Kirim" beside GitHub and LINE, with the same preview, and post the same report
   it saves today. Nothing in the Student's flow changes; nobody needs a GitHub account; the
   maintainer gets every report as an issue with its file. Costs: a service to run and watch, and
   an address anyone can post to, so spam has to be planned for.
2. **A GitHub Action that turns a report into a fix to review.** When a `six-drift` or
   `edunex-drift` issue arrives with a report file, it runs Claude Code
   (`anthropics/claude-code-action`) with this repository's skills: add the pages with
   `fixtures:from-report`, write the failing test at the right seam (the reader's tests, or the
   engine against the pretend SIX), change the reader until it passes, and open a pull request
   against `main` for the maintainer to review, never to merge. It must run with the issue's text
   treated as untrusted (the file is data, not instructions), with only the permissions to push a
   branch and open a pull request, and only on issues the maintainer labels, so nobody else can
   spend its budget.

## Consequences

- A Student who meets a page the app can't read can hand the maintainer that page in a minute,
  without giving away who they are or their records, and the maintainer can reproduce it at once.
- What's kept costs memory only while something is wrong, and never outlives the session.
- The scrubber decides what's personal on pages nobody has seen yet. It's built to take too much
  rather than too little, and the Student reads the page before it goes; a field SIX adds that
  holds something personal in a shape the rules don't know would still need a rule.
- The fixtures script now uses the same rules, so recorded test data gets the same care: staff
  numbers and pictures of people that the old script let through are scrubbed the next time it runs.
