# The phone app as it is today: a map for tonight's new layout

Read from the code at `34948721` (the branch `mobile-superapp-layout`, before the new Beranda). Nothing here was run: no
tests, no demo, no phone. Where a demo link is named, it is built from `mobile/src/demo/world.ts` and
`test/pretend/demo.ts` and marked **proven** only when a flow in `mobile/flows/` or `mobile/qa/flows/` already opens it.
Today `home.search`, `home.strip`, `home.grid` and `tab.profile` do not exist yet; the fifth tab is still `tab.academic`.

Words: "Beranda" the home tab. "taps" count presses from Beranda's first screen, not scrolling or Back.

## 0. How the app is wired (five lines)

- Five tabs, all mounted ahead (`mobile/app/(tabs)/_layout.tsx`): `tab.home` `tab.schedule` `tab.tasks` `tab.courses` (Kuliah) `tab.academic`.
- Everything else is a stack screen pushed over the tabs (`router.push`, `mobile/src/nav.ts`). `nav.go()` to a *tab* route first
  dismisses the stack (`dismissAll`) then switches tab. So Back from a pushed screen returns to where it was pushed from.
- Every tab's top bar ends with three icons (`TabActions`, `mobile/src/shell/source-status.tsx:229`): `action.search`, `action.alerts` (bell), `action.account` (the avatar, opens Settings). Beranda's blue bar has them too.
- Old addresses still work: `/presence` redirects to `/courses`; `/plan?tab=x` to `/plan/x`; `/course/<code>?module=<id>` to its module screen (`mobile/app/presence.tsx`, `plan/index.tsx`, `course/[code]/index.tsx`).
- Links from outside (alerts, notifications, the widget, search) all speak the desktop's `Route` (`src/core/route.ts`): home, tasks, task, exam, course(+tab, +module), schedule, presence, grades, plan(+tab). **There is no Route for Akademik, Notifikasi, Settings or Search**; they are reached by tap only (search treats Settings as a special target).

## 1. Every screen

### Tabs

| Route | File that draws it | testID | For (six words) | Reached from Beranda | Taps |
| --- | --- | --- | --- | --- | --- |
| `/` | `app/(tabs)/index.tsx` → `src/screens/home/index.tsx` | `screen.home` | The class on now, what's due | (home) | 0 |
| `/schedule` | `app/(tabs)/schedule.tsx` → `src/screens/schedule/schedule-screen.tsx` | `screen.schedule` | Classes by day, week strip | `tab.schedule` | 1 |
| `/tasks` (`?show=done`) | `app/(tabs)/tasks.tsx` → `src/screens/tasks/list.tsx` | `screen.tasks` | Tasks and exams by due date | `tab.tasks` | 1 |
| `/courses` | `app/(tabs)/courses.tsx` → `src/screens/presence/presence-screen.tsx` | `screen.courses` | Courses, absences left, risk first | `tab.courses` | 1 |
| `/academic` | `app/(tabs)/academic.tsx` → `src/screens/academic/academic-screen.tsx` | `screen.academic` | IPK, KRS, UKT, Nilai doors | `tab.academic` | 1 |

### Screens pushed over the tabs

| Route | File | testID | For | Reached today (testID or label) | Taps |
| --- | --- | --- | --- | --- | --- |
| `/needs` | `app/needs.tsx` → `src/screens/home/needs-screen.tsx` | `screen.needs` | Whole "Perlu kamu urus" list, changes | `action.needs.all` (the chevron by the heading, or the "Tak ada yang perlu diurus" line) | 1 |
| `/alerts` | `app/alerts.tsx` | `screen.alerts` | Everything the app noticed, by day | `action.alerts` (bell); also `action.changes.all` "Lihat semua" on `/needs` | 1 |
| `/search` | `app/search.tsx` | `screen.search` | Find anything the app has saved | `action.search` | 1 |
| `/settings` (`?at=alerts\|courseColors`) | `app/settings.tsx` → `src/screens/settings/index.tsx` | `screen.settings` | Change one setting, sign out | `action.account` (avatar) | 1 |
| `/first-scan` | `app/first-scan.tsx` → `src/screens/first-scan/first-scan-screen.tsx` | `screen.firstScan` | What the first read found | first run only: `card.firstScan` → `action.firstScan.open` (1); later Settings › Akun `action.firstScan` | 1 / 3 |
| `/licences` | `app/licences.tsx` → `src/screens/licences/licences-screen.tsx` | `screen.licences` | Open-source licences | `action.account` → `action.licences` (Tentang, scroll) | 2 |
| `/report` | `app/report.tsx` → `src/screens/report/report-screen.tsx` | `screen.report` | Report a problem | `action.account` → `action.report` (scroll); or the report card `card.reportAsk` on its own | 2 |
| `/task/[taskId]` | `app/task/[taskId].tsx` → `src/screens/tasks/task-page.tsx` | `screen.task` | One Task: brief, hand it in | `row.need.<id>` on Beranda | 1 |
| `/exam/[examId]` | `app/exam/[examId].tsx` → `src/screens/tasks/exam-page.tsx` | `screen.exam` | When, where, what of an exam | `row.need.<id>` (an exam due), or `tab.tasks` → `row.exam.<id>`, or class sheet `action.openCourse` ("Buka ujian") | 1–3 |
| `/course/[code]` (`?tab=modules\|meetings\|tasks\|grades\|announcements`) | `app/course/[code]/index.tsx` → `src/screens/course/course-screen.tsx` | `screen.course` | One course: modules, meetings, grades | `tab.courses` → `row.course.<code>` (2); or `row.need.absence.<code>` (1); or class sheet `action.openCourse` (2) | 1–2 |
| `/course/[code]/module/[module]` | `app/course/[code]/module/[module].tsx` → `src/screens/course/module-screen.tsx` | `screen.module` | One week's files and notes | course → `row.module.<id>` or `action.newestModule` | 3 |
| `/grades` | `app/grades.tsx` → `src/screens/grades/grades-screen.tsx` | `screen.grades` | IPK, per-term IP, this term's what-if | `tab.academic` → `action.academic.grades` (the IPK card) or `row.nav.grades` | 2 |
| `/plan/planner` | `app/plan/[part].tsx` → `src/screens/plan/planner.tsx` (via `plan-screen.tsx`) | `screen.plan.planner` | Plan semesters, see finish date | `tab.academic` → `row.nav.plan.planner` | 2 |
| `/plan/curriculum` | same → `src/screens/plan/curriculum.tsx` | `screen.plan.curriculum` | Which curriculum courses are done | `tab.academic` → `row.nav.plan.curriculum` | 2 |
| `/plan/krs` | same → `src/screens/plan/krs.tsx` | `screen.plan.krs` | This term's KRS, clashes | `tab.academic` → `row.nav.plan.krs` (or the chip `action.todo.krs`) | 2 |
| `/plan/bills` | same → `src/screens/plan/bills.tsx` | `screen.plan.bills` | UKT: paid, due | `tab.academic` → `row.nav.plan.bills` (or `action.todo.bills`) | 2 |
| `/plan/deadlines` | same → `src/screens/plan/deadlines.tsx` | `screen.plan.deadlines` | Academic calendar dates | `tab.academic` → `row.nav.plan.deadlines` | 2 |
| `/schedule-month` | `app/schedule-month.tsx` → `src/screens/schedule/month-screen.tsx` | `screen.month` | Month grid, pick a day | `tab.schedule` → `action.scheduleMenu` (⋮) → `action.month` ("Lihat sebulan") | 3 |
| `/check-in/[meetingId]` | `app/check-in/[meetingId].tsx` → `src/screens/presence/check-in-page.tsx` + `src/screens/web/signed-page.tsx` | `screen.checkIn` | SIX's page, press its Tandai Hadir | `action.checkIn` on the now card (when SIX shows it) | 1 |
| `/web?url=` | `app/web.tsx` → `signed-page.tsx` | `screen.page.<edunex\|six>` | An Edunex/SIX page, signed in | only ⋮ menus (course ⋮, exam ⋮) and "Buka di …" rows; no tile | 2–3 |
| `/demo` | `app/demo.tsx` | none | The demo link; redirects to `/` | n/a | n/a |
| (no route) welcome | `src/shell/welcome.tsx`, drawn over the tabs while nobody is signed in | `screen.welcome` | Sign in with the ITB account | the first screen of a fresh install | n/a |
| (no route) sign-in page | `src/shell/sign-in.tsx` | `signin.edunex` / `signin.six`, close `signin.close` | Microsoft's page, in the app | `action.signIn` on the welcome; "Masuk ke SIX" buttons (`action.signInSix`, `action.academic.signIn`) | 1 |

### Sheets (all native, over the screen that opened them)

| Sheet | File | testID | For | Reached from Beranda | Taps |
| --- | --- | --- | --- | --- | --- |
| Class (Beranda's) | `src/screens/home/class-sheet.tsx` | `sheet.nowClass` | A class: time, room, absences, buttons | `action.nowClass` (the now card) or a `row.today.<key>` row | 1 |
| Class (Jadwal's own, a meeting only Edunex named) | `src/screens/schedule/details.tsx` | `sheet.class` | Same, without SIX | `tab.schedule` → `row.class.<code>-<hh-mm>` (without SIX) | 2 |
| Course "about" | `src/screens/course/course-sheet.tsx` | `sheet.course` | Lecturer, SKS, attendance in full, target | course → `action.courseAbout` | 3 |
| Meeting | `src/screens/course/meetings.tsx` | `sheet.meeting` | One meeting's details | course → Pertemuan → `row.meeting.<key>` | 4 |
| Grade part | `src/screens/course/grades.tsx` | `sheet.gradePart` | Rename/remove a grade part | course → Nilai → part ⋮ | 5 |
| Kuliah facts | `src/screens/presence/footer.tsx` | `sheet.kuliahFacts` | Today's answer, how absences count | `tab.courses` → `action.coursesMenu` → `action.howCounted` | 3 |
| Targets | `src/screens/presence/targets-sheet.tsx` | `sheet.targets` | Attendance target per course | `tab.courses` → `action.coursesMenu` → "Target kehadiran" | 3 |
| Clash pick | `src/screens/presence/now.tsx` | `sheet.clash` | Two classes at once: pick one | `tab.courses` → `action.clashPick` | 2 |
| Snooze | `src/parts/snooze.tsx` | `sheet.snooze` | Put a row off ("Ingatkan nanti") | swipe a `row.need.*` (or long-press) | 1 |
| Course colour | `src/parts/course-color-picker.tsx` | `sheet.courseColor` | Pick a course's colour | long-press `row.course.<code>` | 2 |
| Submit confirm | `src/screens/tasks/hand-in.tsx` | `sheet.submit` | "Kumpulkan tugas ini?" | Task → `action.submit` | 2+ |
| Handed in another way | `src/screens/tasks/hand-in.tsx` | `sheet.handled` | Mark handed in elsewhere | Task → `action.markHandled` | 2+ |
| Task: presence why | `src/screens/tasks/task-page.tsx` | `sheet.presence` | Why a Task counts for Presensi | Task → `line.presence` | 2 |
| Task: compare | same | `sheet.compare` | What the lecturer changed | Task → edited note | 2 |
| Honors why | `src/screens/grades/grades-screen.tsx` | `sheet.honorsWhy` | What the next honor needs | Nilai → `action.honorsWhy` | 3 |
| Grade pick | `src/screens/plan/projection.tsx` | `sheet.grade` | Pick an expected grade | Nilai → a term row | 3+ |
| Plan sheets | `src/screens/plan/*.tsx` | `sheet.addCourse`, `sheet.plannedCourse`, `sheet.minor`, `sheet.rule`, `sheet.planner.about`, `sheet.planner.targetOutWhy`, `sheet.curriculumCourse`, `sheet.curriculumNotes`, `sheet.standIn`, `sheet.krsClash`, `sheet.deadline` | one fact or one pick each | Akademik → part → a row | 3+ |
| Settings sheets | `src/screens/settings/*.tsx` | `sheet.dueTimes`, `sheet.snoozed`, `sheet.target`, `sheet.account.<source>`, `sheet.signOutAll` | pick a value, confirm a sign-out | avatar → a row | 2+ |
| Sources | `src/shell/source-status.tsx` (`SyncPanel`) | (opened by `action.syncStatus`) | Which sources are read, "Perbarui sekarang" | the greeting / a tab's title | 1 |
| Row sheet | `src/screens/home/parts.tsx` | `sheet.row` | Quick actions of a row | long-press a Beranda row | 1 |
| Licence | `src/screens/licences/licences-screen.tsx` | `sheet.licence` | One licence text | Settings › Lisensi › a row | 3 |

Count: 5 tabs, 20 routes pushed over them (plus 2 redirects, `/presence` and `/plan`, and `/demo`), 2 full screens with no route (welcome, sign-in page), and about 40 sheets (some tables above fold several into one row).

## 2. Services a student would name

"Daily / weekly / term" is my judgement. "Reads" = the datasets (`src/core/models`) and hooks. "Opens" = the screen today.
Names are the app's own (`src/core/strings`).

### 2a. What exists today as a screen

| # | Service | ID name (key) | EN name | Opens | Rhythm (why) | Reads |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tasks and exams | **Tugas** (`mobile.tab.tasks`; the page says "Tugas & Ujian", `nav.tasks`) | Tasks | `/tasks` | daily: deadlines move | `edunex.tasks`, `edunex.exams`, `six.schedule` (sittings), `edunex.presence` |
| 2 | Schedule | **Jadwal** (`nav.schedule`) | Schedule | `/schedule` | daily: where am I | `six.schedule`, `six.scheduleUnread`, `edunex.announcements` (meetings) |
| 3 | Month of classes | **Bulan** ("Lihat sebulan", `mobile.schedule.month`) | Month view | `/schedule-month` | weekly: plan ahead | `six.schedule`, `six.scheduleMonths`, `itb.calendar` |
| 4 | Courses and absences | **Kuliah** (`mobile.tab.courses`; old name "Presensi" `nav.presence`) | Courses | `/courses` | weekly: absences creep | `six.courses`, `edunex.courses`, `edunex.presence`, `useAttendance` |
| 5 | Mark presence | **Tandai Hadir** (`mobile.notification.checkIn`) | Tandai Hadir (kept Indonesian in English) | now card button → `/check-in/<id>` | daily: class days | `six.checkIn`, `six.schedule`, `edunex.presence` |
| 6 | Grades and IPK | **Nilai** (`nav.grades`) | Grades | `/grades` | once a term: after exams | `six.transcript`, `six.progress`, `edunex.outline` (grade), `usePlan` |
| 7 | Study plan | **Rencana** (`plan.tab.planner`; group name "Rencana studi" `nav.plan`) | Plan | `/plan/planner` | once a term: pick courses | `six.curriculum`, `itb.catalog`, planner datasets, `usePlan` |
| 8 | Curriculum | **Kurikulum** (`plan.tab.curriculum`) | Curriculum | `/plan/curriculum` | once a term: what's left | `six.curriculum`, `six.transcript` |
| 9 | KRS | **KRS** (`plan.tab.krs`) | KRS | `/plan/krs` | once a term: enrol, check | `six.krs`, `six.schedule` (clashes) |
| 10 | Tuition | **UKT** (`plan.tab.bills`) | UKT | `/plan/bills` | once a term: pay | `six.bills` |
| 11 | Academic calendar | **Kalender akademik** (`plan.tab.deadlines`) | Academic calendar | `/plan/deadlines` | once a term: dates | `itb.calendar` (ITB's feed) |
| 12 | Things changed / alerts | **Notifikasi** (`alerts.title`; Beranda's row says "Yang berubah" `home.changes`) | Notifications | `/alerts` | daily: what's new | `app.alerts` (the engine's history) |
| 13 | Whole to-handle list | **Perlu kamu urus** (`mobile.home.toHandle`) | To handle | `/needs` | daily: what's due, absences, clashes | `useHomeWorld` → `src/core/needs.ts`, `app.snoozes` |
| 14 | Search | **Cari** (`search.open`) | Search | `/search` | daily: find a course or Task by name | 12 datasets (`SEARCHED` in `mobile/app/search.tsx`) |
| 15 | Settings | **Pengaturan** (`nav.settings`) | Settings | `/settings` | rare: set once | `app.settings` |
| 16 | Course page | **Mata kuliah** (name: the course's own; `nav.courses` only in loading) | Course | `/course/<code>` | weekly: materials, grades | `edunex.outline`, `edunex.materials`, `edunex.announcements`, `six.courses` |
| 17 | Grade calculator | **"Butuh berapa?"** (`grades.whatNeed`) | "What do I need?" | course → Nilai tab, or Nilai's term row | per exam: once or twice a term | `edunex.outline` (weights) + `six.transcript` |
| 18 | Done Tasks | **Selesai** (`tasks.filter.done`) | Done | `/tasks?show=done` | occasional | `edunex.tasks` |
| 19 | Phone calendar and class reminders | **Kalender HP**, **Pengingat kuliah** (Jadwal ⋮) | Phone calendar, Class reminder | Jadwal ⋮ rows | once: set and forget | `six.schedule` |
| 20 | Attendance targets | **Target kehadiran** (`mobile.courses.targets`) | Attendance targets | Kuliah ⋮ → sheet | once a term | settings |
| 21 | Course colours | **Warna mata kuliah** (`nav.courseColors`) | Course colors | Settings group | once | `app.courseColors` |
| 22 | First-read summary | **Ringkasan** (first scan) | Summary | `/first-scan` | once | `useFirstScan` (saved datasets) |
| 23 | Report a problem | **Laporkan masalah** | Report a problem | `/report` | rare | `app.reports` |
| 24 | Open SIX / Edunex | **Buka di SIX** | Open in SIX | `/web?url=` | occasional (records SIX alone has) | none (a web view) |

### 2b. Views the app could show from data it already reads, with no screen today

| # | View | ID name (proposed from existing words) | Where the data is | Why it's worth a tile |
| --- | --- | --- | --- | --- |
| A | This week's material across all courses | **Materi** ("Modul terbaru", `mobile.course.newestModule`) | `edunex.outline` + `edunex.materials` (`postedAt`/`updatedAt`); the per-course rule is `newestEntry()` in `mobile/src/screens/course/contents.ts` (last 7 days); `useCoursePage(code)` in `src/app/screens/course/data.ts` builds one course's page; `useTermCourses()` lists the courses. A cross-course list loops the term's courses | Journey "after class": today it is Kuliah → course → `action.newestModule` → module (3 taps) and only *inside* a course |
| B | Announcements across all courses | **Pengumuman** (`course.tab.announcements`) | `edunex.announcements` (per course, `perCourse(Announcement)`); today only the course's own tab shows them | A lecturer's notice about a moved class is in no list outside one course |
| C | Exams only | **Ujian** (`nav.exam`) | `useExams()` (`src/app/…`, `src/core/exams.ts`, `exam-sittings.ts`): UTS/UAS/Kuis with day, time, room; today mixed into Tugas, "Masa UTS" expandable | After-exam journey, and "when is my UTS" |
| D | Today's classes as a list | **Hari ini** | `six.schedule` (`todayPlan(context)`), shown as "Nanti hari ini" only for classes still to come, on Beranda | Beranda already has the data |
| E | This term's courses with their grades (Edunex's published) | **Nilai semester ini** | `edunex.outline[code].grade` (`WithoutSix` in `grades-screen.tsx` shows it only when SIX is missing) | A published grade after an exam; "Nilai" today leads with the IPK |
| F | Lecturers | **Dosen** | `six.courses` (lecturer in the course sheet) | Low value; skip |
| G | What's put off | **Ditunda** | `app.snoozes` (`row.snoozed` on `/needs`) | Low value; skip |
| H | Search with suggestions before typing | (Search page) | `suggestions()` in `src/core/search.ts:525`: recent opens, next 3 open Tasks, this term's courses, screens, verbs. **The phone's search shows nothing until you type** (`mobile/app/search.tsx` only calls `search()`) | The new search bar on Beranda could open straight onto these |
| I | The six places search already finds | screens in `SCREENS` (`src/core/search.ts:31`): Beranda, Tugas & Ujian, Jadwal, Presensi, Nilai, Rencana studi (+ its 5 parts), Pengaturan | already searchable by name; they open with their old names (see journeys) | "KRS" typed in search opens `/plan/krs` today |

### 2c. Proposal (the conductor decides)

**The seven tiles for Beranda's grid, then "Lainnya".** Rule I used: a tile opens a screen that exists (or one cheap new view); the three
tabs (Jadwal, Tugas, Kuliah) are already one tap away in the bottom bar, so they are not tiles (they are in "Semua layanan" for completeness).
That leaves the office and the grades, which today are two taps down in Akademik, as the tiles.

| # | Tile (the app's own word) | Opens | Why in the first eight |
| --- | --- | --- | --- |
| 1 | **Nilai** | `/grades` | after every exam; the IPK (journey 1) |
| 2 | **KRS** | `/plan/krs` | an office thing, twice a term |
| 3 | **UKT** | `/plan/bills` | an office thing, once a term |
| 4 | **Kalender** (first word of "Kalender akademik", `plan.tab.deadlines`; "Kalender akademik" is too long for a tile) | `/plan/deadlines` | an office thing; dates |
| 5 | **Rencana** | `/plan/planner` | the plan and the finish date |
| 6 | **Materi** (new view, 2b-A; the label the Student already types in search) | cross-course newest modules | journey 2 is 3 taps today because this view does not exist |
| 7 | **Ujian** (new view, 2b-C, or `/tasks` with exams first) | exams with day, time, room | before and after exams; only the Tugas list holds them today |
| 8 | **Lainnya** (`mobile.tab.more` is already the old tab's word) | Semua layanan | the rest |

If three new views are too many for one night: swap 6 and 7 for **Kurikulum** (`/plan/curriculum`) and **Notifikasi** (`/alerts`, if the bell leaves the bar: today it is only reachable from the top bar, see below). Only 6 and 7 are new views; the other five open a screen that exists.

**Two decisions that are not tiles but need an answer:** (1) The bell (`action.alerts`) and Settings (`action.account`, the avatar) are the only ways to `/alerts` and `/settings`. "No avatar in a top bar" moves Settings to Profil; the bell needs a place (a Beranda corner, the strip, Profil, or "Semua layanan"). (2) `/needs` ("Perlu kamu urus", the whole list) is reached only from Beranda's heading chevron; if the strip replaces that section, `/needs` needs a way in.

**Groups for "Semua layanan"** (4 groups, one or two Indonesian words, each service once):

| Group | Services inside |
| --- | --- |
| **Kuliah** | Jadwal, Bulan (month), Kuliah (the courses and absences), Materi, Pengumuman, Target kehadiran |
| **Tugas** | Tugas, Ujian, Selesai (Tugas with `?show=done`), Perlu kamu urus |
| **Akademik** | Nilai, Rencana, Kurikulum, KRS, UKT, Kalender akademik |
| **Akun** | Notifikasi, Cari, Pengaturan, Warna mata kuliah, Kalender HP, Pengingat kuliah, Ringkasan, Laporkan masalah, Buka SIX |

I did not use "Lainnya" for a group (it is the tile and the old tab's name, and Kuliah already has a group "Lainnya", `mobile.kuliah.rest`).

## 3. Every state of every main screen

Legend: **✓** drawn today · **–** not drawn · "no way in the demo" says what one option would add.
The launch link is `edunexplusdemo://demo?EDUNEX_DEMO=<scenario>&…`; the options are in `test/pretend/demo.ts` (`demoOptions`) and
`mobile/src/demo/world.ts`. **All options are read at launch only** (`Linking.getInitialURL`), except `end` and `post`, which also work as
links to the open app. A link to a route (`edunexplusdemo://grades`) works any time.

### 3.0 The demo's options (all of them)

| Link query | What it does |
| --- | --- |
| `EDUNEX_DEMO=signed-in` (default) | Edunex and SIX both signed in; starts 2026-10-08 08:07 (Thursday), PL3002 on |
| `EDUNEX_DEMO=edunex-only` | **signed out of SIX only**: Edunex read, SIX never |
| `EDUNEX_DEMO=first-run` | nobody signed in: the welcome, then sign in, then a first read ("Membaca…") |
| `EDUNEX_DEMO_NOW=<ISO>` | the pretend clock's start: any moment (e.g. `2026-10-08T10:50:00%2B07:00`) |
| `EDUNEX_DEMO_CHECK_IN=open` | SIX's Tandai Hadir is open for the class on now (SIX id 2194342) |
| `EDUNEX_DEMO_QUIZ=1` | adds an Edunex exam "Kuis Brand Equity" |
| `EDUNEX_DEMO_AFTER_CLASS=counted\|absent\|missing` | plays the day to 16:05: SIX counts DK4073's class present, absent, or not yet |
| `EDUNEX_DEMO_SIGN_IN=asks\|fails` | a quiet re-sign-in is refused (`asks`: Microsoft asks again → the expired banner stays) / the sign-in page fails to open |
| `EDUNEX_DEMO_RELAY=1` | a pretend report relay exists ("Kirim langsung") |
| `EDUNEX_DEMO_EDIT=1` | the lecturer edited Task 117001 (new brief, later deadline) |
| `EDUNEX_DEMO_HANDED_BACK=1` | the lecturer wrote under Task 117001 and handed it back |
| `EDUNEX_DEMO_SICK=1` | SIX counts "izin dan sakit" as a second figure |
| `EDUNEX_DEMO_DATAINDUK=1` | SIX asks for the personal-details form first (a changed page) |
| `EDUNEX_DEMO_CURRICULUM=none` | SIX marks every curriculum ✗ (first-year program) |
| `EDUNEX_DEMO_GUIDE=1` | the desktop's first-run guide (no phone screen) |
| `EDUNEX_DEMO_ODD=1` | a paid UKT shown unpaid; a remedial grade "A (remedial)" |
| `EDUNEX_DEMO_COURSE_TABLE=changed\|lost\|blank` | SIX's course table: code and name joined / code lost / attendance column blank (changed-page banners) |
| `EDUNEX_DEMO_TIMETABLE=unread` | a class the app can't read (SIX moved a meeting) |
| `EDUNEX_DEMO_FILES=1` | II4091 Modul 3 holds a Word file and a bare PDF |
| `EDUNEX_DEMO_NOTIFY=1` | alerts go to Android's shade, booked ahead (pair with `NOW` a few minutes before a class) |
| `EDUNEX_DEMO_RESUME=1` | start from what was saved, not a fresh first sync |
| `EDUNEX_DEMO_THEME=light\|dark`, `EDUNEX_DEMO_LANG=id\|en` | the phone's own |
| open-app links: `edunexplusdemo://demo?end=six` (or `end=edunex`) | the pretend session ends; the app signs back in alone unless `SIGN_IN=asks` was set at launch |
| open-app link: `edunexplusdemo://demo?post=kuis` | a new Task "Kuis Kilat Bab 5" appears; the bell gets an unread alert |
| open-app links to routes | `edunexplusdemo://course/II4091`, `…/course/II4091?module=450219`, `…/schedule?class=2194342`, and by the router any route above (not run for the rest) |

Not an option, but in the pretend world: `world.setOffline(true)` (`test/pretend/world.ts:49`): every request fails like a dropped connection. **No link reaches it.**

### 3.1 Beranda

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** skeletons: now card `HeldShape`, rows `UrusLoading` | `src/screens/home/index.tsx` (`Loading`, `testID home.loading`), `now.tsx` (`card.now.reading`), `urus.tsx` (`section.needs.reading`) | **proven**: open any signed-in link and screenshot at once, before `status.settling` goes (every flow waits for it): `edunexplusdemo://demo?EDUNEX_DEMO=signed-in`; the longest hold is `EDUNEX_DEMO=first-run` after sign-in |
| Empty: nothing to handle | **✓** one line "Tak ada yang perlu diurus" (`mobile.home.toHandleNone`) with `action.needs.all` | `urus.tsx:225` | no link names it. Try (not run) `EDUNEX_DEMO_NOW=2026-12-20T09:00:00%2B07:00`, after every deadline; if the pretend data still has a Task due, it won't show |
| Empty: no class | **✓** "Tak ada kuliah 7 hari ke depan" (`mobile.home.free`) in `card.now`; "Ada kuliah yang belum terbaca · {day}" with `OpenSixTimetable` when a class can't be read | `now.tsx:78–90` | the unread one: **proven** `EDUNEX_DEMO_TIMETABLE=unread`; the free week: try `EDUNEX_DEMO_NOW=2026-12-20T09:00:00%2B07:00` (not run) |
| Empty: no SIX (no timetable) | **–** no now card, no "Nanti hari ini" (the part returns `null`); only "Perlu kamu urus" shows | `now.tsx:77` ("if (!hasSchedule) return null") | **proven**: `EDUNEX_DEMO=edunex-only` (flows `judge/edunex-only.yaml`). Beranda is thinner but says nothing about SIX; the banner stays absent (`banner.problem` appears only if SIX *had* data) |
| Offline | **✓** `banner.problem` "Tidak ada koneksi." + hint with the last time; status line under the greeting | `src/shell/source-status.tsx:~505` (`ProblemBanner`), `StatusLine` | **no way in the demo**. One option would add it: `EDUNEX_DEMO_OFFLINE=1` (or a link `?offline=1`, like `end=`) calling `run.world.setOffline(true)` then `engine.refresh()` in `mobile/src/demo/world.ts`. The desktop's picture 27 "needs a phone without a network" (`flows/judge/walk.yaml` header) |
| Error: SIX session ended | **✓** `banner.problem` "Sesi SIX berakhir." + "Masuk lagi" | same | launch `EDUNEX_DEMO=signed-in&EDUNEX_DEMO_SIGN_IN=asks`, then open `edunexplusdemo://demo?end=six` (not run as a pair; each half is in the code) |
| Error: page changed | **✓** `banner.problem` "SIX berubah." and `SixPageNote` on the card | `home/index.tsx` (`useChangedPage`) | **proven** `EDUNEX_DEMO_COURSE_TABLE=lost\|blank` (flows `course-table-lost/-blank`), `EDUNEX_DEMO_DATAINDUK=1` |
| Signed out of SIX only | **✓** (see "no SIX") | | `EDUNEX_DEMO=edunex-only` |
| First run cards | **✓** `card.firstScan` (summary), `card.notify` (notifications) | `home/first-run.tsx` | `EDUNEX_DEMO=first-run` after sign-in (**proven**, `flows/judge/first-run.yaml`) |
| Check-in open | **✓** the now card's button "Tandai Hadir" (`action.checkIn`); after it's pressed the card reads "Sudah ke SIX · HH:MM" (`card.now.checkedIn`) | `now.tsx`, `home/checked-in.ts` | **proven** `EDUNEX_DEMO_CHECK_IN=open` |

### 3.2 Jadwal

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** skeleton of a week strip and two blocks | `schedule-screen.tsx:492` (`Loading`) | open the demo, tap `tab.schedule` during `status.settling` (a few seconds) |
| Empty day | **✓** `schedule.emptyDay` | `schedule/day.tsx:217` | **proven**: `tab.schedule`, swipe to a Sunday (`flows/use.yaml` walks next week); or `EDUNEX_DEMO_NOW=2026-10-10T09:00:00%2B07:00` (a Saturday; not run) |
| Offline | **✓** the tab's `banner.problem` (via `TabHeader`) | `TabHeader` in `source-status.tsx` | no way in the demo (as Beranda) |
| Error: calendar sync denied/failed | **✓** `note.calendarDenied`, `note.calendarFailed` with a button | `schedule-screen.tsx:369` | needs the phone's Calendar permission refused; no demo link |
| Error: a class SIX moved | **✓** `row.unread` and `Jam berubah` | `schedule/day.tsx` | **proven** `EDUNEX_DEMO_TIMETABLE=unread` |
| Signed out of SIX only | **✓** `note.needsSix` "Kuliah & ruang ada di SIX" + `action.signInSix` | `schedule-screen.tsx:471` | **proven** `EDUNEX_DEMO=edunex-only` |

### 3.3 Tugas (list)

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** `loading` line (skeleton rows) | `tasks/list.tsx:519` (`mobile.tasks.loading`) | tap `tab.tasks` during `status.settling` |
| Empty: nothing to do | **✓** "Tidak ada yang perlu dikerjakan" + hint; for a course filter "Tidak ada untuk {code}" with `action.showAll` | `list.tsx:156–164` | no link names it. Pick one course chip (`action.courseFilter`) with no Task, or `EDUNEX_DEMO_NOW` far in the future (not run) |
| Empty: nothing done | **✓** "Belum ada tugas yang selesai" | `list.tsx:151` | open `tab.tasks` → segment "Selesai" before handing anything in; with the demo's data some are already done, so **maybe not empty** (not run) |
| Offline | **✓** `banner.problem` | `TabHeader` | no way in the demo |
| Error: Tasks couldn't load | **✓** `tasks.unavailable` "Tugas belum bisa dimuat" + `action.tryAgain` | `list.tsx:545` | no way in the demo; would come with the offline option when Edunex never answered |
| Signed out of SIX only | **✓** `tasks.examsNoSix` + `action.signInSix` (exams need SIX) | `list.tsx:503` | **proven** `EDUNEX_DEMO=edunex-only` |

### 3.4 Kuliah

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** `courses.loading` | `presence-screen.tsx:182` | tap `tab.courses` during `status.settling` |
| Empty | **✓** "Belum ada mata kuliah semester ini" + hint | `presence-screen.tsx:136` | no way in the demo (the demo always has courses) |
| Offline | **✓** `banner.problem` | `TabHeader` | no way in the demo |
| Error | **–** none of its own; the banner carries it | | |
| Signed out of SIX only | **✓** rows show no absence count; `card.signInSix` | `presence/now.tsx`, `groupsOf(courses, signedOut)` | **proven** `EDUNEX_DEMO=edunex-only` |
| Course row problem | **✓** `banner.rowProblem` ("Belum ada hitungan SIX") | `presence/course-row.tsx` | **proven** `EDUNEX_DEMO_COURSE_TABLE=blank` |

### 3.5 Akademik (Profil tomorrow)

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** `academic.loading` (the IPK card's shape) and rows with a skeleton meta | `academic-screen.tsx:150` (`StandingSkeleton`), `useMissingMeta` | tap `tab.academic` during the first read |
| Empty / signed out of SIX | **✓** `academic.noSix` "IPK muncul di sini setelah SIX terbaca." + `action.academic.signIn` (only when signed out) | `academic-screen.tsx:176` (`ConnectSix`) | **proven** `EDUNEX_DEMO=edunex-only` |
| Offline | **✓** `banner.problem` | `TabHeader` | no way in the demo |
| Error: page changed | **✓** banner + rows' notes | | `EDUNEX_DEMO_CURRICULUM=none`, `EDUNEX_DEMO_DATAINDUK=1` |
| To-do chips | **✓** `section.academic.todo` only when KRS/UKT are due | `Todos` | **proven** `EDUNEX_DEMO_ODD=1` (UKT shown unpaid) |

### 3.6 A course

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Loading | **✓** skeleton page | `course-screen.tsx:405` (`Loading`) | `edunexplusdemo://course/II4091` as the very first thing |
| Not in this semester | **✓** `course.notFound` | `course-screen.tsx:164` | `edunexplusdemo://course/XX0000` (not run) |
| Contents not loaded | **✓** `NotLoaded`: skeleton + `course.unavailable` + `action.courseRetry` | `course-screen.tsx:380` | no way in the demo |
| Empty: no modules / no meetings | **✓** `course.noMaterials`, `meeting.none`, `meeting.noSix` | `course/modules.tsx:61`, `meetings.tsx:115` | a course without Edunex content (not named in the demo); `meeting.noSix` = `EDUNEX_DEMO=edunex-only` |
| Offline | **✓** `banner.problem` via the bar | | no way in the demo |

### 3.7 A Task, an exam

| State | Drawn today | Where | How to see it |
| --- | --- | --- | --- |
| Task loading | **✓** `NoTasksYet` | `task-page.tsx:80` | `edunexplusdemo://task/117001` as the first thing |
| Task gone | **✓** `task.notFound` + button `task.backToTasks` | `task-page.tsx:82` | `edunexplusdemo://task/1` (not run) |
| Task: error | **✓** per hand-in: `notice.handIn` (offline, expired, closed, not open, gone, unconfirmed) | `hand-in.tsx:settle`, `HandInNotice` | no link; `world.failUploads` is not exposed; with the offline option it would |
| Task states | **✓** draft saved, handed in (`card.handIn`, the check), late, handed back, edited | `hand-in.tsx` | **proven** `use.yaml` (hand-in), `EDUNEX_DEMO_EDIT=1` (edited), `HANDED_BACK=1` |
| Exam loading | **✓** 3 skeletons | `exam-page.tsx:57` | `edunexplusdemo://exam/DK4073-UTS` first thing |
| Exam gone | **✓** `exam.notFound` | `exam-page.tsx:66` | `edunexplusdemo://exam/nope` (not run) |
| Exam: no date yet | **✓** `card.examWeek` / "Belum ada tanggal" | `exam-page.tsx:208` | the "Masa UTS" exam; `EDUNEX_DEMO_QUIZ=1` adds a quiz |

### 3.8 Nilai, Notifikasi, Search, Settings, Rencana studi

| Screen | Loading | Empty | Offline | Error | Signed out of SIX only | How |
| --- | --- | --- | --- | --- | --- | --- |
| **Nilai** | **✓** `grades.loading` (`grades-screen.tsx:174`) | **–** | **✓** banner | **✓** `note.disagree` (SIX and Edunex differ), `SixPageNote` | **✓** `WithoutSix`: "Transkrip & IPK butuh SIX" (`note.sixNeeded`) + this term's courses from Edunex (`section.edunexTerm`) | signed out: **proven** `EDUNEX_DEMO=edunex-only`; others as above |
| **Notifikasi** | **–** (reads saved alerts at once) | **✓** "Belum ada yang berubah" + a hint that names Edunex when only it is in (`alerts.empty*`) (`app/alerts.tsx:180`) | **✓** banner | **–** | **✓** the empty hint | empty: `EDUNEX_DEMO=first-run` then sign in and open the bell at once (not run); unread dot: `?post=kuis` (**proven**, `flows` `edunexplusdemo://demo?post=kuis`) |
| **Search** | **–** (an index in memory) | before typing: **empty page** (suggestions exist in core but aren't drawn); no match: `search.noResults` + count (`app/search.tsx`) | works offline (saved data) | **–** | **✓** results only from what's read | type a nonsense word for "no match" (`r2-akademik.yaml` opens Search; typing nonsense is not in it) |
| **Settings** | **–** | **–** | **✓** (`ErrorBanner` when a setting can't be saved) | **✓** `ErrorBanner` under the bar | **✓** Akun's row for SIX says "Belum terhubung" (`settings.notConnected`) with `action.signIn` | any link; `?at=alerts` opens at Notifikasi |
| **Rencana studi** (each part) | **✓** `plan.loading` "Membaca dari SIX…" in `note.sixNeeded` | **✓** a line of its own in most parts (`planner.nowEmpty`, `deadlines.empty`, `calendar.none`, `curriculum.pick.none`); Rencana's empty planned term and UKT/KRS empties were not read one by one | **✓** `ProblemBanner belowBar` | **✓** `SixPageNote` ("SIX berubah") | **✓** `SixNeeded` card with `action.signInSix` | signed out: `EDUNEX_DEMO=edunex-only`; Kurikulum without a curriculum: `EDUNEX_DEMO_CURRICULUM=none`; UKT unpaid: `EDUNEX_DEMO_ODD=1` |

### 3.9 Where "no way in the demo" stays, and what one option would add

| Missing | One option that would add it | Where |
| --- | --- | --- |
| Offline (banner, "Tidak ada koneksi.", every screen's offline) | `EDUNEX_DEMO_OFFLINE=1` at launch, and/or a link `edunexplusdemo://demo?offline=1\|0` | `mobile/src/demo/world.ts` (next to `end`): `run.world.setOffline(...)` then `engine.refresh("edunex")` and `("six")`; `PretendWorld.setOffline` exists |
| Error with data (Tasks/course "couldn't load") | `EDUNEX_DEMO_BROKEN=edunex` | would make Edunex answer 500 from the first read |
| Empty Kuliah / Tugas | `EDUNEX_DEMO_COURSES=none` | drop the term's courses in `demoWorld` |
| Upload fails (hand-in error) | `EDUNEX_DEMO_UPLOAD=fails` | `world.failUploads(status, times)` exists in `test/pretend/world.ts:54` |
