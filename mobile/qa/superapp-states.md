# Every screen, every state: the demo link that shows each

The release line: **every screen, every state (loading, empty, offline, error), pictured and judged, light and dark;
none a blank page or a raw message.** This is the list to photograph and judge from. Each row is a screen in a state:
open **the link** (it starts the demo in that state), then **the path** (the screen), and take the picture.
`mobile/qa/states-shots.sh <out-dir> [light|dark] [screen...]` does exactly that for every row; it reads
`superapp-states.json`, the same data this table is made from, so the two can't drift (`test/mobile/demo-states.test.ts`
checks every row of the data is here).

## How to read the handling

- **designed**: the state has its own words and shape.
- **shared**: a shared part carries it (`EmptyState`, `ProblemBanner`, `Skeleton`): fine if the picture reads well.
- **weak**: drawn, but it says less than it should, or says the wrong thing (empty when it couldn't read).
- **BLOCKER**: not handled: the state goes unsaid. These are the release blockers; the owner is the file named.
- *no way in the demo*: no link shows it yet (what one would take is in the row); *n/a*: the screen has no such state.

Judged from reading the code, not from pictures: a row says what the code draws; the picture is the judge.

## The states (each a query option on the demo link; `mobile/src/demo/world.ts` says each in its header)

| State | Link | What it does |
| --- | --- | --- |
| normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | the made-up Student, both systems read |
| loading | `…&EDUNEX_DEMO_HOLD=1` | the first read never begins: every screen holds its loading shape. `EDUNEX_DEMO_SLOW=<seconds>` instead waits that long, then reads as usual |
| empty | `…&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | Edunex has none of those kinds (any subset, comma-separated). A day or week with no class is `EDUNEX_DEMO_NOW` instead: `2026-10-10T09:00:00%2B07:00` is a Saturday (Jadwal's empty day); `2026-12-20T09:00:00%2B07:00` is after the term (Beranda's "Tak ada kuliah 7 hari ke depan": not run, check the picture) |
| offline | `…&EDUNEX_DEMO_OFFLINE=1` | starts from saved data (as `EDUNEX_DEMO_RESUME=1`) with no network: every request fails as on a phone in flight mode. With nothing saved, the first read plays online and the network drops right after. `EDUNEX_DEMO_OFFLINE=later`: it drops 5 seconds after the first read, for the moment it happens |
| error | `…&EDUNEX_DEMO_FAIL=both` (or `edunex`, `six`) | that system answers a server error (500) on every read once the first read is saved (sign-in still works) |
| error-first | `…&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | the same from the very first read: nothing saved ("couldn't load") |
| long | `…&EDUNEX_DEMO_LONG=1` | one course and one Task with very long names (below) |
| six-ended | `…&EDUNEX_DEMO_ENDED=six` (or `edunex`) | that session ends right after the first read; Microsoft asks again (`EDUNEX_DEMO_SIGN_IN=asks` unless the link says otherwise), so "Masuk lagi" stays. `edunexplusdemo://demo?end=six` still does it to an open app |
| no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | Edunex signed in, SIX not (checked: it signs in to Edunex only, `test/pretend/demo.ts` `prepare`) |

A route link (`edunexplusdemo://material`) works on the open app at any time; the states' options work at start only.
No state needs the app's data cleared: every start without `RESUME`/`OFFLINE=1` begins fresh (`host.ts` clears the
demo's storage), and the offline row first runs the normal link once so there is saved data to resume.

## A long name, a big font's worst case

`…&EDUNEX_DEMO_LONG=1` (the `long` rows below): II4091 is "Proposal Tugas Akhir dan Metodologi Penelitian Sistem dan
Teknologi Informasi" on SIX (its English name on Edunex likewise), and Task 117001 is "Tugas 01 Bab I: Latar Belakang,
Rumusan Masalah, Tujuan, Batasan Masalah, dan Sistematika Penulisan Proposal Tugas Akhir (revisi kedua)", with no new
recording (`mobile/src/demo/states.ts` `longNames`). Take them at font size 1.3 too (the script doesn't change the font
size: that's a setting it may not touch).

## Every screen × every state

| Screen | Path after the link | State | Link | Drawn by | Handling |
| --- | --- | --- | --- | --- | --- |
| Beranda | – (Beranda) | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/home/index.tsx` | designed |
| Beranda | – (Beranda) | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/home/index.tsx`: Loading (home.loading), now.tsx HeldShape, urus.tsx UrusLoading | designed |
| Beranda | – (Beranda) | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/home/index.tsx`: urus.tsx: Tak ada yang perlu diurus (mobile.home.toHandleNone) | designed |
| Beranda | – (Beranda) | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/home/index.tsx`: ProblemBanner (source-status.tsx) | shared |
| Beranda | – (Beranda) | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/home/index.tsx`: ProblemBanner | shared |
| Beranda | – (Beranda) | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/home/index.tsx`: ProblemBanner over an empty Beranda | shared |
| Beranda | – (Beranda) | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/home/index.tsx`: ProblemBanner: Sesi SIX berakhir + Masuk lagi | shared |
| Beranda | – (Beranda) | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/home/index.tsx`: now.tsx returns null: no now card, nothing says SIX is missing | **weak** |
| Beranda | – (Beranda) | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/home/index.tsx`: the now card and the strip with II4091's long name: check the wrap at font size 1.3 | designed |
| Beranda, a day with no class | – (Beranda) | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_NOW=2026-12-20T09:00:00%2B07:00` | `mobile/src/screens/home/now.tsx`: now.tsx: Tak ada kuliah 7 hari ke depan (mobile.home.free) | designed |
| Jadwal | `edunexplusdemo://schedule` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/schedule/schedule-screen.tsx` | designed |
| Jadwal | `edunexplusdemo://schedule` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/schedule/schedule-screen.tsx`: Loading: a week strip and two blocks | designed |
| Jadwal | `edunexplusdemo://schedule` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_NOW=2026-10-10T09:00:00%2B07:00` | `mobile/src/screens/schedule/schedule-screen.tsx`: schedule/day.tsx: schedule.emptyDay | designed |
| Jadwal | `edunexplusdemo://schedule` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/schedule/schedule-screen.tsx`: BTabHeader's ProblemBanner | shared |
| Jadwal | `edunexplusdemo://schedule` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/schedule/schedule-screen.tsx`: BTabHeader's ProblemBanner | shared |
| Jadwal | `edunexplusdemo://schedule` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/schedule/schedule-screen.tsx`: ProblemBanner over an empty week | shared |
| Jadwal | `edunexplusdemo://schedule` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/schedule/schedule-screen.tsx`: ProblemBanner | shared |
| Jadwal | `edunexplusdemo://schedule` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/schedule/schedule-screen.tsx`: note.needsSix + action.signInSix | designed |
| Jadwal | `edunexplusdemo://schedule` | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/schedule/schedule-screen.tsx`: II4091's block: check the wrap at font size 1.3 | designed |
| Tugas | `edunexplusdemo://tasks` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/tasks/list.tsx` | designed |
| Tugas | `edunexplusdemo://tasks` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/tasks/list.tsx`: skeleton rows (mobile.tasks.loading) | designed |
| Tugas | `edunexplusdemo://tasks` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/tasks/list.tsx`: Tidak ada yang perlu dikerjakan + hint | designed |
| Tugas | `edunexplusdemo://tasks` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/tasks/list.tsx`: BTabHeader's ProblemBanner; RowProblemBanner | shared |
| Tugas | `edunexplusdemo://tasks` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/tasks/list.tsx`: ProblemBanner | shared |
| Tugas | `edunexplusdemo://tasks` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/tasks/list.tsx`: tasks.unavailable + action.tryAgain | designed |
| Tugas | `edunexplusdemo://tasks` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/tasks/list.tsx`: ProblemBanner | shared |
| Tugas | `edunexplusdemo://tasks` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/tasks/list.tsx`: tasks.examsNoSix + action.signInSix | designed |
| Tugas | `edunexplusdemo://tasks` | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/tasks/list.tsx`: Task 117001's row: check the wrap at font size 1.3 | designed |
| Kuliah | `edunexplusdemo://courses` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/presence/presence-screen.tsx` | designed |
| Kuliah | `edunexplusdemo://courses` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/presence/presence-screen.tsx`: courses.loading | designed |
| Kuliah | `edunexplusdemo://courses` | empty | – | `mobile/src/screens/presence/presence-screen.tsx`: Belum ada mata kuliah semester ini: the demo always has courses (a course-less option would empty Edunex's /course/courses and SIX's status page) | no way in the demo |
| Kuliah | `edunexplusdemo://courses` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/presence/presence-screen.tsx`: BTabHeader's ProblemBanner | shared |
| Kuliah | `edunexplusdemo://courses` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/presence/presence-screen.tsx`: ProblemBanner only, nothing of its own | shared |
| Kuliah | `edunexplusdemo://courses` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/presence/presence-screen.tsx`: the empty line under the banner | designed |
| Kuliah | `edunexplusdemo://courses` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/presence/presence-screen.tsx`: ProblemBanner | shared |
| Kuliah | `edunexplusdemo://courses` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/presence/presence-screen.tsx`: no absence counts; card.signInSix | designed |
| Kuliah | `edunexplusdemo://courses` | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/presence/presence-screen.tsx`: II4091's row: check the wrap at font size 1.3 | designed |
| Profil | `edunexplusdemo://profile` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/academic/academic-screen.tsx` | designed |
| Profil | `edunexplusdemo://profile` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/academic/academic-screen.tsx`: academic.loading (the IPK's shape), Skeleton metas | designed |
| Profil | `edunexplusdemo://profile` | empty | – | `mobile/src/screens/academic/academic-screen.tsx`: a first-term Student's IPK comes from SIX's transcript: no option empties it yet | n/a |
| Profil | `edunexplusdemo://profile` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/academic/academic-screen.tsx`: BTabHeader's ProblemBanner | shared |
| Profil | `edunexplusdemo://profile` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/academic/academic-screen.tsx`: ProblemBanner | shared |
| Profil | `edunexplusdemo://profile` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/academic/academic-screen.tsx`: academic.noSix: IPK muncul di sini setelah SIX terbaca | designed |
| Profil | `edunexplusdemo://profile` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/academic/academic-screen.tsx`: ProblemBanner | shared |
| Profil | `edunexplusdemo://profile` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/academic/academic-screen.tsx`: ConnectSix + action.academic.signIn | designed |
| Semua layanan | `edunexplusdemo://services` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/services/services-screen.tsx` | designed |
| Semua layanan | `edunexplusdemo://services` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/services/services-screen.tsx`: the same grid: it reads no data | designed |
| Materi | `edunexplusdemo://material` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/material/material-screen.tsx` | designed |
| Materi | `edunexplusdemo://material` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/material/material-screen.tsx`: Loading: skeleton groups | designed |
| Materi | `edunexplusdemo://material` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/material/material-screen.tsx`: EmptyState mobile.material.empty + hint | shared |
| Materi | `edunexplusdemo://material` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/material/material-screen.tsx`: ProblemBanner belowBar | shared |
| Materi | `edunexplusdemo://material` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/material/material-screen.tsx`: ProblemBanner belowBar | shared |
| Materi | `edunexplusdemo://material` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/material/material-screen.tsx`: ProblemBanner + EmptyState mobile.material.empty (says empty when it couldn't read) | shared |
| Materi | `edunexplusdemo://material` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/material/material-screen.tsx`: the same: Materi is Edunex's | designed |
| Ujian | `edunexplusdemo://exams` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/exams/exams-screen.tsx` | designed |
| Ujian | `edunexplusdemo://exams` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/exams/exams-screen.tsx`: Loading: date blocks | designed |
| Ujian | `edunexplusdemo://exams` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/exams/exams-screen.tsx`: EmptyState mobile.exams.empty (SIX's exam weeks may still show: Edunex's exams only are emptied) | shared |
| Ujian | `edunexplusdemo://exams` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/exams/exams-screen.tsx`: ProblemBanner belowBar | shared |
| Ujian | `edunexplusdemo://exams` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/exams/exams-screen.tsx`: ProblemBanner belowBar | shared |
| Ujian | `edunexplusdemo://exams` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/exams/exams-screen.tsx`: ProblemBanner + EmptyState | shared |
| Ujian | `edunexplusdemo://exams` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/exams/exams-screen.tsx`: ProblemBanner belowBar | shared |
| Ujian | `edunexplusdemo://exams` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/exams/exams-screen.tsx`: EmptyState mobile.exams.noSix + sign in | shared |
| A course (II4091) | `edunexplusdemo://course/II4091` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/course/course-screen.tsx` | designed |
| A course (II4091) | `edunexplusdemo://course/II4091` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/course/course-screen.tsx`: Loading: skeleton page | designed |
| A course (II4091) | `edunexplusdemo://course/II4091` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/course/course-screen.tsx`: modules.tsx: course.noMaterials | designed |
| A course (II4091) | `edunexplusdemo://course/II4091` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/course/course-screen.tsx`: no banner on this page: saved data with nothing saying it's old | **BLOCKER** |
| A course (II4091) | `edunexplusdemo://course/II4091` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/course/course-screen.tsx`: no banner on this page: saved data, the error unsaid | **BLOCKER** |
| A course (II4091) | `edunexplusdemo://course/II4091` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/course/course-screen.tsx`: NotLoaded: skeleton + course.unavailable + action.courseRetry | designed |
| A course (II4091) | `edunexplusdemo://course/II4091` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/course/course-screen.tsx`: meetings.tsx: meeting.noSix | designed |
| A course (II4091) | `edunexplusdemo://course/II4091` | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/course/course-screen.tsx`: the course's title: check the wrap at font size 1.3 | designed |
| A module | `edunexplusdemo://course/II4091/module/450219` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/course/module-screen.tsx` | designed |
| A module | `edunexplusdemo://course/II4091/module/450219` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/course/module-screen.tsx`: ModuleSkeleton | designed |
| A module | `edunexplusdemo://course/II4091/module/450219` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/course/module-screen.tsx`: EmptyState course.unavailable: the same words as an error | **weak** |
| A module | `edunexplusdemo://course/II4091/module/450219` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/course/module-screen.tsx`: no banner on this page | **BLOCKER** |
| A module | `edunexplusdemo://course/II4091/module/450219` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/course/module-screen.tsx`: no banner on this page | **BLOCKER** |
| A module | `edunexplusdemo://course/II4091/module/450219` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/course/module-screen.tsx`: EmptyState course.unavailable, no way to try again | shared |
| A Task (117001) | `edunexplusdemo://task/117001` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/tasks/task-page.tsx` | designed |
| A Task (117001) | `edunexplusdemo://task/117001` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/tasks/task-page.tsx`: NoTasksYet | designed |
| A Task (117001) | `edunexplusdemo://task/117001` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/tasks/task-page.tsx`: EmptyState task.notFound + task.backToTasks | shared |
| A Task (117001) | `edunexplusdemo://task/117001` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/tasks/task-page.tsx`: no banner on the page; hand-in says it only when tried (hand-in.tsx HandInNotice) | **BLOCKER** |
| A Task (117001) | `edunexplusdemo://task/117001` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/tasks/task-page.tsx`: no banner on the page | **BLOCKER** |
| A Task (117001) | `edunexplusdemo://task/117001` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/tasks/task-page.tsx`: NoTasksYet or task.notFound: says gone when it couldn't read | **weak** |
| A Task (117001) | `edunexplusdemo://task/117001` | long | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_LONG=1` | `mobile/src/screens/tasks/task-page.tsx`: the Task's title: check the wrap at font size 1.3 | designed |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/tasks/exam-page.tsx` | designed |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/tasks/exam-page.tsx`: 3 skeletons | designed |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/tasks/exam-page.tsx`: no banner on the page | **BLOCKER** |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/tasks/exam-page.tsx`: no banner on the page | **BLOCKER** |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/tasks/exam-page.tsx`: EmptyState exam.notFound: says gone when it couldn't read | **weak** |
| An exam (DK4073-UTS) | `edunexplusdemo://exam/DK4073-UTS` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/tasks/exam-page.tsx`: EmptyState exam.notFound (SIX's exam weeks aren't read) | shared |
| Nilai | `edunexplusdemo://grades` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/grades/grades-screen.tsx` | designed |
| Nilai | `edunexplusdemo://grades` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/grades/grades-screen.tsx`: grades.loading | designed |
| Nilai | `edunexplusdemo://grades` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/src/screens/grades/grades-screen.tsx`: no empty state of its own (Edunex's gradebooks emptied; SIX's transcript still read) | **BLOCKER** |
| Nilai | `edunexplusdemo://grades` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/grades/grades-screen.tsx`: ProblemBanner belowBar | shared |
| Nilai | `edunexplusdemo://grades` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/grades/grades-screen.tsx`: ProblemBanner belowBar | shared |
| Nilai | `edunexplusdemo://grades` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/grades/grades-screen.tsx`: check the picture: no empty or couldn't-read state found in the code | **BLOCKER** |
| Nilai | `edunexplusdemo://grades` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/grades/grades-screen.tsx`: ProblemBanner belowBar | shared |
| Nilai | `edunexplusdemo://grades` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/grades/grades-screen.tsx`: WithoutSix: note.sixNeeded + section.edunexTerm | designed |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/plan/planner.tsx` | designed |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/plan/planner.tsx`: plan.loading in note.sixNeeded | designed |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/plan/planner.tsx`: ProblemBanner belowBar | shared |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/plan/planner.tsx`: ProblemBanner + SixPageNote | designed |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | error-first | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both&EDUNEX_DEMO_FAIL_AT=start` | `mobile/src/screens/plan/planner.tsx`: SixNeeded card | designed |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/plan/planner.tsx`: ProblemBanner belowBar | shared |
| Rencana studi: Rencana | `edunexplusdemo://plan/planner` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/plan/planner.tsx`: SixNeeded + action.signInSix | designed |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/plan/curriculum.tsx` | designed |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/plan/curriculum.tsx`: plan.loading | designed |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_CURRICULUM=none` | `mobile/src/screens/plan/curriculum.tsx`: curriculum.pick.none | designed |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/plan/curriculum.tsx`: ProblemBanner belowBar | shared |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/plan/curriculum.tsx`: SixPageNote | designed |
| Rencana studi: Kurikulum | `edunexplusdemo://plan/curriculum` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/plan/curriculum.tsx`: SixNeeded | designed |
| Rencana studi: KRS | `edunexplusdemo://plan/krs` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/plan/krs.tsx` | designed |
| Rencana studi: KRS | `edunexplusdemo://plan/krs` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/plan/krs.tsx`: plan.loading | designed |
| Rencana studi: KRS | `edunexplusdemo://plan/krs` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/plan/krs.tsx`: ProblemBanner belowBar | shared |
| Rencana studi: KRS | `edunexplusdemo://plan/krs` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/plan/krs.tsx`: SixPageNote | designed |
| Rencana studi: KRS | `edunexplusdemo://plan/krs` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/plan/krs.tsx`: SixNeeded | designed |
| Rencana studi: UKT | `edunexplusdemo://plan/bills` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/plan/bills.tsx` | designed |
| Rencana studi: UKT | `edunexplusdemo://plan/bills` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/src/screens/plan/bills.tsx`: plan.loading | designed |
| Rencana studi: UKT | `edunexplusdemo://plan/bills` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/plan/bills.tsx`: ProblemBanner belowBar | shared |
| Rencana studi: UKT | `edunexplusdemo://plan/bills` | error | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_FAIL=both` | `mobile/src/screens/plan/bills.tsx`: SixPageNote | designed |
| Rencana studi: UKT | `edunexplusdemo://plan/bills` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/plan/bills.tsx`: SixNeeded | designed |
| Rencana studi: Kalender | `edunexplusdemo://plan/deadlines` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/plan/deadlines.tsx` | designed |
| Rencana studi: Kalender | `edunexplusdemo://plan/deadlines` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/src/screens/plan/deadlines.tsx`: ProblemBanner belowBar (ITB's calendar is saved) | shared |
| Rencana studi: Kalender | `edunexplusdemo://plan/deadlines` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/plan/deadlines.tsx`: the same: ITB's public calendar | designed |
| Notifikasi | `edunexplusdemo://alerts` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/app/alerts.tsx` | designed |
| Notifikasi | `edunexplusdemo://alerts` | empty | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades` | `mobile/app/alerts.tsx`: Belum ada yang berubah + hint (alerts.empty*), if the first read makes no alerts | designed |
| Notifikasi | `edunexplusdemo://alerts` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/app/alerts.tsx`: saved alerts; no banner found in app/alerts.tsx | **weak** |
| Notifikasi | `edunexplusdemo://alerts` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/app/alerts.tsx`: the empty hint names Edunex | designed |
| Search | `edunexplusdemo://search` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/app/search.tsx`: suggestions and recent before typing | designed |
| Search | `edunexplusdemo://search` | loading | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_HOLD=1` | `mobile/app/search.tsx`: an index of nothing yet: check the picture | **weak** |
| Search | `edunexplusdemo://search` | offline | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_OFFLINE=1` | `mobile/app/search.tsx`: works on saved data | designed |
| Search | `edunexplusdemo://search` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/app/search.tsx`: results from Edunex only | designed |
| Settings | `edunexplusdemo://settings` | normal | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in` | `mobile/src/screens/settings` | designed |
| Settings | `edunexplusdemo://settings` | six-ended | `edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_ENDED=six` | `mobile/src/screens/settings`: Akun's SIX row | designed |
| Settings | `edunexplusdemo://settings` | no-six | `edunexplusdemo://demo?EDUNEX_DEMO=edunex-only` | `mobile/src/screens/settings`: settings.notConnected + action.signIn | designed |
| The first minute | – (Beranda) | normal | `edunexplusdemo://demo?EDUNEX_DEMO=first-run` | `mobile/app/_layout.tsx (the welcome), mobile/src/screens/home/first-run.tsx`: the welcome | designed |
| The first minute | – (Beranda) | loading | – | `mobile/app/_layout.tsx (the welcome), mobile/src/screens/home/first-run.tsx`: Membaca... after sign-in needs a tap on the welcome (flows/judge/first-run.yaml); EDUNEX_DEMO_SLOW=8 stretches it | no way in the demo |
| The first minute | – (Beranda) | offline | – | `mobile/app/_layout.tsx (the welcome), mobile/src/screens/home/first-run.tsx`: signing in with no network: no option yet (OFFLINE=1 resumes saved data instead) | no way in the demo |
| The first minute | – (Beranda) | error | – | `mobile/app/_layout.tsx (the welcome), mobile/src/screens/home/first-run.tsx`: a sign-in page that fails: EDUNEX_DEMO_SIGN_IN=fails, after a tap | no way in the demo |

## What isn't covered yet, and the option that would add it

| Missing | What would add it |
| --- | --- |
| Kuliah empty (no courses this term) | `EDUNEX_DEMO_EMPTY=courses`: empty Edunex's `/course/courses` and SIX's status table together (both feed Kuliah) |
| Nilai / Profil for a first-term Student (no transcript, no IPK) | an edit of SIX's transcript page in `demoWorld` (`world.six.editPage(/\/transkrip/…)`) |
| SIX's exam weeks empty on Ujian | the same for SIX's exam schedule page |
| A held read on one system only (`HOLD=six`) | the demo's first read is played fast on the pretend clock (`fastForward`), which gives up after 30 s of real time: a held system would end it. Needs a hold that `fastForward` skips |
| The first minute offline or failing | an option for the sign-in step (`EDUNEX_DEMO_SIGN_IN=fails` exists, after a tap on the welcome) |
| A hand-in that fails | `EDUNEX_DEMO_UPLOAD=fails` calling `world.failUploads` (exists) |
