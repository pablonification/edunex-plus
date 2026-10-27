# SIX.md — how Edunex Plus reads SIX and ITB's public pages

SIX (`https://six.itb.ac.id`) is ITB's academic information system. It has **no API**: every
page is server-rendered HTML. Edunex Plus is not an official client. It asks for the same pages
a Student sees in their browser, with the Student's own session, under the guardrails below.
ITB's public academic calendar and SIX's public course catalog are read the same way, without
a session.

This file is the project's SIX stance, the SIX counterpart of [API.md](API.md). Any PR that
adds or changes a SIX or ITB request must update this file and keep the guardrails true.

## The guardrails

1. **Unofficial.** An independent, community-built client; not an ITB product.
2. **Bring-your-own-session.** The Student signs in with their ITB (INA) Microsoft account in a
   sign-in window. The password and 2FA code only reach Microsoft's page.
3. **Read-only.** Every request to SIX and ITB's public pages is a `GET`. There are no SIX
   writes: the app never marks attendance, never fills the questionnaire, and takes no KRS
   action (no adding or dropping classes, no sending a plan, no seat grabbing). It never pays
   bills. It shows the facts and links to the official page; the Student acts. For "Tandai
   Hadir" it opens SIX's own timetable in a window of the app (see below), where the Student
   presses SIX's button themselves.
4. **Human pace.** One request at a time per website, at least 2 s apart (3.5 s for catalog
   pages), with long cadences per feed and a 15-minute-or-longer pause when SIX says "too many
   requests". SIX sits behind rate limiting; the app must never trip it.
5. **On-device only.** The session cookie is kept with OS-backed encryption (Electron
   safeStorage; in memory only when the computer has no secure storage). Pages are turned into
   datasets on this computer. Nothing is sent anywhere but SIX and ITB.
6. **Same distinctive User-Agent as Edunex.** Every engine request carries
   `EdunexPlus/<version> (+https://github.com/pablonification/edunex-plus)`
   (`src/engine/engine.ts`). Never a spoofed browser identity. The exceptions are the windows
   that show a website to the Student, the sign-in window and the SIX window: they're a real
   browser the Student uses and present a plain Chrome User-Agent because some sign-in pages
   turn away browsers they don't know (`src/desktop/signin-session.ts`).

## Sign-in and the session

- The app opens a window (`src/desktop/six-signin.ts`) straight at
  `https://six.itb.ac.id/login/MS365`, SIX's "Login dengan ITB Account" button. If SIX refuses
  that address (status ≥ 400), the window falls back to `https://six.itb.ac.id/login`.
- SIX sends the Student on to Microsoft and back. The window runs on a throwaway in-memory
  session shared with the Edunex sign-in window, so right after an Edunex sign-in SIX usually
  comes straight back without a second password or 2FA (and the other way round). That
  session is wiped 5 minutes after the last sign-in window closes, on sign-out and on quit.
- Every 400 ms the app checks whether the window shows a signed-in SIX page: on
  `six.itb.ac.id`, not under `/login`, `/logout` or `/pub`, and with a `/logout` link (SIX sets
  its cookie for visitors who aren't signed in too). Then it reads the **`khongguan`** cookie
  for `https://six.itb.ac.id/` and closes the window. There is no time limit.
- The session the engine keeps is the Cookie header `khongguan=<value>` (value checked against
  `[\w%+/=.-]+`), stored as `{ cookie }` (`src/engine/sources/six/signin.ts`, `index.ts`).
  SIX keeps that cookie about 30 days (code comment; not measured by the app).
- If the page is signed in but no `khongguan` cookie shows up within 10 s, sign-in fails with
  VendorChanged ("SIX's session cookie wasn't there after sign-in").
- Engine requests go through a separate in-memory Electron session with credentials
  `omit`: its cookie jar is never used. The cookie is sent only as the explicit `Cookie` header
  (`src/desktop/transport.ts`). Redirects are not followed, so SIX's redirect to `/login`
  can be seen.

**How an ended session shows** (`src/engine/sources/six/client.ts`):

- a redirect to `/login`, or off `six.itb.ac.id` (for example to Microsoft) → Unauthorized;
- a `401` → Unauthorized;
- a `200` page with a link to `/login` and no link to `/logout` (SIX's sign-in page) →
  Unauthorized.

A redirect that stays on SIX is followed, at most 3 times (then Failed).

**Liveness check:** the `six.status` feed (status page, hourly). Only an Unauthorized answer to
that feed ends the SIX session (it is deleted from the vault and SIX shows as expired). An
Unauthorized answer to any other SIX feed just triggers the liveness check right away.

**Who is signed in:** the NIM comes from `/home` (the brand link's `?context=mahasiswa:{nim}`,
else any `/app/mahasiswa:{nim}` link). SIX's internal student id (`{sid}`) and the term
(`{term}`, e.g. `2026-1`) come from the status page. If a different NIM than last time signs
in, every stored `six.*` dataset is removed before anything new is saved.

## Every page read

All `GET`, all with `Accept: text/html,application/xhtml+xml`, `Accept-Language: id-ID,id;q=0.9`,
the Cookie header, the User-Agent and a 15 s timeout. Feeds start on launch (and right after
sign-in, liveness first), then repeat every `every` ± `jitter`.

| Path | Feed (cadence) | What is taken | Reader |
| --- | --- | --- | --- |
| `/home` | `six.status`, only when the NIM isn't known yet this session | The NIM | `six/status.ts` `readNim` |
| `/app/mahasiswa:{nim}/statusmhs` | `six.status` (1 h ± 5 min); liveness | Name, `{sid}`, program code and name, the term, this term's courses: code, name, class, SKS, and attendance as "Hadir X dari Y pertemuan" from the tooltip, checked against the percentage shown (with sick days SIX shows two, "82.35% / 94.12%": the first is read). The course table's columns are found by their labels, in any order. A class, SKS or attendance it can't read is left blank and the row noted; the course stays ([ADR 0009](docs/adr/0009-keep-a-course-whose-detail-cant-be-read.md)). A course table it can't read leaves the Student, the term and every other page reading ([ADR 0012](docs/adr/0012-six-course-table-changes-alone.md)) | `six/status.ts` `readStatusPage` |
| `/app/mahasiswa:{nim}+{term}/kelas/jadwal/mahasiswa/{sid}?bulan={YYYYMM}` | `six.schedule` (12 h ± 30 min): this month (WIB), plus next month when SIX's tabs offer it | Each meeting: SIX meeting id, date, start/end (WIB), course code and name, activity (Kuliah, UTS, …) and room. A meeting it can't read is left out and its day marked (`six.scheduleUnread`), so that day is never shown as free ([ADR 0013](docs/adr/0013-a-meeting-the-app-cant-read-marks-its-day.md)) | `six/timetable.ts` |
| `/app/mahasiswa:{nim}/statusmhs/transkrip/historis/{sid}` | `six.transcript` (24 h ± 1 h) | Every course per term with grade, SKS, curriculum semester, on-transcript mark; SIX's IP per term; SKS taken. Retakes and IP/IPK are worked out and checked; with a grade, mark or SKS the app can't read in it, SIX's figure shows unchecked | `readers/transcript.ts` |
| `/app/mahasiswa:{nim}/statusmhs/transkrip/kurikulum/{sid}` | `six.transcript` (same run) | Graduation progress: entry term, IPK (and the SKS it covers), SKS passed and graded T, SKS by kind, courses by stage and curriculum semester (graded, in progress, exempt, not taken). A status label it doesn't know leaves its course out | `readers/progress.ts` |
| `/app/mahasiswa:{nim}/kurikulum/kurikulum/list` | `six.curriculum` (24 h ± 1 h) | Curricula for the program: year, SKS to graduate, normal length, which one is in force, its structure link | `readers/curriculum-list.ts` |
| `/app/mahasiswa:{nim}/kurikulum/kurikulum/{id}/struktur` (the link from the list, `returnTo` dropped) | `six.curriculum` | Required courses by semester, specializations, minors, the program's catalog, each course's SIX course id | `readers/curriculum-structure.ts` |
| `/app/mahasiswa:{nim}/statusmhs/program-integrasi/riwayat/{sid}` | `six.curriculum` | Registered specialization, minor, multidisciplinary program or double major, with advisor and program approval days | `readers/schemes.ts` |
| `/app/mahasiswa:{nim}+{term}/registrasi/rencanastudi/{sid}` | `six.krs` (24 h ± 1 h) | The KRS: term, advisor name, max SKS, sent / advisor-approved / official stamps (a step done at a time the app can't read counts as done, undated), the change round (URS), UKT paid and amount, courses with class, SKS and per-course approval. The advisor chat on the page is never read | `readers/krs.ts` |
| `/app/mahasiswa:{nim}/keuangan` | `six.bills` (24 h ± 1 h) | UKT bills per term: billed, paid, last day to pay, instalments (an "SPI" row, the one-off development fee, is left out). With the amount or payment blank, whether a bill is paid is unknown; an instalment the app can't read blanks the bill's deadline | `readers/bills.ts` |
| `/app/mahasiswa:{nim}+{term}/kelas/pertemuan/{meetingId}/mhs/{sid}?returnTo=…` (a class's popup on the timetable, its `data-url`), with `X-Requested-With: XMLHttpRequest` as SIX's own page asks for it | `six.checkIn` (2 min ± 20 s), only from 5 minutes before a class on the timetable starts to 10 minutes after it ends; outside class it requests nothing. A class whose button came and went isn't read again | Whether SIX's "Tandai Hadir" button shows and can be pressed (not disabled) | `six/check-in.ts` `showsCheckIn` |

**Kept from the status page.** Each time the status page is read, the app also keeps, as SIX data on
this computer (`six.*`, so signing out of SIX or another Student signing in removes it): each
course's count over time (only when it changed, the last 30 per course, `six.countLog`) and what
the count did after each class it watched (counted, marked absent, or not counted a few hours
after class, the last 14 days, `six.classResults`). SIX gives totals only, so a class is judged
only from a count read before it started, and never when two classes of a course share one
change. Nothing more is requested for it. Whether SIX's "held" count goes up when a class
starts, when "Tandai Hadir" opens or when the lecturer records it was not recorded: until it is,
a class on now counts as neither held nor still to come.

A full refresh is about 10 SIX pages, and one popup per class on now. A class is about one
popup every 2 minutes: about 70 small requests for a 2-hour class. The student profile the app keeps is only what the
status page shows (name, NIM, program, term); it never reads SIX's profile or master-data pages.

**Written but not wired:** `/app/mahasiswa:{nim}/kurikulum/silabus/{courseId}/view` has a
reader (`readers/syllabus.ts`) and `fetchSyllabus` in `six/records.ts`, meant to be read
on demand, one page at a time. Nothing in the app calls it yet, so the app does not request it today.

## The SIX window ("Tandai Hadir")

SIX counts a Student present when they press **Tandai Hadir** in the class's popup on the
timetable. When the button shows, the app says so (an urgent alert, on the phone too; again 15
minutes before the class ends if it still shows), and Beranda and Presensi offer **Buka di
SIX**. That opens `src/desktop/six-window.ts`:

- SIX's own timetable on the class's month (`…/kelas/jadwal/mahasiswa/{sid}?bulan=YYYYMM`), in a
  window of the app on its own in-memory session, signed in by setting the engine's `khongguan`
  cookie for `https://six.itb.ac.id/` (secure, HTTP-only). Once the page has loaded, the app
  clicks the class's link (`a.linkpertemuan` whose `data-url` has the meeting id), which opens
  its popup the way a click does. That's all it does on the page: the Student presses the
  button, and the window is theirs.
- It may go to SIX and Microsoft's sign-in only (SIX sends a Student whose session ended
  there); other official links open in the system browser, everything else nowhere. Every
  permission is refused; it can't reach the app. One window at a time; closing it, or signing
  out of SIX, wipes its session.
- On the phone, a tap on the alert opens SIX's timetable for the month in the phone's browser:
  the Student taps the class there, then Tandai Hadir.
- The demo never opens it: its SIX is pretend.

## Human pace

- **One line per website** (`src/engine/http/pace.ts`). Every request to a host waits for the
  one before it to finish, and keeps a gap since the last request to that host started. Lines
  live in the engine and outlive a sign-in, so a 429 pause survives signing in again.
- **SIX's line is shared.** The signed-in SIX client and the public catalog (`/pub/kur2024…`)
  both use the `six.itb.ac.id` line, so they never overlap and never shorten each other's gaps.
- **Gaps.** Signed-in pages: at least 2 s since the last request to SIX started. Catalog pages:
  at least 3.5 s, counted from the end of the previous request, so a slow answer never shortens it.
- **429 on a signed-in page.** SIX is left alone for 15 minutes, or longer if `Retry-After`
  (seconds) asks, capped at 6 hours. Until then every SIX request (catalog included) fails at
  once without touching the network, and SIX shows as offline.
- **429 on a catalog page.** The same line is paused for 15 minutes (`Retry-After` is not read
  here). The catalog run saves what it has and stops.
- **Other failures.** Any failed feed backs off on its own: 30 s, 1, 2, 4, 8, then every
  15 minutes until it works (`src/engine/sync`).
- **Catalog caching.** The `itb.catalog` feed runs every 6 h ± 30 min but only fetches what is
  due: the program list when the stored one is 3 days old (or missing), a program page when it
  was never read or is 3 days old, and a page that failed after 1 day. The Student's own
  program is read first. Progress is saved every 5 pages.
- **500s on catalog pages.** A few campus program pages answer 500. That program is marked
  "missing" and retried after a day; a program read before keeps its copy. Other programs are
  unaffected and the feed does not fail. Which programs answer 500 is not recorded in code.

## English pages

The app asks for Indonesian (`Accept-Language: id-ID`), but a Student can switch SIX to English
and SIX may answer in English anyway. Readers find things by structure (tables, classes, icons,
links, number patterns), not wording:

- The timetable reads the same in both languages; on the status page the attendance count is
  read as the two numbers in the tooltip, whatever the words. The status page's course table finds
  its columns by their labels, Indonesian and English (Code, Course, Class, Credits, Attendance and a
  few more, guessed, `six/status.ts`); a header in other words, in the layout as recorded, reads as
  recorded.
- Record readers (`readers/records-common.ts`) find a table's columns, and a key-value field's row,
  by its label in Indonesian or English, on any page: a Student's Indonesian fees page showed "Invoice
  (Rp)" and "Payment Due Date". They also detect the language from SIX's active `/pub/locale/en` switch:
  on English pages a label the app doesn't know is taken from where the recorded page has it (when the
  header has the recorded number of columns), and KRS steps by their order. Course kinds in "SKS by
  kind" become "other". Dates accept English month names.
- SIX's real English wording was **never recorded**; the tests use the Indonesian pages with
  words swapped (`test/pretend/six.ts`).

## ITB's public sources (no sign-in, no cookies)

Read by `src/engine/sources/itb/` through `PublicClient`: `GET`, the User-Agent, a 20 s timeout.

| What | Request | Feed (cadence, caching) | Reader |
| --- | --- | --- | --- |
| Academic calendar (Kalender Pendidikan) | `GET https://goitb.id/KalenderPendidikan-ics` (the short link on SIX's home page), `Accept: text/calendar`. The redirect is followed to the current file on `publik.akademik.itb.ac.id` (recorded: `/Kalender-Pendidikan-20260710.ics`) | `itb.calendar` (24 h ± 1 h); skipped while the stored copy is under 20 h old. Own line, no gap; a 429 pauses it 15 min | `itb/ics.ts`, `itb/calendar.ts` (event kinds: lecture start/end, UTS, UAS, DRS, URS, UKT deadline, questionnaire, grade deadlines, progress check, holiday) |
| Program list (Kurikulum 2024, Sarjana) | `GET https://six.itb.ac.id/pub/kur2024` | `itb.catalog` (see Human pace) | `itb/catalog-pages.ts` `readProgramList` |
| One program's page | `GET https://six.itb.ac.id/pub/kur2024/{programId}` (three-digit id) | `itb.catalog` | `itb/catalog-pages.ts` `readProgramPage` (required by semester, specializations, multidisciplinary, minors, catalog with category) |

**Personal timetable feed: not used.** SIX's schedule page links to a per-Student
`https://six.itb.ac.id/pub/calm/{lang}/{id}/{year}/{half}/{token}/calendar.ics`. The spec lists
it as a candidate source; the app does not request it.

## Vendor changes and error mapping

Every reader rejects what it can't place for certain instead of guessing: a header without a
column that says which row it is (or one no blank can stand for, like a course's grade on the
curriculum-position page), a row with another number of cells than its header, a number that
isn't a number, attendance that disagrees with its percentage, a calendar that isn't a calendar or has no events. Each throws **VendorChanged** with the page and what didn't fit
(`six/html.ts`, `readers/records-common.ts`, `itb/catalog-pages.ts`, `itb/calendar.ts`). A
changed catalog page marks only that program "changed" and the feed reports it after the run.

A check about one row leaves that row out instead ([ADR 0005](docs/adr/0005-read-past-a-row-the-app-doesnt-know.md),
`sources/skipped.ts`): the rest of the page reads, and the row is kept in `six.skipped` with what it
shows and why, for the screen that shows that data to say so. That holds for the rows of the
fees, transcript, curriculum position, KRS, curriculum list and structure, scheme and status
pages. On the status page a course whose class, SKS or attendance can't be read stays, with that
detail blank, and its row is noted the same way, marked `blank` ([ADR 0009](docs/adr/0009-keep-a-course-whose-detail-cant-be-read.md));
a column SIX doesn't show is noted once, for the table. A course row left out because its code or
name can't be read keeps this term's Edunex courses SIX doesn't list on every screen, since it was
probably one of them ([ADR 0012](docs/adr/0012-six-course-table-changes-alone.md)).
The record pages do the same for every cell but what says which row it is (a course's code and name,
a bill's term, a curriculum's name and year, a scheme's name), and find their columns by label: a
column the app doesn't know is passed over, one moved reads the same, a detail's column that's
missing leaves that detail blank in every row (noted once), and one that says which row it is
refuses the page. A check over a blank (an IP or IPK, a bill against its payment) is skipped, with
SIX's own figure shown; the screens show a blank as "-", and the planner's estimates say which
courses they leave out ([ADR 0011](docs/adr/0011-record-columns-by-name-and-blank-cells.md)).
`test/engine/six-odd-cells.test.ts` changes each recorded page one cell at a time (a second value,
extra words, an empty cell) and keeps what every reader does in
`test/engine/__snapshots__/six-odd-cells.txt`. What holds the rows stays strict (a table, its header, a year or semester heading), as does
a list with more rows left out than read, and the month timetable's grid (its rows, the day numbers,
the weekdays and the month it names). A meeting on the timetable the app can't read is left out the
same way, and kept in `six.scheduleUnread` with its day, its text and its course code when SIX shows
one plainly: Jadwal, Beranda, Presensi, the course page, the tray menu and the class reminders say
there's a class that day the app couldn't read, with a way to SIX's timetable, and never call the day
free ([ADR 0013](docs/adr/0013-a-meeting-the-app-cant-read-marks-its-day.md)). The timetable counts its
meetings left out across the months it reads together. The status page's course table finds its
columns by their labels too, so a column added or moved still reads.

| What happened | Error | The app shows |
| --- | --- | --- |
| Redirect to `/login` or off SIX, `401`, or SIX's sign-in page | Unauthorized | Expired if on the liveness feed, otherwise a liveness check |
| `429` | Offline | Offline; SIX paused as above |
| `5xx` from SIX | Offline | Offline |
| Other `4xx`, or more than 3 redirects | Failed | Changed, with the detail |
| No answer, unreachable, or timeout | Offline | Offline |
| Page layout not as recorded | VendorChanged | Changed, with the detail; for a record page, the timetable or the status page's course table, said on its screens instead (below) |

A source's status is the worst of its feeds' latest outcomes: changed (VendorChanged, Failed,
Rejected) over offline over live. A feed that says which datasets it fills (`FeedSpec.shows`: the
records and the timetable, not the status page) doesn't count: when its page changes, SIX stays live
and lists that page under `changedPages`, and the screens showing those datasets say so with when
their data is from ([ADR 0006](docs/adr/0006-a-changed-six-page-is-said-on-its-screens.md)). The status
page's course table is a part that changes the same way (`FeedSpec.part`): when only it can't be
read, the Student and the term are stored, every other page reads on, `six.courses` keeps its last
list under `changedPages`, and Beranda's course cards and Presensi say so; until it first reads, the
course list is Edunex's ([ADR 0012](docs/adr/0012-six-course-table-changes-alone.md)). The rest of the
status page, who the Student is and the term, is still all of SIX.

## Recorded but not read, and unconfirmed

- **Recorded, not read:** `/home?context=mahasiswa:{nim}+{year}`, `/keuangan?mahasiswa_id={sid}`,
  `/app/mahasiswa:{nim}+{term}/evaluasi/kuesioner`, `/tugasakhir`, `/wisuda`
  (`test/fixtures/six/index.json`).
- **Read, not yet recorded:** a class's popup (`…/pertemuan/{id}/mhs/{sid}`), for "Tandai
  Hadir". This is the one page the app requests before a recording of it landed here: SIX's
  popup with the button showing, and after it was pressed, still need recording during a
  class (`npm run record`: open Jadwal, click the class while the button shows; press it
  elsewhere, as the recorder blocks it, then click the class again). Until then the reader
  finds the button by its words (a button, link or submit input reading "Tandai Hadir", or
  "Mark (as) present / attendance" on an English page, a guess), and a disabled one doesn't
  count. Whether SIX answers differently without `X-Requested-With`, and when the button shows
  (the whole class, or once a lecturer opens it), are not known. The pretend SIX models the
  popup (`test/pretend/six.ts`).
- **Not recorded, not read:** control panel, master data, student ID card and PDDikti pages
  are never exported or read.
- **Attendance with sick days:** seen only as text in a Student's report (#237: "82.35% / 94.12%",
  14 and 16 of 17 meetings); its tooltip wasn't sent. The reader takes the two numbers in a row in a
  tooltip that give the first percentage; the tests try the shapes it could take.
- **Timetable:** only one month was recorded; other months in tests are generated.
- **KRS:** SIX's look for a step not taken yet and for a course not yet approved was not
  recorded (tests use an empty cell).
- **English:** SIX's English wording was not recorded. Of the English labels the record readers know,
  only the fees page's "Invoice (Rp)" and "Payment Due Date" were seen, on a Student's Indonesian page;
  the others are guesses, and an English page whose label isn't one of them reads by recorded position.
  The status page's English column labels are guesses too.
- **429:** SIX's real rate-limit answer (status, `Retry-After`) is modelled, not captured; the
  pretend server answers `429` with `Retry-After: 900`.
- **Session length:** "about 30 days" is from observation, not measured by the app.
- **User-Agent:** [API.md](API.md) quotes `EdunexPlus/<version> (desktop client; +…)`; the
  code sends `EdunexPlus/<version> (+https://github.com/pablonification/edunex-plus)`. This
  file quotes the code. One of the two should be brought in line.

## Verification status

- Pages, paths and layouts were checked against read-only recordings of a real Student
  account (SIX, 2026-10-08; calendar short link 2026-10-11), scrubbed into `test/fixtures/six`,
  `test/fixtures/pub` and `test/fixtures/itb` (see [docs/test-data.md](docs/test-data.md)).
  The recorder blocks every non-`GET` request.
- The whole engine runs in tests against pretend servers (`test/pretend/six.ts`,
  `test/pretend/itb.ts`) that serve those pages, redirect to `/login` when the session ends,
  answer `429` and `5xx` on demand, change layouts and switch to English.
- Any new SIX or ITB page must land here first, recorded, before the app requests it. The
  class popup above is the exception, until its recording lands.
