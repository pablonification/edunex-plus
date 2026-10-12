# Scenarios

Every state and event the app must handle, how the pretend Edunex and SIX
(`test/pretend`) produce it, and the ticket whose tests cover it. Rows marked
**needs a recording** have no real record to clone yet; the ticket that covers
them records one first instead of guessing the shape.

The pretend world starts from the scrubbed recordings (`test/fixtures`), so
every response keeps the real shape. Tests change only the fields a scenario
is about (`test/kit/builder.ts`), and a fake clock plays out days in
milliseconds.

```ts
const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
const id = world.edunex.postTask(95001, { name: "Tugas 3" }); // as the lecturer
await world.clock.advance(3 * 3_600_000);                       // three hours later
world.edunex.moveDeadline(id, "2026-10-20T23:59:00+07:00");    // deadline extended
world.edunex.submitOnWebsite(id);                               // the Student, on the website
```

## Edunex: Tasks and answers

| State or event | How the pretend world makes it | Ticket |
|---|---|---|
| Task open, not started | recorded | #72 |
| Task with a draft (answer saved, `is_sent: 0`) | recorded history; `submitOnWebsite` / app writes | #72 |
| Task submitted (`is_sent: 1`) | recorded | #72 |
| Task past deadline, late allowed (`is_lateable`) | recorded (stays `open_status: "open"`) | #72 |
| Task past deadline, closed (`open_status: "overdue"`) | recorded `overdue`; `closeTask` | #72 |
| Task not open yet (`open_status: "closed"`, which the website reads as "you can answer from {start_at}") | `postTask` with a later `start_at`; it reads `"open"` once that time comes | #72 |
| Answer in review | needs a recording (the website knows the state; the field is unconfirmed); modelled for now on the answer's `verified_at` with no score shown: `reviewAnswer` | #72 |
| Score published (`show_score: 1`) | `publishScore` | #72 |
| New Task posted | `postTask` (+ ASSIGNMENT notification) | #72, #75 |
| Deadline extended or moved | `moveDeadline` (`updated_at` moves, no notification) | #72, #75 |
| Instructions or files edited, before or after the Student submitted | `editTask` | #72, v2-18 |
| Short answer window (hours, posted during class) | `postTask` with close `start_at`/`end_at` | #72, #75 |
| Take-home exam Task (`domain: "uts"`; `"UAS"` as the lecturer's form stores it) | recorded (`uts`); `postTask` with `domain: "UAS"` | #72, v2-17 |
| Task required file (`file_required`) | recorded (all recorded Tasks) | #73 |
| Draft save, file upload, submit from the app | the website's requests (API.md "The only writes"): `POST /blob-storage/sas` replying `{ files: { [path]: links } }`, `PUT` upload, `POST`/`PATCH /course/task/answers` with text and files, `PATCH {is_sent: 1}`, `DELETE /blob-storage//task/{id}/export`; write replies need a recording (the app re-reads the Task to confirm) | #73 |
| Clearing the lecturer's cached download fails | `fail(/\/export$/, 500)` | #73 |
| Group Task (`type: "GROUP"`) | `postTask` with `type: "GROUP"` | #73 |
| Second answer for the same Task | `writes` log shows a duplicate POST | #73 |

## Edunex: Presence

| State or event | How | Ticket |
|---|---|---|
| Presence window open, closed, upcoming | recorded; `schedulePresence` | #74, v2-16 |
| Counted by viewing the course (default category) | recorded (`presentable: []`) | v2-16 |
| Counted by answering an assignment (`presentable: assignment`) | recorded | v2-16 |
| Counted by several things (a module and a Task; links joined with `;`) | `schedulePresence` with `patch: { presentable: [...], url }` | v2-16 |
| Read Module, Join Discussion, Do Exam, Join Vicon, CRS categories | `schedulePresence` with `patch: { presentable: [...] }` | v2-16 |
| Student marked present | `markPresent` | v2-16 |
| More sessions than one page | recorded total 15 over pages of 10 | #74 |
| Class without Edunex Presence | recorded (four of five courses) | #74, v2-16 |

## Edunex: materials, announcements, exams, notifications, gradebook

| State or event | How | Ticket |
|---|---|---|
| Material type `pdf`, `text`, `ms-teams` | recorded | #74 |
| Material type `video`, `audio`, `url`, `file`, `h5p`, `zoom`, `google-meet`, `webex`, `cloudx` | `postMaterial` with that `type` (clone of a recorded content) | #74 |
| Material added or removed | `postMaterial`, `deleteMaterial` | #74, #75 |
| Material posted just before today's class | `postMaterial` at a chosen clock time | #75 |
| Parent and child class (info only in the parent) | recorded | #74 |
| Meeting announced only in a text item | recorded | #74, #77 |
| Announcement posted | `postAnnouncement` | #74 |
| Online exam on Edunex | needs a recording (none on the account) | v2-17 |
| Notification types `CONTENT`, `ASSIGNMENT` | recorded | #75 |
| Notification types `MESSAGE`, `COMMON`, `TASK`, `GROUP`, `COMMENT` | needs a recording (shape is the same list item; type from the website code) | #75 |
| Gradebook unpublished (`total: 0`, `index: "E"`) | recorded | #78 |
| Gradebook published | `publishGradebook` | #78 |

## SIX

| State or event | How | Ticket |
|---|---|---|
| Status page with attendance counts ("Hadir X dari Y pertemuan") | recorded; `setAttendance` | #76, v2-16 |
| Count didn't go up after a class | `setAttendance` with `held + 1` | v2-16 |
| Month timetable with rooms and UTS sessions | recorded (one month) | #77 |
| Meeting moved (time or room) | `moveMeeting` | #77, v2-18 |
| Classes that overlap | recorded | #77 |
| Other months of the timetable | the recorded page with that month's tab and an empty grid (`?bulan=`); real other months need a recording | #76, #77 |
| A meeting in another month (an extra one, a quiz, one on the edge of the next month's grid) | `addMeeting`: it shows on every month page whose grid holds that day | #77 |
| Pages in English (SIX's language switch) | `world.six.useEnglish()`; SIX's own English wording needs a recording (the readers don't depend on wording) | #76 |
| Grade released | `releaseGrade` (status page); `gradeCourse` (transcript and curriculum position) | #78 |
| Transcript, curriculum position | recorded | #78, #79 |
| Grade changed, T (incomplete) grade | `gradeCourse` | #78 |
| Repeated course | `retake`, then `gradeCourse` and `markOnTranscript` | #78 |
| Course not counted in the transcript ("Masuk Transkrip" ✗) | `markOnTranscript` | #78 |
| Course passed under an older code | recorded (KI1002-19 in the 2024 curriculum) | #79 |
| KRS sent, approved, changed (URS) | recorded; `krsStep`, `dropKrsChange`, `krsCourse` | #80 |
| KRS step not taken yet, course not approved by the advisor | needs a recording (an empty cell stands in) | #80 |
| Bills (paid, in instalments, not billed yet) | recorded; `setBill` | #80 |
| Course questionnaire window | recorded | #80 |
| Curriculum structure (required, specializations, minors) | recorded | #79 |

## Public sources

| State or event | How | Ticket |
|---|---|---|
| Public catalog index and program pages | `test/fixtures/pub`, served by `world.itb` (other programs answer 404) | #79, #84 |
| A program page answering 500 | `world.itb.fail(path, 500, times)` | #84 |
| Catalog page layout changed | `world.itb.changeLayout(path, from, to)` | #84 |
| ITB academic calendar feed | `test/fixtures/itb/kalender-pendidikan.ics` (the 2026/2027 events of the public feed) | #84 |
| Calendar changed (a moved exam week, not a calendar any more) | edit `world.itb.calendar` | #84 |
| Offline with a cached copy | `world.setOffline(true)` after a first read | #84 |

## The outside world

| Event | How | Ticket |
|---|---|---|
| Edunex session expired (401 on everything) | `world.edunex.expireSession()` | #71 |
| SIX session ended (redirect to `/login`) | `world.six.expireSession()` | #76 |
| Network down | `world.setOffline(true)` | #71 |
| Slow network, request timeout | `world.setLatency(ms)` with `timeoutMs` | #71 |
| Edunex maintenance page (503 HTML) | `world.edunex.maintenance()` | #71 |
| Error statuses 401, 403, 404, 429, 5xx | `world.edunex.fail(path, status, times)`, `world.six.fail(…)` | #71, #75 |
| SIX rate limit (429) | `world.six.rateLimit(n)` | #76 |
| The Student acts on the website (submits, opens material) | `submitOnWebsite`, `markPresent` | #72, v2-16 |

## Vendor changes

The app must say "Edunex (or SIX) changed something" instead of showing empty
screens.

| Breakage | How | Ticket |
|---|---|---|
| Missing field | `mangle(path, { kind: "missing-field", field })` | #71 onward |
| Wrong type | `mangle(path, { kind: "wrong-type", field })` | #71 onward |
| Unknown new field (must be ignored) | `mangle(path, { kind: "unknown-field", field })` | #71 onward |
| Empty body | `mangle(path, { kind: "empty-body" })` | #71 onward |
| HTML instead of JSON | `mangle(path, { kind: "html" })` | #71 onward |
| SIX table layout changed | `world.six.changeLayout(path, from, to)` | #76 onward |

## The app's own updates

| State | How | Ticket |
|---|---|---|
| A newer release on GitHub | `world.github.latestTag = "v2.1.0"` | #82 |
| Already the latest, or nothing published | `latestTag` = the running version, or `null` (404) | #82 |
| GitHub refuses or is unreachable | `world.github.failWith = 403`, `world.setOffline(true)` | #82 |

## Quick search and the first-run scan

| State or event | How | Ticket |
|---|---|---|
| First full sync done: Edunex, then SIX at human pace, and ITB's calendar | sign in to both, let the fake clock run (`test/engine/first-sync.ts`) | #81 |
| A system stops during the first sync (offline, changed something) | `world.six.fail(timetable, 503)`, `world.six.changeLayout(transcript, …)` | #81 |
| Nothing to say | Tasks, Presence, contents and announcements cleared, after the term's exams | #81 |
| A full term of data | the recorded term spread over 8 courses (16 modules, 60 materials, 20 Tasks and 15 announcements each) | #81 |
| Searching offline | `world.setOffline(true)` after the first sync | #81 |

Tickets named v2-15 to v2-18 come from the approved prototype (public
sources, attendance guard, exams, what changed + first-run scan) and are not
filed on GitHub yet.
