# Super-app layout: the shared decisions

What every screen builds on tonight. Decided by the lead after the direction round (`superapp-board.md`): three
directions were built in the demo and judged blind against today's app by a designer, a student and a prosecutor.
**Direction B ("Edunex Mobile LMS done right") is the base**: a white page, the class on now as the one block of
colour, quiet counts, round-the-day timeline. It takes from the others what two or more judges liked. A change to
anything here goes through the lead.

## The frame

| What | Decision |
| --- | --- |
| Bottom bar | Beranda `tab.home` · Jadwal `tab.schedule` · Tugas `tab.tasks` · Kuliah `tab.courses` · **Profil `tab.profile`** (route `profile`, `screen.profile`). Fluent tab icons (native drawables `tab_*`). Akademik is gone as a tab: its pages live behind Profil and the service tiles |
| Top bars | No avatar anywhere. Beranda: the search bar and the bell. Every other tab: its name, then Search and the bell, the same two in the same place |
| The page | White in light, one dark surface in dark (`theme.color.surface`). **The same layout in both themes**: a list is flat on the page in both, never flat in one and boxed in the other |
| Sections | A heading (Plus Jakarta Sans) and space. No card around a list, no grey box around a section |
| Cards | Only for one thing you can pick up: the class on now, a course, a result. Never a card inside a card |
| Rows | Flat on the page, an inset hairline between them, 56 dp or more, the whole row one target |
| Accent | One: the brand blue, for actions and what's picked. The class on now takes its **course's colour**, saturated, with a white button. Red and amber only for states (`absenceTone`): red past the limit, amber at it, the same on every screen |
| Progress | A plain bar filled to where it is. **No wave anywhere** |
| Icons | One family, Fluent, from `mobile/src/ui/icons.tsx` (`Icons`, `ServiceIcons`). Filled on service tiles and where the Student is, regular elsewhere. No pale rounded square behind an icon: a service's icon is its solid tile, a course's is its colour, an action's is bare. One glyph per meaning across the app: no two services share a glyph, and a service keeps its glyph and colour on Beranda, Semua layanan and Profil |

## Beranda, the first screen (no scrolling at font size 1.1)

In order, nothing above or between them (no greeting line, no "Layanan" heading):

1. **`home.search`**: a pill search bar ("Cari mata kuliah, tugas, materi") that opens Search with the keyboard up, the bell at its end.
2. **`home.now`**: the class on now, else the next one, in the course's colour. Where and when on one line, the course's name on at most
   two, one plain bar with the one time that matters at its end ("tutup 09:30" while a Presence is open), and one white button
   (**"Isi Presensi"**, the same word and part on every screen). The block opens the class's sheet. After the presence is marked, or
   when the class ends, it moves on to what's next. No class left today: a calm line, not an empty card.
3. **`home.strip`**: three things about you, split by hairlines, each one target that looks like one (`action.strip.<id>`):
   what's due (opens Tugas), absences at or past the limit (opens Kuliah; red or amber only when there's danger), days to the next
   exam (opens it). Good news is a check and a word, never "0"; a tile with nothing to say is gone. Labels a student understands
   without thinking.
4. **`home.grid`**: 8 solid-colour tiles, 4 across, a white filled glyph, a one-word label under each
   (`action.service.<id>`), no two the same colour:

   | Materi | Ujian | Nilai | Kalender |
   | --- | --- | --- | --- |
   | **KRS** | **UKT** | **Rencana** | **Lainnya** |

   The top row is what a student opens in a normal week, the bottom row the office. Materi (this week's material across
   courses) and Ujian (every exam with its day, time and room) are new views of data the app already reads. No tile only
   switches to a tab. "Lainnya" is a neutral tile with a 2×2 grid glyph and opens Semua layanan.

Below the fold: **"Nanti hari ini"** as a timeline (time, a dot in the course's colour, name, room; a clash is one icon and
the word "Bentrok"), then **"Perlu kamu urus"** with only what the strip doesn't already say. **Nothing on Beranda is said
twice**: a count on the strip is not repeated as rows lower down.

## Semua layanan (`screen.services`, `/services`)

A search field that filters, then every service in three named groups, 4 across: **Harian**, **Akademik**, **Aplikasi**.
No "Cari" tile under the search field, no tile with its group's name, the last row clear of the phone's bar.

## The other tabs

| Tab | Decision |
| --- | --- |
| Jadwal | The day timeline stays. On the white page. A block's title wraps instead of "…"; the last block is never sliced by the bar; a clash is the same icon and word as on Beranda |
| Tugas | "Belum selesai" and "Selesai" as two counts you tap to switch (B's). Flat rows: an exam and a Task have different icons, in the course's colour; a row names its course; an exam keeps its time |
| Kuliah | While a Presence is open: one line at the top, the same "Isi Presensi" part as Beranda. Then the courses in their colours: **the name whole (two lines), the absence status whole under it, never cut**, at font 1.1 and 1.3. The code is secondary |
| Profil | One card: initials, name, NIM and programme, the IPK big, SKS as a bar (opens Nilai). Then "Akademik": Nilai, Rencana, Kurikulum, KRS, UKT, Kalender as rows that show their state (an IP, "14 SKS", "Lunas"), each with its service's glyph and colour. Then "Akun": Notifikasi, Pengaturan, Laporkan masalah. No big avatar |

## Names

One thing, one name, on every screen it passes (`superapp-journeys.md` lists 13 pairs that differ today). The presence
button is "Isi Presensi" everywhere. A course is called by the same name in a row, a card and a title.

## testIDs

`home.search`, `home.now`, `home.strip`, `home.grid`, `action.strip.<tasks|absences|exam>`, `action.service.<id>`
(`material`, `exams`, `grades`, `calendar`, `krs`, `bills`, `planner`, `more`, …), `screen.services`, `tab.profile`,
`screen.profile`, `action.alerts` (the bell), `action.presence` ("Isi Presensi"). Everything else as `mobile/AGENTS.md` says.
The grid's tiles sit inside the `home.grid` node so a reader can count them.

## Who owns what tonight

| Files | Owner |
| --- | --- |
| `mobile/src/ui/**` (but `moves.tsx`), the service list, `app/(tabs)/_layout.tsx`, Beranda (`src/screens/home/**` but `first-run.tsx`), Semua layanan, `mobile/DESIGN.md` | Foundations |
| `src/screens/tasks/**`, `app/(tabs)/tasks.tsx`, `app/task/**`, `app/exam/**` | Tugas |
| `src/screens/presence/**`, `src/screens/course/**`, `app/(tabs)/courses.tsx`, `app/course/**` | Kuliah |
| `src/screens/schedule/**`, `app/(tabs)/schedule.tsx`, `app/schedule-month.tsx` | Jadwal |
| `src/screens/academic/**` (Profil), `app/(tabs)/profile.tsx`, `src/screens/settings/**`, `src/screens/grades/**`, `src/screens/plan/**` | Profil |
| new `src/screens/material/**`, `src/screens/exams/**`, their routes | Materi and Ujian |
| `app/search.tsx` and its parts, `app/alerts.tsx`, `src/screens/alerts/**` | Search and Notifikasi |
| `src/shell/first-minute/**`, `welcome.tsx`, `sign-in.tsx`, `home/first-run.tsx` | The first minute |
| `mobile/src/widget/**`, `src/widget-ios/**` | Widgets |
| `mobile/flows/**`, `mobile/qa/flows/**`, `scripts/ci/mobile-e2e.sh`, `mobile/qa/*.sh` | Flows |
