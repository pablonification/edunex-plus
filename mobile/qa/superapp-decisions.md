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

## Round 1: decided after the first full council (01:45)

These add to, and where they differ replace, what's above.

| What | Decision |
| --- | --- |
| One number, one source | A figure shown on two screens comes from one function, so it can't disagree: the days to the next exam are counted to **the next exam's own day** with the same function Tugas and Ujian use (not to the start of "Masa UTS"); a count of Tasks says exactly what it counts and matches the list it opens; the strip's absence figure is the number of courses that carry the status its label names on Kuliah |
| The strip's three | **Tasks:** the soonest thing due, as a date or "hari ini" with its count ("2 hari ini", else "16 Okt" and the Task's short name), never "Tak ada tenggat" unless there is truly nothing open. **Absences:** a count and a one-line label that is true of every course counted. **Exam:** "7 hari ke UTS", the same 7 as Tugas. One line of label each, the three figures on one baseline |
| Tiles that answer | Where a service has one fact a student wants before opening it, the tile carries it as a small tag (Gojek's "≈5RB"): Nilai its IPK, UKT "Lunas" or the due date, KRS its SKS. Only where it's true and short; Beranda stays at 50 words or fewer; no tag repeats the strip |
| Service colours | Colour belongs to **Beranda's seven** (each its own, none red or amber: those are for states). Every other service on Semua layanan is a **neutral tile** with its own glyph, so no colour is ever used for two services |
| Presence | Two real actions, never shown as two stacked buttons: **"Isi Presensi"** (Edunex) and **"Tandai Hadir"** (SIX, its own word), each with the **raised-hand glyph**, never an arrow. A screen shows one main button: the one that's open (the one closing first when both are), and when it's done the block moves on to the other. Same part, same look on Beranda, Kuliah and a course's page |
| The class on now | One part in the course's colour, in two sizes: the block (Beranda, the top of a course's page) and the line (Kuliah). No white shadowed card for it anywhere. Its bar is the presence window when one is open, else the class's time, and the time at its end says which ("tutup 09:30", "selesai 10:00"); never a second countdown beside it |
| A clash | `ClashMark` (the overlap glyph and "Bentrok") everywhere, Jadwal too. Once per clash on a screen, on the pair, with the way to choose a class one tap away |
| One glyph, one meaning | The history clock is "Jam berubah" only; the warning triangle is a warning only; "Ringkasan awal" has one glyph; a course is its own glyph in its colour wherever it appears (search, Nilai, Kuliah), never a cap for all |
| Rows you can tap | Every row that opens something ends in the same quiet chevron, or sits in a block that presses; a row that does nothing has neither |
| Targets | 48 dp for everything tappable, by `hitSlop` where the drawing is smaller: check each control you draw |
| Placeholders | A loading shape is shown only where nothing has loaded yet, and is gone the moment its content is in. Never beside real content |
| Names | "Sebulan" → the month view is **"Jadwal bulanan"**; the Kuliah tab's badge follows Foundations' rule (a count the page leads with, or none) |

## Round 2: decided after the second full council (02:30)

| What | Decision |
| --- | --- |
| Rethink, don't patch | Where a judge preferred last round's screen (Beranda's timeline row, Jadwal, Tugas's order, Kuliah's rows, Materi, search's rows), the screen takes what last round did right and what this round fixed: both, not one |
| Absences, everywhere | One reading of a course's absences: **dots** (one per allowed absence: **full**, in the ink of the surface it sits on, while it is still left, **a ring** once it is used, never green or amber; one extra **red** dot, set a little apart, for each over the limit: "full = left, ring = used, red = over", the same in the app and on the home-screen widgets) and **one short label** with its noun ("sisa 1 absen", "absen habis", "lewat 1 absen"). Never the dots plus a count plus a sentence. Beranda's strip counts **every course with no absence left** (at the limit or past it), its label has the noun ("absen habis") and is true of each counted, red when any is past |
| A changed class | Says what changed in words and times that agree with Notifikasi: "Selesai 10:00 (tadinya 09:30)". Never "08:00 → 08:00" |
| Jadwal's blocks | A block's height is its class's time, always. Names whole: clashing classes overlap with an offset (the later one indented over the earlier) instead of splitting the width in half, so each keeps room for its name; the clash is marked once on the pair |
| What leads | Tugas leads with the soonest thing of any kind; a course's page is titled by the course's **name** (the code quiet); a list row leads with the course's own glyph in its colour wherever a course is named |
| Beranda's budget | 50 words or fewer on the first screen as `layout-read.mjs` counts them. The live dot pulses a few times when the screen is shown and then rests: nothing on any tab redraws at rest |
| Wrapping | No word alone on a line, no name broken one word per line: a mark or a time that crowds a name goes under it. Checked at font 1.1 and 1.3 with the demo's longest names |

## Names

One thing, one name, on every screen it passes (`superapp-journeys.md` lists 13 pairs that differ today). The presence
button is "Isi Presensi" everywhere. A course is called by the same name in a row, a card and a title.

## testIDs

`home.search`, `home.now`, `home.strip`, `home.grid`, `action.strip.<tasks|absences|exam>`, `action.service.<id>`
(`material`, `exams`, `grades`, `calendar`, `krs`, `bills`, `planner`, `more`, …), `screen.services`, `tab.profile`,
`screen.profile`, `action.alerts` (the bell), `action.presence` ("Isi Presensi"). Everything else as `mobile/AGENTS.md` says.
The grid's tiles sit inside the `home.grid` node so a reader can count them.

## Round 3: decided after the third full council

These replace the "Service colours" row above where they differ.

- **One colour rule, said so a student can guess it: a solid colour is one of Beranda's seven; every other service
  is the app's own pale blue with a blue glyph.** One treatment for all the others, in both themes (light `#dbe6ff`
  with `#1450c4`; dark `#263c6e` with `#b9ceff`): on Semua layanan, "Lainnya", Profil's rows. Never grey (round 3's
  grey read as switched off, and went near-black in dark), never a hue each (round 2's second rainbow, where two
  tiles shared a colour). The tone keeps its name `grey` in code so no screen changes.
- **Beranda's seven**, none the states' red or amber, none violet (violet is the live class's to take), one green,
  each on its own step of lightness, a white glyph at 3:1 or more on each in both themes (light, dark):

  | Tile | Tone | Light | Dark |
  | --- | --- | --- | --- |
  | Materi | blue | `#1f6fe5` | `#2c79ee` |
  | Ujian | rose | `#cf1f65` | `#c21d5f` |
  | Nilai | orange | `#d85d0b` | `#c1540a` |
  | Kalender | teal | `#0a9eb8` | `#0ca2bc` |
  | KRS | magenta | `#d63ca2` | `#dc4cac` |
  | UKT | gold | `#ac8400` | `#af8700` |
  | Rencana | green | `#0d652f` | `#0e7e3c` |

  Gold is a tile's solid fill with a white glyph; the state amber is a word or a pale fill, never a solid tile.
- **Glyphs that say their service** (Fluent, filled on tiles): KRS `TaskListSquareLtr` (was `StackAdd`), Rencana
  `Steps` (was `Directions`), Ujian `DocumentBulletListClock` (was `DocumentEdit`), Kalender akademik
  `CalendarStar` again (`CalendarAgenda` read like a note to the judges), Jadwal bulanan and Jadwal's month button `CalendarMonth` (was
  `CalendarMultiple`), Kurikulum `Organization` (was `Library`), Lapor `ChatWarning` (was `PersonFeedback`).
  The rest stay as learned. The Jadwal tab's own glyph is a native drawable and stays.
- **Dark's states:** over the limit is red (`#ff6259`, `#ff6b61`), used up is amber (`#ffb224`), the amber fill is
  `#4a3600`; `Segmented`'s picked segment is `picked` (`#35508f` in dark).
- **Semua layanan:** groups of 4, 8 and 3, so the one short row is the page's last and sits left as a grid ends
  ("Ringkasan" moved to Akademik). The search field stays a hairline, 48 dp tall. No line of help under a tile: with
  fifteen it would make the page a list.

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
