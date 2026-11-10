# A student's days as journeys, on today's app

Read from the code at `34948721`; nothing was run. Companion to `mobile/qa/superapp-map.md` (screens, services, states, demo links).
Taps count presses from the first screen named; typing, scrolling, Back, and presses inside SIX's own page are not taps.
"Top" is the target from the brief. Demo: the made-up student Dimas, Thursday 8 Oct 2026, PL3002 on at 08:07.

Ordered by how far each is from its top, longest and most confusing first.

| # | Journey | Top | Today | Far? |
| --- | --- | --- | --- | --- |
| 1 | After an exam: my grade, and what it does to my IPK | 2 taps | 2 taps + one or two screens of scrolling for the IPK effect; the exam's own grade is 3 taps and a different screen; three things called "Nilai" | far, confusing |
| 2 | After class: this week's material for that course | 2 taps | 3 taps (Kuliah, the course, the module); from the class sheet it lands on the wrong tab | far |
| 3 | A class starts: presence marked, then "what's next" | 2 taps, lands somewhere useful | 1 tap to SIX, then Back lands on the *same* card ("Sudah ke SIX"); "what's next" never takes over | far in the landing |
| 4 | A deadline: Beranda to the brief to handed in to "done" | 3 taps to the brief; a clear finish | brief in 1 tap; hand-in is 4 taps + the answer; the finish is a moment, then nothing leads on | close, ends flat |
| 5 | The office things: KRS, UKT, the academic calendar | 2 taps each | 2 taps each; 1 tap when due (a row on Beranda). Akademik is folding away | at the top, but the road moves |
| 6 | Morning: my day, what's due, am I safe | 0 taps, first screen | 0 taps for two of three; "safe" is only silence; the day's later classes sit under the fold | close |
| 7 | I'm looking for something by name | 2 taps after typing | 1 tap + type + 1 tap = at the top; a blank page before typing; results use old names | at the top |

---

## 1. After an exam: my grade, and what it does to my IPK

Two grades live in two places. SIX's grade and the IPK are on **Nilai** (`/grades`). A lecturer's grade for one course, published on Edunex, is on that **course's Nilai tab**.

**Path A: SIX has the grade (the IPK effect).** Demo: `EDUNEX_DEMO=signed-in` (the "what-if" shows because SIX's term has courses without a grade yet).

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `tab.academic` ("Akademik") | 1 |
| 2 | Akademik | `action.academic.grades` (the IPK card; or `row.nav.grades` "Nilai") | 2 |
| 3 | Nilai | `card.standing`: the IPK, big. No tap. | 2 |
| 4 | Nilai | scroll past `card.chart` to `section.thisTerm` ("Semester ini"): this term's courses with SIX's grade at the row's end, then `card.ipkAfter` "IPK setelah semester ini" | 2 + scroll |

From a notification: a "grade" alert (`src/engine/alerts/grades.ts:37,65`) targets `{screen:"grades"}`: 1 tap, to the top of Nilai. Same scroll.

**Path B: the lecturer published it on Edunex.**

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `tab.courses` ("Kuliah") | 1 |
| 2 | Kuliah | `row.course.<code>` | 2 |
| 3 | Course | `tab.course.grades` ("Nilai") | 3 |
| 4 | Course › Nilai | "Nilai di Edunex" (`grade.edunex`) big, or "Belum dirilis dosen" (`grade.unpublished`); the calculator under it | 3 |

Or Akademik → Nilai → a `row.course.<code>` in "Semester ini" → the same course Nilai tab (3 taps).

- **Dead ends:** the course's Nilai tab has no way to the IPK; Nilai's term row opens the course, not back to the effect. Only Back.
- **Back:** all pushes (`nav.go` → `router.push`); Back returns step by step. A grade notification's tap lands with the previous screen being whatever was open. Fine.
- **Names that change:** "Nilai" is three things: the Akademik row and screen (`nav.grades` "Nilai": transcript, IPK), the course tab (`course.tab.grades` "Nilai": one course's grade parts), and the alert kind "grade" in Notifikasi. The same grade is "Nilai di Edunex" (`grade.edunex`) on the course and just a letter at the row's end on Nilai. "IPK" (`grades.chart.ipk`), "IP semester" (`grades.chart.ip`), "IP semester lalu {ip}" (`mobile.grades.lastIp`), "IPK setelah semester ini" (`grades.ipkAfter`), "SKS lulus" (`grades.sksPassed`): five names for six numbers. The calculator is "Butuh berapa?" (`grades.whatNeed`) at the row and "Butuh rata-rata …" at the honor row.
- **Flows:** `mobile/qa/flows/r3/05-grades.yaml` (Akademik → Nilai, 2 taps, stops at the top), `mobile/flows/round2/w12-one-target-akademik.yaml` (the IPK card is one press), `mobile/qa/flows/r2-akademik.yaml` (pictures). Nothing walks to `card.ipkAfter` or the course Nilai tab on its own.

**After the new layout:** 1 tap if "Nilai" is a tile on Beranda, 2 from "Semua layanan" or Profil; `card.ipkAfter` needs to be the second thing on Nilai (above the chart) or a strip tile ("IPK 3,41 → 3,52"); the grade notification should land on `section.thisTerm`, not the top. Needs: a tile `Nilai`, and a rename so the course tab says "Nilai mata kuliah" or Nilai says "Nilai & IPK".

---

## 2. After class: this week's material for that course

Demo: any signed-in link; "Modul terbaru" shows for a course when a module got something in the last 7 days (`newestEntry`, `mobile/src/screens/course/contents.ts`).

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `tab.courses` | 1 |
| 2 | Kuliah | `row.course.<code>` | 2 |
| 3 | Course (opens on Modul) | `action.newestModule` ("Modul terbaru: {title}") or `row.module.<id>` | 3 |
| 4 | Module | the files and notes open here (`screen.module`); a file opens in the phone's own app | 3 |

**From the class on Beranda:**

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `action.nowClass` (the card) → `sheet.nowClass` | 1 |
| 2 | Class sheet | `action.openCourse` ("Buka mata kuliah") | 2 |
| 3 | Course, **on Pertemuan** (`tab: "meetings"`, `class-sheet.tsx` `target`) | `action.newestModule` (it sits above the tabs, so it shows) | 3 |
| 4 | Module | | 3 |

From a "new material" alert: the alert targets `{screen:"course", tab:"modules", module:<id>}` (`src/engine/alerts/changes.ts:80`): **1 tap** to the module.
Through search: `action.search` → "PL3002" or the module's title → a `module` result opens the module (`search.ts` has `module` and `material` kinds): 1 + typing + 1.

- **Dead ends:** a course with no new module has no "Modul terbaru" line and nothing says so; the Student must open the Modul tab. A module the lecturer hasn't opened is greyed: no tap, no reason beyond the grey. A file no app on the phone can open says so on its row with a way forward (`w01-files.yaml`). No dead end at the module itself.
- **Back:** Module → course → Kuliah (all pushes). From the class sheet the sheet closes first (`onLeave`), so Back goes module → course → Beranda. ✓
- **Names that change:** the thing is "Modul" on the course tab (`course.tab.modules`, EN "Modules"), "Modul terbaru" (`mobile.course.newestModule`, EN "Newest module"), "Materi" only in search's hint (`mobile.search.placeholder` "Cari mata kuliah, tugas, materi") and kinds, "Modul {n}" in search (`course.module`), "Pengantar"/Introduction (`course.intro`) for the course-wide one. The course tab is "Modul" but the class sheet sends the Student to "Pertemuan" (`course.tab.meetings`): the same button opens a different tab than Kuliah's row does. The notification says "{title}" of the material, Beranda's row says the Task.
- **Flows:** `mobile/qa/flows/r3/04-course-material.yaml` (Kuliah → first course → first module: 3 taps), `mobile/flows/round2/w01-files.yaml` (files in a module, `EDUNEX_DEMO_FILES=1`), `mobile/qa/flows/to-courses.yaml`.

**After the new layout:** 1 tap from a "Materi" tile (a view across all courses: `edunex.outline` + `edunex.materials`, see map §2b A), 2 from a course on Kuliah if the course opens straight on its newest module, and the class sheet's "Buka mata kuliah" lands on Modul, not Pertemuan. Needs: a tile or Beranda strip item "Materi baru" (the cross-course view), `action.newestModule` kept as the course's first line, and one landing tab for every way into a course.

---

## 3. A class starts: presence marked, then back to "what's next"

Demo: `EDUNEX_DEMO=signed-in&EDUNEX_DEMO_CHECK_IN=open` (SIX's Tandai Hadir is open for the class on now). With Android's shade: `…&EDUNEX_DEMO_NOTIFY=1&EDUNEX_DEMO_NOW=2026-10-08T07:57:00%2B07:00` (proven by `w13-tandai-hadir.yaml`).

**From Beranda:**

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `action.checkIn` ("Tandai Hadir", on the now card) | 1 |
| 2 | SIX's page in the app (`screen.checkIn`, bar "SIX · Tandai Hadir"; the class's popup is open) | SIX's own button: **not ours, not counted** | 1 |
| 3 | Back | back to Beranda | 1 |
| 4 | Beranda | the card now reads `card.now.checkedIn` "Sudah ke SIX · 08:12" with a check that draws itself | 1 |

**From the notification:** "Kuliah sudah mulai" has an Android action "Tandai Hadir" (`w13-tandai-hadir.yaml`) → `six.openCheckIn` → `/check-in/<id>` directly: 1 tap on the shade, then SIX's button, then Back.
**An Edunex Presence** (not SIX): the card shows `action.presence` "Buka tugasnya" / "Isi Presensi" → the Task (1 tap) or Edunex's page.

- **Dead ends:** in the **demo** the SIX page is a placeholder ("Di aplikasi asli, halaman SIX terbuka di sini…", `mobile.page.demo`): the only exit is Back. In the real app the page is SIX's own: signed out of SIX, it shows SIX's sign-in. The page closes by itself if SIX signs out (`signed-page.tsx:86`). The card says "Sudah ke SIX": the app cannot know that the button was pressed, only that the Student went; SIX's count follows later (`recheckAttendance`, at most once a minute). **The card does not move on to "what's next"** until the class ends: the next class is under "Nanti hari ini" (`section.today`) or nowhere.
- **Back:** from Beranda the check-in is a push (`router.push('/check-in/<id>')`, `host/check-in.ts:67`) so Back lands on Beranda ✓ with the sheet closed first (`onLeave`). From the notification on a cold start the stack is just the tabs, so Back lands on the tab the app opened on (Beranda); with the app already open on Kuliah or Tugas, Back lands there, not on Beranda.
- **Names that change:** "Tandai Hadir" (`mobile.notification.checkIn`, EN kept as "Tandai Hadir") on the button; "SIX · Tandai Hadir" (`six.checkInTitle`, the same in EN) on the page; "Sudah ke SIX · {time}" (`mobile.home.wentToSix`, EN "Went to SIX") after; the word the Student wants, "Hadir" (present), is not said after. Edunex's own is "Isi Presensi" (`home.now.edunexStep`) and "Presensi" is also the old name of the Kuliah tab (`nav.presence`, still what search calls it), "Dihitung untuk Presensi" (`mobile.home.countsPresence`) and "Sedang berlangsung sampai {time}" (`presence.row.now`) vs "tutup {time}" (`home.need.presence.closes`): the same window's end said two ways on one card (the brief's finding 6).
- **Flows:** `mobile/flows/round2/w13-tandai-hadir.yaml` (the shade's action opens SIX's page), `w10-check-in-done.yaml` (the card's done state), `mobile/qa/flows/r3/03-tandai-hadir.yaml` (stops before SIX), `w12-one-target.yaml` (card = one target).

**After the new layout:** 2 taps or fewer: 1 tap on the strip or card ("Tandai Hadir", opens SIX), Back lands on Beranda with the card's check and the **next class promoted** into the card (an in-between state "Sudah ke SIX" for 1–2 minutes, then "Berikutnya · {time}"). Needs: the now card to move on once SIX counts or the class ends, a way to say "Hadir" once SIX counts it, and one word for the window's end.

---

## 4. A deadline: Beranda to the brief, to handed in, to "done"

Demo: Task 117001 "Tugas 01 Bab I" (a file is required; `EDUNEX_DEMO=signed-in`). Flow-proven: `use.yaml`.

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda "Perlu kamu urus" | `row.need.<id>` (the Task; or `tab.tasks` → `row.task.<id>` = 2) | 1 |
| 2 | Task | the brief is the first screen: `card.due` (deadline, time left, status) then `section.instructions`, `section.files` | 1 |
| 3 | Task | the answer: type into `input.answer` or `action.attach` (Android's file picker, a few presses of its own) | 1–2 |
| 4 | Task | `action.submit` ("Kumpulkan") | 2–3 |
| 5 | `sheet.submit` | `action.submitConfirm` ("Kumpulkan sekarang"; "Tetap kumpulkan" when something is off) | 3–4 |
| 6 | Task | "Terkumpul" (`mobile.tasks.handedIn`) over the page for a breath, with a check that draws itself and a haptic; then `card.handIn` says "Edunex mencatatnya hari ini, 08:13"; `h.sent` line "Sudah diserahkan. Hanya dosen yang bisa mengembalikannya." | 3–4 |
| 7 | Back | Beranda; the row is gone | +Back |

- **Dead ends:** the finish stays on the Task: nothing leads on (no "next due", no "back to Beranda"); the only exits are Back and the crumb `action.course` (to the course). With a hand-in refused there is a `notice.handIn` with one fix (offline, signed out, closed, not open yet, gone, unconfirmed → "Buka di Edunex" `action.openInEdunex`). Not found: `task.notFound` + "Ke Tugas & Ujian" (`task.backToTasks`) which **replaces** the stack (`nav.go` to a tab does `dismissAll`): Back afterwards does not return to the Task.
- **Back:** Beranda → Task is a push, so Back returns to Beranda ✓. Task → course (crumb) → Back → Task ✓. Task → `action.exam` (a take-home) → Back → Task ✓.
- **Names that change:** the Student presses "Kumpulkan" (`handIn.submit`; EN "Hand in" on the phone, `mobile.ts:464`, but the desktop's `tasks.ts:173` says "Submit": two definitions of one key, the later wins) and the result is "Terkumpul" (`taskStatus.submitted`, EN "Submitted"; `mobile.tasks.handedIn` says "Terkumpul"/"Handed in" for the same moment; `handIn.final` says "Sudah diserahkan", EN "Handed in"): ID has "terkumpul" and "diserahkan" for one fact; EN has "Hand in" / "Submitted" / "Handed in". The list calls the group "Terkumpul" (`tasks.group.submitted`) and the filter "Selesai" (`tasks.filter.done`): done and handed in are different words for the same Tasks. Beranda says "Perlu kamu urus" (`mobile.home.toHandle`), Tugas says "Tugas & Ujian" over a tab named "Tugas", and the Task's bar is the Task's own title;
- **Flows:** `mobile/flows/use.yaml` (an answer and `jawaban.pdf` from Android's picker, Kumpulkan, "Tetap kumpulkan", the status and the history), `mobile/flows/round2/w10-hand-in-moment.yaml` (the finish check and haptic), `mobile/qa/flows/r3/02-task-file.yaml` (Beranda's Task → its file), `mobile/flows/round2/w04-hierarchy.yaml` (the brief opens on the deadline), `mobile/qa/flows/v4-tasks.yaml`.

**After the new layout:** the brief stays 1 tap (a `row.need` in the strip or "Perlu kamu urus", or a Tugas tile that opens the list). The finish needs to **lead on**: after "Terkumpul", a line "Berikutnya: {next Task}, {when}" or a way back to the strip, so the Student is not left on a page whose job is done. Needs: the next due Task from `dueItems` (`src/core/needs.ts:580`), one English word for the hand-in ("Handed in" everywhere).

---

## 5. The office things: KRS, UKT, the academic calendar

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `tab.academic` | 1 |
| 2 | Akademik | `row.nav.plan.krs` or `.bills` or `.deadlines`; when due, also the chip `action.todo.krs` ("Kirim KRS") / `action.todo.bills` ("Bayar UKT") / `action.todo.deadlines` ("Isi kuesioner") | 2 |
| 3 | `/plan/<part>` | KRS: the term's list and clashes; UKT: paid/due; Kalender: the dates | 2 |

When the KRS window is open or a bill falls due soon, the same thing is a **row on Beranda** ("Perlu kamu urus": `need.kind` `krs` / `bill`, `go plan krs|bills`, `src/core/needs.ts:712–751`): **1 tap**. Otherwise 2.

- **Dead ends:** no screen here is a dead end. KRS's clash sheet (`sheet.krsClash`) has `action.toSchedule` (`krs.toSchedule`, `krs.tsx:257`) that does `nav.go({screen:"schedule"})`, a tab: the KRS screen is **dismissed** (`dismissAll`), so Back from Jadwal does not return to KRS. Without SIX each part shows `note.sixNeeded` + "Masuk ke SIX" (`action.signInSix`): a way out, not a dead end.
- **Back:** Akademik → part is a push; Back returns to Akademik ✓. From a Beranda row: Back returns to Beranda ✓. From the Akademik chip: ✓.
- **Names that change:** the tab is "Akademik" (`mobile.tab.academic`), the group in search is "Rencana studi" (`nav.plan`), its first part is "Rencana" (`plan.tab.planner`) and so is the screen's bar; "Kalender akademik" (`plan.tab.deadlines`) vs Jadwal's "Lihat sebulan"/Bulan (`mobile.schedule.month`) which also shows ITB's dates (Masa UTS): two calendars, one name each. "Perlu kamu urus" is also the heading of Akademik's chips (`mobile.academic.todo`, EN "To take care of") although it names a different list than Beranda's `mobile.home.toHandle` (EN "To handle"); the same Tab's badge says "Perlu perhatianmu" (`home.needs`, EN "Needs you") to TalkBack. "Isi kuesioner" (`mobile.academic.todo.deadlines`) opens "Kalender akademik".
- **Flows:** `mobile/qa/flows/r2-akademik.yaml`, `mobile/qa/flows/to-curriculum.yaml` (Akademik → Kurikulum), `mobile/flows/judge/walk.yaml` (each plan part), and the generated per-scenario flows from `mobile/flows/screens.json` (`plan` entries; "plan 178/178" in PROGRESS). `EDUNEX_DEMO_ODD=1` shows UKT unpaid (the chip).

**After the new layout:** 1 tap each from tiles (KRS, UKT, Kalender) on Beranda's grid or from "Semua layanan" (2). Profil keeps the IPK and SKS card and the same rows. Needs: three tile names that are the words the app already says ("KRS", "UKT", "Kalender" is the first word of "Kalender akademik"), and `screens.json` re-pointed at Profil (`tab.academic` → `tab.profile`, see `superapp-flows.md`).

---

## 6. Morning: what's my day, what's due, am I safe

Beranda's first screen today (blue bar, then the now card, "Perlu kamu urus" up to 5 rows (`URUS_ROWS`), at most 3 of them absences (`URUS_ABSENCES`), then "Nanti hari ini"). No taps.

| Question | Where it's answered today | Taps |
| --- | --- | --- |
| What's my day | `card.now` (the class on / next / later, with the wave and the minutes left); the rest of the day is `section.today` "Nanti hari ini", **below** "Perlu kamu urus", so on a short phone or a big font it is under the fold | 0 (now), 0 + scroll (the rest) |
| What's due | "Perlu kamu urus": Tasks with the day, exams, KRS/UKT when due, each row one tap to its page (`row.need.*`) | 0 |
| Am I safe | only as absence rows (`row.need.absence.<code>`, "Absen lewat 1×", "Jatah habis") and the Kuliah tab's red badge. When nothing is wrong the page says "Tak ada yang perlu diurus" (`mobile.home.toHandleNone`), which is about Tasks, not absences: **"safe" is silence** | 0 |

- **Dead ends:** none; the empty line is itself a button to `/needs`. Without SIX the now card and "Nanti hari ini" vanish (`now.tsx:77`) and nothing says why; the banner says nothing either when SIX never had data.
- **Back:** n/a on the first screen. From `/needs` Back returns to Beranda ✓.
- **Names that change:** the list is "Perlu kamu urus" (`mobile.home.toHandle`) on Beranda and on `/needs`, "Perlu perhatian" (`mobile.kuliah.attention`) on Kuliah, "Perlu perhatianmu" (`home.needs`) to the tab's screen reader, "Perlu kamu urus" again on Akademik for a different list: four phrases, three lists. "Nanti hari ini" (`mobile.home.laterToday`) vs Jadwal's "Hari ini" button (`mobile.schedule.today`). "Yang berubah" (`home.changes`) on `/needs`, "Notifikasi" (`alerts.title`) for the same history behind the bell. "Kuliah" is both the tab and a class ("Tak ada kuliah 7 hari ke depan", `mobile.home.free`).
- **Flows:** `mobile/qa/flows/r3/01-today-due.yaml` (0 taps, read-only), `mobile/flows/smoke.yaml` (greeting + the card), `mobile/flows/round2/w04-home-hierarchy.yaml`, `mobile/qa/flows/home-tour.yaml`, `mobile/qa/flows/rec-home-v4.yaml`, `flows/judge/walk.yaml` (01).

**After the new layout:** 0 taps for all three: the strip says what's due (the count and the first one) and attendance at risk in a word or a mark ("Aman" as a check, not silence); the now card keeps the class; the rest of the day is the Jadwal tab (1 tap) unless it fits. Needs: a strip item for "absences: safe / at risk" computed from `useAttendance` (already read), and a decision about where "Nanti hari ini" goes.

---

## 7. I'm looking for something by name

| Step | Screen | Tap | Taps |
| --- | --- | --- | --- |
| 1 | Beranda | `action.search` (a magnifier in the bar) | 1 |
| 2 | Search (`screen.search`, keyboard up; the field's hint "Cari mata kuliah, tugas, materi") | type | 1 |
| 3 | Results grouped by kind (`row.search.<key>`: courses, Tasks, exams, modules, announcements, screens like "KRS", "Nilai", "Pengaturan", and verbs "Muat ulang data" (`search.action.refresh`), "Ke tema gelap" (`search.action.themeTo`)) | the result | 2 after typing |

- **Dead ends:** before anything is typed the page is **empty** (the index has `suggestions()`: recent, next 3 open Tasks, courses, screens, verbs; `src/core/search.ts:525`; not drawn). No match: "Tidak ada yang cocok dengan “{query}”" and the field, no way on. Nothing is lost: Back/clear.
- **Back:** a result calls `router.back()` then `nav.go(target)`: the search closes, the target is pushed over the screen the Student searched from, so Back returns to that screen ✓ (Settings uses `router.replace`: also ✓). **Exception:** a result that is a *tab* (Beranda, Jadwal, Tugas & Ujian, Presensi) does `dismissAll` + tab switch; Back afterwards depends on the tab bar's own history (not read from the code; the same pattern as notification taps).
- **Names that change:** the search hint says "materi", the results call them "Modul {n}" (`course.module`); the screens group says "Presensi" (`nav.presence`) for the Kuliah tab and "Tugas & Ujian" (`nav.tasks`) for the Tugas tab and "Rencana studi" (`nav.plan`) for Akademik's parts: **the results use the old, desktop names**, the tabs the new ones. The icon is "Cari" (`search.open`) while the bar's field is "Cari mata kuliah, tugas, materi".
- **Flows:** `mobile/qa/flows/r2-akademik.yaml` and `r2-tasks-academic.yaml` open Search for pictures (`action.search`), `mobile/flows/judge/walk.yaml` (23), and the generated `screens.json` search entries (27/27 in PROGRESS: they type and check the result groups). I found no flow that opens a result to its target and checks Back.

**After the new layout:** `home.search` is a bar on Beranda: 1 tap into Search, and the same results two taps in total after typing. Needs: the search page to open on `suggestions()` instead of a blank; result labels renamed to the tab names (Kuliah, Tugas, Profil's parts); `action.search` kept on the other tabs.

---

## Every journey

| Check | Today | Where |
| --- | --- | --- |
| No dead end | One flat finish: the handed-in Task (journey 4). One demo-only dead end: the SIX page placeholder (journey 3). Search before typing is blank (journey 7). Nothing else found; empty states carry a button or a retry | `hand-in.tsx`, `signed-page.tsx:104`, `app/search.tsx` |
| Back returns to where it came from | **Yes** for every push (`router.push` / `nav.go` on a non-tab route): Beranda → Task/course/exam/grades/plan, course → module, bell, search, settings. **Not** when the target is a *tab* and the Student is on a pushed screen: `nav.go` does `dismissAll` then `navigate`: KRS's clash sheet → Jadwal (`krs.tsx:257`), Task not found → Tugas (`task.backToTasks`), an alert whose target is Jadwal, Kuliah or Beranda (`app/alerts.tsx:264–268`), a notification tap (`notification-taps.tsx:31`), a Beranda row whose action is `presence` (→ Kuliah tab) | `src/nav.ts:41–47` |
| The same thing has the same name | **No**, in 13 places: see the table below | |

### Names that change (the same thing, two strings, both quoted)

| Thing | String 1 (key) | String 2 (key) | Where they meet |
| --- | --- | --- | --- |
| The Tugas tab | "Tugas" (`mobile.tab.tasks`) | "Tugas & Ujian" (`nav.tasks`) | the tab label, then the page's bar (`list.tsx:247`); search says "Tugas & Ujian"; "Ke Tugas & Ujian" (`task.backToTasks`) |
| The Kuliah tab | "Kuliah" (`mobile.tab.courses`) | "Presensi" (`nav.presence`) | search results; "Mata kuliah" (`nav.courses`) in a course's loading bar; "Buka mata kuliah" (`home.now.openCourse`) |
| Akademik | "Akademik" (`mobile.tab.academic`) | "Rencana studi" (`nav.plan`) | search; "Rencana" (`plan.tab.planner`) the first part and the screen's bar |
| The needs list | "Perlu kamu urus" (`mobile.home.toHandle`) | "Perlu perhatianmu" (`home.needs`) / "Perlu perhatian" (`mobile.kuliah.attention`) | tab's screen-reader name, Kuliah's group; Akademik's chips are "Perlu kamu urus" (`mobile.academic.todo`) too |
| What changed | "Yang berubah" (`home.changes`) | "Notifikasi" (`alerts.title`) | `/needs` vs the bell: the same history, two names |
| A grade | "Nilai" (`nav.grades`) | "Nilai" (`course.tab.grades`) / "Nilai di Edunex" (`grade.edunex`) | one word, three meanings; "Butuh berapa?" (`grades.whatNeed`) |
| Handing in | "Terkumpul" (`taskStatus.submitted`) | "Sudah diserahkan" (`handIn.final`); EN "Submitted" vs "Handed in" vs "Hand in" | the Task page, the list's group, the toast |
| Done vs handed in | "Selesai" (`tasks.filter.done`) | "Terkumpul" (`tasks.group.submitted`) | the segment and the group inside it |
| Presence | "Tandai Hadir" (`mobile.notification.checkIn`) | "Isi Presensi" (`home.now.edunexStep`), "Sudah ke SIX" (`mobile.home.wentToSix`) | the card, the SIX page "SIX · Tandai Hadir" |
| The window's end | "tutup {time}" (`home.need.presence.closes`) | "Sedang berlangsung sampai {time}" (`presence.row.now`) | one card says both |
| Materials | "Modul" (`course.tab.modules`) | "Materi" in search's hint (`mobile.search.placeholder`), "Modul terbaru" (`mobile.course.newestModule`), "Pertemuan" (`course.tab.meetings`, where the class sheet lands) | search, the course |
| Calendars | "Jadwal" (`nav.schedule`) | "Lihat sebulan" (`mobile.schedule.month`), "Kalender akademik" (`plan.tab.deadlines`), "Kalender HP" | four calendars |
| A class | "kuliah" (a class, `mobile.home.free`: "Tak ada kuliah…") | "Kuliah" (the courses tab) | Beranda's free line vs the tab |

## Where the proof stops

All of this is from reading the code at `34948721`. Not run: any demo link, any tap count on a phone, Back on the tab bar (NativeTabs' own history), Maestro. Claims marked "proven" in the map are the ones a flow in the repo already walks. The first thing to check on the phone: the Back behaviour after `dismissAll` + tab (journeys 5 and "Every journey").
