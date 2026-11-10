# Round 4: every screen, and how to reach it

The target: every screen within 2 taps of Beranda or a tab. Read from the code on the round 4 branch (routes under
`mobile/app`, plus the sheets that are a screen's main content); Profil's rows are child D's (`row.profile.<id>`),
Beranda's header, strip and grid child B's, "Semua layanan" child C's (`mobile/qa/r4-decisions.md`).

A tap is one press on the screen in front. The bottom bar is always there, so a tab is 0 taps.

## Tabs (0 taps)

| Screen | Route | testID |
| --- | --- | --- |
| Beranda | `/` (`(tabs)/index`) | `tab.home`, `screen.home` |
| Jadwal | `/schedule` | `tab.schedule`, `screen.schedule` |
| Tugas | `/tasks` (`?show=done`: the done list, a chip on the page) | `tab.tasks`, `screen.tasks` |
| Kuliah | `/courses` | `tab.courses`, `screen.courses` |
| Profil | `/profile` | `tab.profile`, `screen.profile` |

## Screens over the tabs

| Screen | Route | Shortest path | Taps | Also from |
| --- | --- | --- | --- | --- |
| Cari | `/search` | Beranda › search bar `home.search` | 1 | the search icon `action.search` on Jadwal, Tugas, Kuliah |
| Notifikasi | `/alerts` | Beranda › bell `action.alerts` | 1 | a notification's tap |
| Semua layanan | `/services` | Beranda › `service.more` ("Lainnya") | 1 | |
| Materi | `/materials` | Beranda › `service.materials` | 1 | Semua layanan |
| Ujian | `/exams` | Beranda › `service.exams` | 1 | Semua layanan |
| Presensi | `/presence` → redirects to Kuliah | Beranda › `service.presence`, or `strip.attendance` | 1 | the widget, old links |
| Nilai | `/grades` | Beranda › `service.grades` | 1 | Profil › `row.profile.grades` |
| KRS | `/plan/krs` | Beranda › `service.krs` | 1 | Profil › `row.profile.krs` |
| UKT | `/plan/bills` | Beranda › `service.bills` | 1 | Profil › `row.profile.bills` |
| Kalender akademik | `/plan/deadlines` | Beranda › `service.calendar` | 1 | Profil › `row.profile.deadlines` |
| Rencana studi | `/plan/planner` | Profil › `row.profile.planner` | 1 | `/plan?tab=…` (old links redirect) |
| Kurikulum | `/plan/curriculum` | Profil › `row.profile.curriculum` | 1 | |
| Pengaturan | `/settings` | Profil › `row.profile.settings` | 1 | Notifikasi › "Atur notifikasi" (`/settings?at=alerts`), a course's long-press (`?at=courseColors`) |
| Perlu perhatianmu | `/needs` | Beranda › "Lihat semua" | 1 | |
| Tugas (one) | `/task/[taskId]` | Tugas › a row | 1 | Beranda's now card and "Perlu kamu urus", Cari, a notification, the widget |
| Ujian (one) | `/exam/[examId]` | Beranda › `strip.exam` | 1 | Tugas › an exam row, Ujian › a row, Jadwal's class sheet |
| Mata kuliah | `/course/[code]` | Kuliah › a course | 1 | Cari, Jadwal's class sheet, a Task's course |
| Modul | `/course/[code]/module/[module]` | Kuliah › a course › a module | 2 | Materi › a material, Cari |
| Presensi (check in) | `/check-in/[meetingId]` | Beranda › the now card's "Isi presensi" (while a window is open) | 1 | the notification, the widget |
| Jadwal sebulan | `/schedule-month` | Jadwal › ⋮ `action.scheduleMenu` › "Lihat sebulan" `action.month` | 2 | |
| Edunex / SIX on the web | `/web?url=…` | Profil › `row.profile.edunex` / `row.profile.six` | 1 | a check-in that needs the website |
| Tentang | Settings' Tentang group (`src/screens/settings/about.tsx`), reached by Profil's `row.profile.about` (child D: its own screen or `/settings?at=about`) | Profil › `row.profile.about` | 1 | |
| Lisensi | `/licences` | Profil › Tentang › "Lisensi sumber terbuka" | 2 | Pengaturan › Tentang |
| Laporkan masalah | `/report` | Profil › Tentang › "Laporkan masalah" | 2 | Pengaturan › Tentang, an error's own "Laporkan" |
| Ringkasan awal | `/first-scan` | Profil › Pengaturan › Akun's "Ringkasan awal" row | 2 | opens by itself once, after the first sync |
| Keluar dari semua akun | sheet `sheet.signOutAll` | Profil › `action.signOutAll` | 1 | |

Redirect-only routes (no screen of their own): `/presence` (Kuliah), `/plan` (`/plan/<part>`), `/demo` (Beranda),
`/course/[code]?module=` (the module's route).

## Sheets that are a screen's main content

| Sheet | Opens from | Taps |
| --- | --- | --- |
| Status data `sheet.sync` | any tab's status line (shown only when there's something to act on) | 1 |
| Kelas sekarang `sheet.nowClass` | Beranda › the now card | 1 |
| Kelas `sheet.class` | Jadwal › a class | 1 |
| Mata kuliah (actions) `sheet.course`, warna `sheet.courseColor` | Kuliah › long-press a course | 1 |
| Ringkasan Kuliah `sheet.kuliahFacts` | Kuliah › the footer's line | 1 |
| Pertemuan `sheet.meeting` | Kuliah › a course › a meeting | 2 |
| Nilai mata kuliah `sheet.grade`, `sheet.gradePart` | Profil › Nilai › a course | 2 |
| Mata kuliah kurikulum `sheet.curriculumCourse` | Profil › Kurikulum › a course | 2 |
| Tanggal kalender `sheet.deadline` | Beranda › Kalender › a date | 2 |
| Akun Edunex / SIX `sheet.account.<source>` | Profil › Pengaturan › the account's row | 2 |

## Over 2 taps, and what would fix it

None, as long as child D's Profil keeps these promises (each is 2 taps only through them):

1. `row.profile.about` reaches Tentang's card (Laporkan masalah, Lisensi) in one tap. If it opened Settings at its top
   instead, both become 3: fix with `/settings?at=about` (Settings already scrolls to `?at=<group>`).
2. `row.profile.settings` opens Settings with Akun on top (the account sheets, Ringkasan awal), as it is now.
3. Profil's rows that run past the first screen (Maestro scrolls to them; a thumb does too) still count as 1 tap: a
   scroll isn't a tap, but keep Pengaturan and Tentang where a Student finds them, at the end like Gojek and Grab.

Not reachable from Cari: Profil itself, Semua layanan, Materi, Ujian (the shared `src/core/search.ts` `SCREENS` list has
no phone-only entries; `mobile/app/search.tsx` would need its own list added to it to find them by name).
