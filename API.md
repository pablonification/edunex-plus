# API.md — how Edunex Plus uses the Edunex API

The Edunex API (`https://api-edunex.cognisia.id`) is **undocumented and vendor-hosted** by
Cognisia. Edunex Plus is not an official client: it talks to the same API the Edunex website
uses, with the Student's own session, under the guardrails below.

This file is the project's API-usage stance and the record of every Edunex call v2 makes. Any
PR that adds or changes an Edunex call must update this file and keep the guardrails true. SIX
is covered in [SIX.md](SIX.md); ITB's public pages are summed up [at the end](#other-sites).

Everything below comes from the v2 code (`src/engine/sources/edunex/`) and the scrubbed real
responses in `test/fixtures/edunex/` (file names mirror the request path and query; see
[docs/test-data.md](docs/test-data.md)). Anything not seen in either is marked unconfirmed.

## The guardrails

1. **Unofficial.** Edunex Plus is an independent, community-built client. It is not an ITB or
   Cognisia product, and the lowercase-n "Edunex Plus" mark is deliberately distinct from
   Cognisia's Edunex trademark.
2. **Bring-your-own-session.** The app uses the Student's own session. The Student signs in on
   the real ITB/Microsoft pages in a window the app owns; the password and 2FA code only ever
   reach Microsoft's page and never touch Edunex Plus.
3. **Read-mostly.** Every background call is a `GET`. The only writes are handing in a Task
   (file upload, draft save, submit) — see [The only writes](#the-only-writes).
4. **Polite, jittered polling with back-off.** One scheduler in the main process; each feed has
   its own cadence and random jitter (table below), so the app never calls on the dot. The
   fastest regular feed runs every 2–3 minutes. A failing feed backs off on its own (30 s, 1,
   2, 4, 8, then 15 min at most) and never slows the others. Presence alerts are clock math on
   the windows already read, never extra calls. The screens never call Edunex.
5. **Explicit-only writes.** A write fires only on a deliberate click (attach a file, Save
   draft, Submit). Nothing in a feed or any background path ever writes.
6. **On-device-only storage.** The access token is kept only through the OS keychain (Electron
   safeStorage); where there is no real secure storage it lives in memory until the app quits.
   Datasets and the alert history stay on this computer. What leaves the device is only what
   the calls themselves carry. No app servers, no data sync, no telemetry. (Packaged builds
   also ask GitHub once a day whether a newer release exists.)
7. **Distinctive User-Agent.** Every API call carries
   `EdunexPlus/<version> (+https://github.com/pablonification/edunex-plus)`
   (`src/engine/engine.ts`). The API client never pretends to be a browser, so Cognisia can
   recognise — and allowlist or rate-limit — this traffic. (Only the sign-in window, which
   shows the real ITB, Microsoft and Edunex web pages, uses a plain Chrome identity, because
   some sign-in pages turn away browsers they don't know.)
8. **No presence or read signals.** The app never sends Edunex "online", "viewed", presence or
   "mark read" signals, never calls `PATCH /notifications`, and never marks attendance. When
   something must count as attendance, it opens Edunex itself and the Student acts.
9. **Courtesy notice, shipped regardless.** Shipping does not wait for permission or a reply:
   the owner sends Cognisia/ITB a courtesy email describing the project and these guardrails,
   and offering to coordinate.

## Base URL and sign-in

- API: `https://api-edunex.cognisia.id`. Every request has a 15 s time limit
  (`src/engine/sources/edunex/client.ts`).
- **Capturing the token** (`src/desktop/signin.ts`, `src/engine/sources/edunex/signin.ts`). The
  sign-in window opens `https://sso-edunex.itb.ac.id/`, which goes to Microsoft (2FA included)
  and back to `edunex.itb.ac.id`. Every 400 ms, once the window is on `edunex.itb.ac.id`, the
  app reads the website's `localStorage.auth` (`{ accessToken, refreshToken, expirationDate,
  verified, accounts }`) and keeps only `accessToken`, and only if it looks like a JWT. Then it
  closes the window. There's no time limit on the sign-in itself.
- The sign-in window runs on a throwaway in-memory browser session with no access to the app
  (`src/desktop/signin-session.ts`). It is shared with SIX's sign-in so one Microsoft sign-in
  can cover both, and is wiped when no longer needed, 5 minutes after the last sign-in window
  closes, or on quit.
- **Sending it.** Every call sends `Authorization: Bearer <accessToken>`,
  `Accept: application/json` and the User-Agent above. API calls go through a separate
  in-memory Electron session with cookies off (`credentials: "omit"`,
  `src/desktop/transport.ts`).
- **No refresh.** The refresh token is never used and never stored. The saved session is just
  `{ token }`.
- **What ends a session.** A saved token counts as signed in at once and is checked in the
  background. The liveness feed is `edunex.account` (`GET /login/me`). Only a `401` on that
  feed expires the session: the token is deleted and the Student is asked to sign in again. A
  `401` anywhere else (another feed, a write) just runs the liveness check right away. On a new
  sign-in the liveness check runs first; if `/login/me` names a different Student than the
  saved data, all `edunex.*` data is wiped before anything new is stored.

## Feeds and cadence

| Feed | Every (± jitter) | Calls |
| --- | --- | --- |
| `edunex.account` (liveness) | 10 min ± 1 min | `/login/me` |
| `edunex.notifications` | 2.5 min ± 30 s | `/login/me` once per session (for the user id), then `/notifications/{userId}` |
| `edunex.tasks` | 15 min ± 2 min, and at once on a new `ASSIGNMENT` notification | `/course/tasks` per Edunex course; `/course/courses/{id}` for module names (once per session, again at most hourly) |
| `edunex.courses` | 30 min ± 3 min | `/course/presences/list` |
| `edunex.presence` | 30 min ± 3 min | `/course/presences` per course, paged |
| `edunex.materials` (also the course outline) | 1 h ± 6 min | `/course/courses/{id}`, `/gradebook` (only once published), `/course/contents/` per course and per module |
| `edunex.announcements` | 1 h ± 6 min | `/course/announcements/course/{id}` |
| `edunex.exams` | 3 h ± 18 min | `/exam/exams` per course |

Source: `feeds.ts`, `notifications.ts`, `tasks.ts`, `course-page.ts`; scheduling in
`src/engine/sync/scheduler.ts`. Feeds start 0.5 s apart; sign-in and the manual refresh run
them at once (a feed already running is not started twice). Within a feed, calls go one after
another, except a course's `/course/contents/` calls, which go four at a time, as the Edunex
website does. "Per course" always means the class's own Edunex course and its parent course.

## Endpoints

All `GET` unless noted. Only the fields listed are read; extra fields are ignored, and a missing
or mistyped field the app relies on is a vendor change (see [Errors](#errors)).

| Call | Query sent | Fields used |
| --- | --- | --- |
| `/login/me` | none | `id` (user id), `name`, `code` (the NIM) |
| `/notifications/{userId}` | none | `data.notifications[]`: `type`, `title`, `objectId`, `date`, `message` |
| `/course/presences/list` | none | `course_id`, `course_code`, `courses_name`, `class_id`, `class_name`, `semester`, `year` |
| `/course/tasks` | `filter[course_id][is]={courseId}`, `page[limit]=0` | `meta.total`; per Task `id`, `taskable_type`, `taskable_id`, `name`, `description`, `files[{name,file}]`, `start_at`, `end_at`, `created_at`, `updated_at`, `open_status`, `file_required`, `is_lateable`, `domain`, `show_score`, `answers[]`: `id`, `answer`, `files`, `score`, `is_sent`, `sent_at`, `created_at`, `updated_at`, `verified_at` |
| `/course/courses/{courseId}` | `include=modules,modules.activities,lecturer,lecturer.user,assistant,class` | `lecturer`, `credit`, `gradebook_publish`; `included[]` of type `modules`: `id`, `course_id`, `index`, `name`, `is_active`, `created_at` |
| `/gradebook` | `course_id={courseId}`, `class_id={classId}` | `students[]`: `code`, `total`, `index` |
| `/course/contents/` | `filter[contentable_id][is]={id}`, `filter[contentable_type][is]=App\Models\Courses` or `App\Models\Modules`, `sort=index`, `page[limit]=0` | `id`, `contentable_type`, `contentable_id`, `name`, `type`, `content`, `size`, `created_at`, `updated_at` |
| `/course/presences` | `filter[course_id][is]`, `filter[class_id][is]`, `sort=start_at`, `page[limit]=10`, `page[offset]` | `meta.total`; `course_id`, `class_id`, `start_at`, `end_at`, `presence_start`, `presence_end`, `topic`, `note`, `presentable[{presentable, presentable_id}]`, `url`, `attandance{status, presence_at}` |
| `/course/announcements/course/{courseId}` | none | `id`, `announcement`, `created_at`, `creator.name` |
| `/exam/exams` | `filter[course_id][is]={courseId}`, `page[limit]=0` | `data[].id`; from `attributes`, if present: `name` or `title`, `start_at`, `end_at` |

Notes:

- **`/login/me`** is the liveness check and the Student's identity (`code` holds the NIM).
- **`/notifications/{userId}`** is the new-item signal. Only `ASSIGNMENT` (new Task) and
  `CONTENT` (new material) are kept; other types are skipped. The course name is taken from the
  message ("… has been added new … in {course}"). The bare `/notifications` path is not used.
- **`/course/presences/list`** gives this term's course and class pairs. The class number comes
  from `class_name` ("{code}-01" → "01"); the term is `{year}-{semester}`.
- **`/course/tasks`**: `page[limit]=0` means "all". If fewer Tasks arrive than `meta.total`
  says, that's a vendor change, never a silently short list. One course failing keeps that
  course's last known Tasks and reports the error; going offline or a `401` stops the whole run.
- **`/course/presences`** is paged 10 at a time (the website's page size). Edunex's "next" link
  never ends on its own, so paging stops at `meta.total` or an empty page. `presence_start`/
  `presence_end` are the real window (falling back to `start_at`/`end_at`); `presentable` and
  `url` say which action counts; `attandance.status` `1` means present.
- **`/course/contents/`** is the materials list (`type` such as `pdf`, Vicon links, `text`). A
  `size` of 0 or missing is shown as unknown. Downloading a file is an ordinary browser download
  of its link (`src/desktop/downloads.ts`, allowed only for Edunex's Azure storage, the API host
  and `itb.ac.id`), on an explicit click; no token is attached.
- **`/exam/exams`**: no exam was ever recorded (the account had none), so only the envelope and
  `id` are required; the other field names are a guess.
- Seen in recordings but **not called** by v2: `/todo` (no submit status, and its times are
  WIB marked as UTC), `/course/agenda` (Task deadlines with no timezone),
  `/course/tasks/{id}?include=answers` (a Task is read back through its course's list instead),
  `/message/unread`, `/public/*`, `/course/lptks/*`, `/course/modules/{id}`. `/course/materials`
  does not exist; `/rps/v1/rps` answers 403 for Students. No sockets are used.

## Timestamps

Edunex sends times in four formats. Two functions read them, both called `edunexTime`:
`task-records.ts` (Tasks and answers; strict, an unreadable time is a vendor change) and
`course-page.ts` (everything on the course pages; lenient, an unreadable time is "unknown",
except Presence `start_at`/`end_at`, which must be readable).

| Format | Example | Where | Handling |
| --- | --- | --- | --- |
| With offset | `2026-09-17T12:00:00+07:00` | Task `start_at`/`end_at`/`created_at`/`updated_at`; course and module records; Presence `start_at`, `end_at`, `presence_start`, `presence_end`; content `created_at`/`updated_at` | Taken as written |
| Naive, WIB | `2026-09-16 16:15:33` | Answer `sent_at`/`created_at`/`updated_at`/`verified_at`; `attandance.presence_at`; announcement `created_at`; `/course/agenda`; `/login/me` dates | Read as UTC+7 by both `edunexTime` functions |
| WIB wrongly suffixed `Z` | `2026-10-22T23:50:00.000Z` | `/todo` `time`; `/gradebook` `created_at`/`updated_at` | Avoided: v2 never reads these fields. If one is ever read, `course-page.ts`'s `edunexTime` would take the `Z` literally and be 7 hours off |
| Real UTC | `2026-09-15T03:54:44.000Z` | `/notifications` `date` | `Date.parse` as is (`notifications.ts`) |

## Other quirks the code handles

- **Placeholder grade.** Until the lecturer publishes, `/gradebook` says `total: 0`,
  `index: "E"` for everyone. The app asks for it only when the course says
  `gradebook_publish: true`, and even then never shows 0 · E as a grade (`course-page.ts`).
  The Student's row is found by `code` = NIM (or the only row).
- **Placeholder score.** Answers carry `score: 0` until graded. A score shows only when the
  Task has `show_score`, the answer is handed in, and either the score isn't 0 or the answer
  has `verified_at` (`task-records.ts`).
- **Parent and child classes.** `/course/presences/list` lists a class's parent course
  ("… [Parent Class]") as a separate pair with the same course code and class. Both are kept
  on one course (child first) and every per-course call reads both (`feeds.ts`).
- **Tasks edited after posting.** Edunex moves only `updated_at`. A change more than an hour
  after posting, or any change after the Student handed in, counts as an edit
  (`editedAt` in `task-records.ts`). The notification feed misses many Tasks, so the Tasks feed
  also runs on its own cadence.
- **Submit status.** `is_sent` alone decides (`0`/`1`, `"0"`/`"1"` or a boolean; anything else
  is a vendor change). `sent_at` is stamped on drafts too, so it counts only when `is_sent` is
  set. With several answers on one Task, the handed-in one wins, else the latest draft.
- **Flags** come as booleans or 0/1. `open_status` `overdue` or `closed` means no more
  answers. `domain: "uts"` marks a mid-term exam Task. `taskable_type: "modules"` ties a Task
  to a module.
- **Switched-off modules** (`is_active` false) are hidden, as on the website.
- **A different Student** signing in on the same computer wipes the previous one's data first.

## The only writes

Task Answers (the "saved ≠ submitted" surface) and their files, and nothing else. All in
`src/engine/sources/edunex/hand-in.ts`. Each runs only from an explicit click, one at a time
per Task (a second click waits, then re-reads).

**Upload a file** (on attach; 100 MB at most):

1. `POST /blob-storage/sas` with `{ "files": [{ "fileName", "contentType", "sizeInBytes" }] }`.
   The reply must hold an `uploadUrl` and a `readUrl` (accepted as a bare object, an array, or
   wrapped in `data`), both `https://…blob.core.windows.net`.
2. `PUT {uploadUrl}` with the file bytes, `x-ms-blob-type: BlockBlob`, `Content-Type` and the
   User-Agent. Edunex's token is never sent to storage. Time limit: 1 min plus 1 s per 50 KB,
   30 min at most.

**Save draft:**

1. Read the Task back (`GET /course/tasks` for its course). Stop if it's gone, already handed in,
   not open yet, or closed.
2. If there is no answer: `POST /course/task/answers` with
   `{ "data": { "attributes": { "task_id", "answer": "", "is_sent": 0 } } }`, then read back.
3. `PATCH /course/task/answers/{answerId}` with
   `{ "data": { "attributes": { "task_id", "answer", "files": [{ "name", "file": readUrl }], "is_sent": 0 } } }`.
   `files` is the full list the draft should hold; only links on Edunex's storage are allowed.
4. Read back. "Saved" only if Edunex now holds exactly those files in an unsent answer;
   otherwise "unconfirmed".

**Submit:**

1. Read back and check as above; a Task with `file_required` needs a file.
2. If the answer doesn't hold exactly the chosen files, save the draft first (steps above).
3. `PATCH /course/task/answers/{answerId}` with exactly `{ "data": { "attributes": { "is_sent": 1 } } }`.
4. Read back. "Submitted" only when `is_sent` is 1; otherwise "unconfirmed". There is no
   resubmit.

All write requests send `Content-Type: application/json`. Replies are not parsed beyond the
status: every write is confirmed by reading the Task back. There are no other `POST`, `PATCH`,
`PUT` or `DELETE` calls to Edunex.

What's confirmed: the submit body (captured live in v1, issue #12) and creating an answer without
files (checked live in v1). What isn't: the recorder blocks writes, so the upload-link reply's
envelope, the `files` field in a draft update, and the write replies were never recorded. They
are modelled on the spec and on the `files` Edunex sends back on an answer, and kept in one place
so one real submission can confirm or correct them.

## Errors

Every Edunex reply maps to one error kind (`client.ts` for reads, `write` in `hand-in.ts`):

| What happened | Kind | Effect |
| --- | --- | --- |
| No answer, timeout, connection failure | `Offline` | Source shows offline; the feed backs off |
| `401` | `Unauthorized` | On `/login/me` (liveness feed): session expires. Elsewhere: runs the liveness check |
| `429` or `5xx` | `Offline` | Same back-off; no `Retry-After` handling for Edunex |
| Other `4xx` on a read | `Failed` | Source shows "changed" with the detail |
| Other `4xx` on a write | `Rejected` | The click fails; if the Task closed meanwhile, the app says so instead |
| Not JSON, or a shape the schema rejects | `VendorChanged` | Source shows "Edunex changed something"; never an empty screen |
| Storage `PUT` not `2xx` | `Failed` | The upload fails |

A source's status is the worst of its feeds' latest outcomes. Back-off is per feed
(`scheduler.ts`): 30 s after the first failure, doubling to 15 min at most, plus a little jitter;
one success resets it. Edunex has no shared pace line (SIX and ITB's catalog do; see SIX.md).

## Unconfirmed / not yet recorded

- The `/blob-storage/sas` reply envelope, the `files` field of a draft update, and the replies
  to all writes (see above). Whether the storage `PUT` needs more headers than it sends.
- Whether a second create-answer call for the same Task makes a duplicate (the app avoids it
  either way by re-reading first).
- What `/gradebook` looks like once a lecturer publishes.
- Exam records: none recorded, so their field names are a guess.
- Whether signing in on the Edunex website ends the app's token, and how long tokens live
  (a month-old token was still valid).
- Announcement times: only one was recorded (naive WIB); the reader accepts an offset too.
- Edunex's rate limits: no `429` has been seen.

## Other sites

- **SIX** (`six.itb.ac.id`): signed-in pages and the public curriculum catalog, at most one page
  every 2 s, with a pause on `429`. See [SIX.md](SIX.md).
- **ITB academic calendar**: the public iCalendar feed `https://goitb.id/KalenderPendidikan-ics`
  (linked from SIX's home page), read once a day (`src/engine/sources/itb/calendar.ts`).
- **GitHub**: one daily check for a newer release, packaged builds only.

Any new endpoint must land here first, verified against a recording, before the client calls it.
