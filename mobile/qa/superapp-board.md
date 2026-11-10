# Super-app pass board: the real phone

Samsung Galaxy A52 (Snapdragon 720G, Android 13, 90 Hz), 1080×2400, font size 1.1, 3-button navigation, Indonesian.
The demo app (a made-up student) on release builds, started from its saved data. Numbers only: never real data.

How each number is taken (`adb`, by the lead):

- **Cold start**: force-stop, open the demo's resume link, Android's `START` to the app's `[startup] shown`. Median of 7.
- **Tab**: 3 tours of the 5 tabs, the app's `[perf] tab` lines: p50, p90, max.
- **Scroll**: `dumpsys gfxinfo` janky frames over 12 fast flings on the list.
- **Hill 1's rows**: `mobile/qa/layout-read.mjs` over a hierarchy dump of Beranda's first screen.

## `main` (51737691), before anything

| What | `main` |
| --- | --- |
| Cold start, median of 7 | 917 ms (883–958) |
| Tab switch | p50 71 ms, p90 91 ms, max 110 ms (Jadwal) |
| Scroll, janky frames | Tugas 0.38%, Kuliah 0.27%, Jadwal 0.29% |
| Bottom bar | Beranda · Jadwal · Tugas · Kuliah · Akademik (no profile) |
| The avatar in a top bar | every tab |
| Beranda's first screen | header, the class card, "Perlu kamu urus", "Nanti hari ini" (cut off by the bar); no `home.search`, `home.now`, `home.strip`, `home.grid` |
| Things to tap on it (tab bar not counted) | 11 (`layout-read.mjs`) |
| Words on it | 56 |
| First run (demo, data cleared, first-run link): taps to Beranda | 1; Beranda's shapes at about 3 s after the tap, filled at about 6 s, "Semua siap" at about 28 s |
| First run: janky frames from open to "Semua siap" (40 s) | 33% (1133 of 3398) |

## The first minute: concept round (00:45)

Three concepts built in the demo, each recorded on the phone (data cleared, first-run link, one tap) and judged blind as
8-frame film strips beside today's welcome and the desktop's scene. Three judges (Claude Fable 5.2, one per account), letters shuffled per judge.

| Candidate | Home takes over | Janky frames (40 s) | Designer | Student | Prosecutor (serious charges) |
| --- | ---: | ---: | --- | --- | --- |
| Today's welcome (`main`) | shapes 3 s, filled 6 s | 33% | 4th | 3rd | 2nd (5) |
| "Your term arrives" (a sheet where courses land one by one) | 17 s | 29% | 3rd | 4th | 4th (6) |
| **"Two doors, one room"** (Edunex and SIX fill, join, the blue opens into Beranda) | 11 s | 24% | **1st** | **1st** | **1st (4)** |
| "Touch the light" (a dark stage, one light) | 13 s | 26% | 2nd | 2nd | 3rd (6) |

Scores for the winner: designer mood 6, remember 8, never waited 6, would ship 7; student mood 7, remember 8, never waited 6; prosecutor mood 7,
remember 8, never waited 6, nothing shows off 6. **Not at the top (9).** What all three asked for: no stand-in list that is thrown away (hand
over to the real Beranda at about 6 s and let its cards fill in place); the doors must not look like a choice; the button becomes the
status in words; names in the app's language; no late "Semua siap" bar; no dark-to-light flash; jank far under 24%.

## The direction round (00:55)

Three directions built in the demo as real screens (Beranda, Tugas, Kuliah, Profil, Semua layanan), each photographed on the phone in
light and dark, and judged blind against today's app: four candidates by letter, shuffled per judge. Three judges (Claude Fable 5.2,
one per account): a designer, a student, a prosecutor.

| Candidate | Designer | Student (want on my phone · "where everything is") | Prosecutor (serious charges · "where") | Home, lowest–highest score |
| --- | --- | --- | --- | --- |
| A, closest to Gojek (a blue strip, coloured tiles, sideways class cards) | 1st | 4th · 4th | 2nd (7) · 2nd | 4–8 |
| **B, Edunex Mobile done right** (a white page, the class as the one colour block, quiet counts, a timeline) | 3rd | **1st** · 2nd | 3rd (8) · 3rd | 4–8 |
| C, its own character (chunky solid blocks you press into) | 2nd | 2nd · 3rd | 4th (9) · 4th | 4–8 |
| Today's app (`main`) | 4th | 3rd · **1st** | **1st (6)** · **1st** | 4–8 |

**B is the base**: it and C beat today's app for two judges (A for one), and B is the student's first and the prosecutor's cleaner of
the two. **Not at the top:** no home screen reached 9 in any category for every judge, and the prosecutor still counts fewer serious
charges on today's app than on any direction. The student's sureness on the three jobs in B: due soonest 8, attendance 8, this week's
material 5. Squint: every judge told B's five tabs apart; all three found Tugas and Profil most alike. Every judge put all four above
the official Edunex Mobile LMS home, and none at Gojek's or GoPay's level.

Taken into B (two or more judges): C's solid-colour service tiles with white filled glyphs; A's Profil card (name, NIM, IPK, SKS bar)
and plain group names on Semua layanan; today's app's Kuliah rows readable in full. Fixed first: a fact said twice on Beranda (the
strip's counts repeated as rows), pale-circle icons and glyph mix-ups, light and dark laid out differently, Kuliah's cut-off statuses
and course codes as titles, presence as two different things, the wave. The decisions: `superapp-decisions.md`.

## Rounds

Speed is read beside `main` measured in the same minutes: after an hour of installs and recordings on the charger the phone runs warm
(Android's thermal status 2, skin about 40 °C) and `main` itself cold-starts in about 1.18 s, not 0.92 s. Each row gives both.

| Round | Commit | Cold start (ours · `main` back to back) | Tab p90 (ours · `main`) | Scroll (Tugas · Kuliah · Jadwal) | Hill 1 | Judges | What changed |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| 0, the base | 53c054cd (B merged over the Fluent icons, the first-minute scene, eight widgets) | 1197 ms · 1179 ms (warm, status 2) | 100 ms · 105 ms | 3.48% · 1.07% · 0.83% (warm; `main` cool: 0.38% · 0.27% · 0.29%; to be taken again back to back) | bar ends in `tab.profile` ✓ · no avatar ✓ · `home.search`, `home.now`, `home.strip`, `home.grid` in order and fully visible ✓ · 17 things to tap ✓ · 40 words ✓ · no "0" ✓ · the grid's tiles not yet countable by the reader | the direction round, above | step by step from `main`: icons 1190, first minute 1198, widgets 1161, iPhone widgets 1177, B 1197: no merge costs a start |
