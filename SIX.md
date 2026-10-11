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
   bills. It shows the facts and links to the official page; the Student acts.
4. **Human pace.** One request at a time per website, at least 2 s apart (3.5 s for catalog
   pages), with long cadences per feed and a 15-minute-or-longer pause when SIX says "too many
   requests". SIX sits behind rate limiting; the app must never trip it.
5. **On-device only.** The session cookie is kept with OS-backed encryption (Electron
   safeStorage; in memory only when the computer has no secure storage). Pages are turned into
   datasets on this computer. Nothing is sent anywhere but SIX and ITB.
6. **Same distinctive User-Agent as Edunex.** Every engine request carries
   `EdunexPlus/<version> (+https://github.com/pablonification/edunex-plus)`
   (`src/engine/engine.ts`). Never a spoofed browser identity. The one exception is the sign-in
   window itself, which is a real browser the Student uses and presents a plain Chrome
   User-Agent because some sign-in pages turn away browsers they don't know
   (`src/desktop/signin-session.ts`).

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
| `/app/mahasiswa:{nim}/statusmhs` | `six.status` (1 h ± 5 min); liveness | Name, `{sid}`, program code and name, the term, this term's courses: code, name, class, SKS, and attendance as "Hadir X dari Y pertemuan" from the tooltip, checked against the percentage shown | `six/status.ts` `readStatusPage` |
| `/app/mahasiswa:{nim}+{term}/kelas/jadwal/mahasiswa/{sid}?bulan={YYYYMM}` | `six.schedule` (12 h ± 30 min): this month (WIB), plus next month when SIX's tabs offer it | Each meeting: SIX meeting id, date, start/end (WIB), course code and name, activity (Kuliah, UTS, …) and room | `six/timetable.ts` |
| `/app/mahasiswa:{nim}/statusmhs/transkrip/historis/{sid}` | `six.transcript` (24 h ± 1 h) | Every course per term with grade, SKS, curriculum semester, on-transcript mark; SIX's IP per term; SKS taken. Retakes and IP/IPK are worked out and checked | `readers/transcript.ts` |
| `/app/mahasiswa:{nim}/statusmhs/transkrip/kurikulum/{sid}` | `six.transcript` (same run) | Graduation progress: entry term, IPK (and the SKS it covers), SKS passed and graded T, SKS by kind, courses by stage and curriculum semester (graded, in progress, exempt, not taken) | `readers/progress.ts` |
| `/app/mahasiswa:{nim}/kurikulum/kurikulum/list` | `six.curriculum` (24 h ± 1 h) | Curricula for the program: year, SKS to graduate, normal length, which one is in force, its structure link | `readers/curriculum-list.ts` |
| `/app/mahasiswa:{nim}/kurikulum/kurikulum/{id}/struktur` (the link from the list, `returnTo` dropped) | `six.curriculum` | Required courses by semester, specializations, minors, the program's catalog, each course's SIX course id | `readers/curriculum-structure.ts` |
| `/app/mahasiswa:{nim}/statusmhs/program-integrasi/riwayat/{sid}` | `six.curriculum` | Registered specialization, minor, multidisciplinary program or double major, with advisor and program approval days | `readers/schemes.ts` |
| `/app/mahasiswa:{nim}+{term}/registrasi/rencanastudi/{sid}` | `six.krs` (24 h ± 1 h) | The KRS: term, advisor name, max SKS, sent / advisor-approved / official stamps, the change round (URS), UKT paid and amount, courses with class, SKS and per-course approval. The advisor chat on the page is never read | `readers/krs.ts` |
| `/app/mahasiswa:{nim}/keuangan` | `six.bills` (24 h ± 1 h) | UKT bills per term: billed, paid, last day to pay, instalments | `readers/bills.ts` |

A full refresh is about 10 SIX pages. The student profile the app keeps is only what the
status page shows (name, NIM, program, term); it never reads SIX's profile or master-data pages.

**Written but not wired:** `/app/mahasiswa:{nim}/kurikulum/silabus/{courseId}/view` has a
reader (`readers/syllabus.ts`) and `fetchSyllabus` in `six/records.ts`, meant to be read on
demand, one page at a time. Nothing in the app calls it yet, so the app does not request it today.

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

- The status page and the timetable read the same in both languages; the attendance count is
  read as the two numbers in the tooltip, whatever the words.
- Record readers (`readers/records-common.ts`) detect the language from SIX's active
  `/pub/locale/en` switch. On English pages they check only the number of columns, not header
  labels; key-value fields are taken by recorded row position; KRS steps by their order.
  Course kinds in "SKS by kind" become "other". Dates accept English month names.
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

Every reader rejects what it can't place for certain instead of guessing: an unknown header,
a wrong cell count, a number that isn't a number, attendance that disagrees with its
percentage, a day with times the app can't read (never shown as free), a calendar that isn't a
calendar or has no events. Each throws **VendorChanged** with the page and what didn't fit
(`six/html.ts`, `readers/records-common.ts`, `itb/catalog-pages.ts`, `itb/calendar.ts`). A
changed catalog page marks only that program "changed" and the feed reports it after the run.

| What happened | Error | The app shows |
| --- | --- | --- |
| Redirect to `/login` or off SIX, `401`, or SIX's sign-in page | Unauthorized | Expired if on the liveness feed, otherwise a liveness check |
| `429` | Offline | Offline; SIX paused as above |
| `5xx` from SIX | Offline | Offline |
| Other `4xx`, or more than 3 redirects | Failed | Changed, with the detail |
| No answer, unreachable, or timeout | Offline | Offline |
| Page layout not as recorded | VendorChanged | Changed, with the detail |

A source's status is the worst of its feeds' latest outcomes: changed (VendorChanged, Failed,
Rejected) over offline over live.

## Recorded but not read, and unconfirmed

- **Recorded, not read:** `/home?context=mahasiswa:{nim}+{year}`, `/keuangan?mahasiswa_id={sid}`,
  `/app/mahasiswa:{nim}+{term}/evaluasi/kuesioner`, `/tugasakhir`, `/wisuda`
  (`test/fixtures/six/index.json`).
- **Not recorded, not read:** a meeting's detail page (the timetable links one per meeting,
  `…/pertemuan/{id}/…`); how SIX shows an open attendance window there is an open question.
  Control panel, master data, student ID card and PDDikti pages are never exported or read.
- **Timetable:** only one month was recorded; other months in tests are generated.
- **KRS:** SIX's look for a step not taken yet and for a course not yet approved was not
  recorded (tests use an empty cell).
- **English:** SIX's English wording was not recorded.
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
- Any new SIX or ITB page must land here first, recorded, before the app requests it.
