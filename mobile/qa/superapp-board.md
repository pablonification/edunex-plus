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

## Round 2's council (02:25)

Commit 1eced93a beside today's app and round 1 (three versions by letter, shuffled per judge; round 1 in light only, which made
the prosecutor count it as "dark unproven" and write its charge sheet for round 1: the lead's packing mistake).

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three versions | round 2, round 1, today's | round 2, round 1, today's | serious charges on 11 screens: round 1 7, round 2 8, today's 18 |
| Against today's app | ours on 9 of 11; today's on Beranda scrolled (close) and Jadwal | ours on 9; today's on Beranda scrolled and Jadwal | ours on 10; today's on Jadwal |
| Against last round | **round 1 preferred on Beranda scrolled, Jadwal, Tugas (close), Kuliah, Materi (close), Search (close)** | **round 1 preferred on Beranda scrolled, Jadwal, Tugas, Kuliah, Semua layanan (barely), Materi** | round 2 on 7 of 11, round 1 on Beranda scrolled, Tugas, Kuliah |
| "I know where everything is", five apps | 2nd (behind Gojek) | 2nd (behind Gojek) | 2nd (behind Gojek) |
| Overall, five apps | 3rd (Duolingo, Gojek, ours) | 2nd (Duolingo, ours) | 3rd (Duolingo, Gojek, ours) |
| Squint | 5 of 5 | 5 of 5 | 5 of 5 |
| Scores per screen, lowest–highest (round 2) | 5–9; Beranda 9 8 8 8 7 7 8 8 9 8 | 5–9; Beranda 8 8 8 7 7 8 8 8 9 7 | (scored round 1) |
| Sureness: due soonest · attendance · material | | 9 · 7 · 9 | |

**Not at the top.** Judges preferred last round's version on five screens: those are rethought in round 3, not patched (a name
broken one word per line beside "Bentrok" on Beranda; "08:00 → 08:00" and cut titles on Jadwal; 16 Okt above 15 Okt on Tugas;
every absence said twice on Kuliah; 18 old items open under one new one on Materi). The strip's "1 · Lewat batas" undercounts
(attendance sureness fell from 9 to 7).

## Round 1's council (01:40)

Every screen of commit 0aa4379e, light and dark, beside today's app (`main`), unlabelled, sides flipped for one judge. Three judges
(Claude Fable 5.2, one per account).

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Against today's app, 11 screens | ours on 9; today's Notifikasi preferred (three loading rows left above real content); the Task pair wasn't like for like (the lead's mistake: an exam page against a Task) | ours on 10; the Task pair as above | ours on 9, Settings a draw; serious charges 17 against today's 35 on the same screens (24 on all 15 of ours) |
| "I know where everything is", five apps | 2nd (Grab, **ours**, Gojek, Edunex Mobile, Duolingo) | 2nd (Gojek, **ours**, Grab, Duolingo, Edunex Mobile) | 3rd (Gojek, Grab, **ours**, Duolingo, Edunex Mobile) |
| Overall, five apps | 3rd (Duolingo, Gojek, **ours**) | **1st** ("happy to open every morning") | 4th (Duolingo, Gojek, Grab, **ours**) |
| Squint, five tabs | 5 of 5; most alike Beranda and Profil | 5 of 5; the same pair | 5 of 5; the same pair |
| Scores per screen, lowest–highest | 4–8 | 4–9 | 3–8 |
| The student's sureness: due soonest · attendance · this week's material | | 8 · 9 · 8 (the direction round: 8 · 8 · 5) | |

**Not at the top.** No screen holds 9 in every category for any judge. Lowest: a Task's page (3–7: three tinted boxes of sentences),
Notifikasi (3–8: loading rows that stay), Ujian (4–9: a blank hole in light, one exam under two names), Materi (4–8: a wrong week
label, mostly empty), a course's page (4–9: the old class card, two buttons, a countdown to the wrong thing). Across the app:
numbers that disagree between screens (4 and 7 days to the same exam), one action under three names, colours reused with no rule,
rows that don't look tappable, six controls under 48 dp. Above Edunex Mobile LMS for every judge; not first for "where" for any.

## The first minute: round 3 (02:40)

The doors now show what each system just learned, the mark is the stage's one light, nothing loops, and Beranda's blocks are held as
shapes under the stage. Recorded in light and dark, judged blind beside today's welcome and round 2's scene by three new judges.

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three | **round 3**, round 2, today's | **round 3**, today's, round 2 ("pretty but wrong about my absences") | **round 3** (2 serious charges), today's (5), round 2 (7) |
| "Sets a mood" · "I'd remember it" · "it never made me wait" | 8 · 7 · 7 | 8 · 7 · 7 | 8 · 7 · 6 |
| Motion has a job · hand-over · would ship | 8 · 7 · 7 | (knew what was happening 7, trust 8) | nothing shows off or delays 6 |

Preferred to today's and to last round's by every judge, two rounds in a row. **Not at the top (9).** Janky frames on the phone: the
stage at rest 0 frames drawn (was 51% of 586), tap to the lift 9%, Beranda filling 1%. Left: a one-second hold after both ticks; a
blank lower third of Beranda as the stage lifts; the SIX door empty beside Edunex's name; in dark, a banded glow and a faint title.

## The first minute: round 2 (01:35)

The winner rebuilt (no stand-in list; the stage lifts away like a curtain about 5 s after the tap and Beranda fills in place), recorded
on the phone in light and dark, judged blind beside today's welcome and last round's scene by three new judges.

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Against today's welcome | prefers the new one | prefers the new one | prefers the new one |
| Against last round's | prefers the new one | prefers the new one | prefers the new one |
| "Sets a mood" · "I'd remember it" · "it never made me wait" | 8 · 7 · 8 | 8 · 7 · 8 | 7 · 6 · 6 |
| Would ship · nothing shows off or delays | 6 | (trust 7) | 6 · 4 serious charges |

**Not at the top (9).** Janky frames, phase by phase on the phone: the stage at rest 51% (it redraws 59 times a second with nothing
happening), tap to curtain 8%, Beranda filling 5%, Beranda settled 1%. What's left: frames; the sheet's words crossing the clock as it
lifts; a muddy frame at 3 s; doors that stay blank for 4 s; and what Beranda shows while it still reads (a green "Absen aman" that
turns into "3 Absen habis", the class block growing 100 px, two different task counts).

## The journeys, walked on the phone (02:40, commit f1f50916, the demo app, Maestro flows in `mobile/flows/journeys/`)

| Journey | Top of the hill | On the phone | Steps |
| --- | --- | --- | --- |
| Morning: what's my day, what's due, am I safe | 0 taps | **0 taps, pass** (47 s to run) | Beranda's first screen: the class on now, the strip (next deadline, absences, days to the exam), the grid |
| A class starts | 2 taps or fewer, landing somewhere useful | **1 tap** to Edunex's presence page; **the flow failed** on what it expected next (it looked for SIX's page), and after Back the block doesn't yet move on to what's next in the demo | Beranda → "Isi Presensi" |
| A deadline | 3 taps or fewer to the brief; a clear finish | 2 by the flow's count; **not run on the phone** (the hand-in opens the phone's own file picker, which the lead keeps away from the owner's files) | Beranda → the strip's deadline (or Tugas → the Task) → the brief |
| After class: this week's material, opened | 2 taps or fewer | 2 taps; **the flow failed**: the first item this week is a meeting link that opens outside the app, not a module's page | Beranda → Materi → an item |
| After an exam: my grade and my IPK | 2 taps or fewer | **2 taps, pass** | Beranda → Nilai → a course |
| The office things: KRS, UKT, the calendar | 2 taps or fewer each | **2 taps from Profil, 1 from the grid, pass** | Profil → the row; or the tile |
| Looking for something by name | result opened in 2 taps after typing | **2 taps, pass** | `home.search` → type → a result |

Four of seven pass as flows; two fail on the flow's own expectation (to fix in the flow), one isn't run on this phone.

## Widgets (so far)

| What | `main` | Now |
| --- | --- | --- |
| In the phone's picker | 2, sharing one preview, one with no description | 8, each with its own name, size, one-line description and preview (the previews are native pictures made before the redesign: they show the first drawings) |
| On the home screen | "Now" 4×2 as a white box of text lines | three placed on one new page of the phone (Sekarang 4×2, Hari ini 3×2, Pintasan 4×1) in the app's new look, drawn as the renders show |
| Sizes | stretched only wider | each resizes both ways, laid out for 3–4 sizes (renders of all 8 at every size, light and dark, and four other states: 189 pictures) |
| The app's frames while widgets redraw | a freeze reported on slow phones | scrolling Tugas across the three widgets' redraw after a cold start: 0.93% janky frames (0.94% with none redrawing): no freeze seen on this phone |
| iPhone | none | two widgets (small, medium, large, Lock Screen) and a Live Activity built from the same model; green in CI; **nobody has seen them run** |

**The widget council (02:10):** three judges (Claude Fable 5.2), the renders of all eight and the phone's picture, beside today's two.
Every judge prefers the new set. "I'd keep this on my home screen" (designer · student · prosecutor): Sekarang 7 · 8 · 5, Hari ini
8 · 7 · 6, Tenggat 6 · 6 · 5, Kehadiran 5 · 5 · 4, Ujian 6 · 4 · 3, Kelas berikutnya 7 · 6 · 5, Pintasan 3 · 3 · 3, Satu mata
kuliah 5 · 4 · 4. **Not at the top (9).** Worst: empty and holiday states that show a presence button; the tall sizes half empty;
a foot that says "Memperbarui…" and stays; Pintasan "carries no information"; a render that differs from the phone on one row.

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

Speed is read beside `main` measured in the same minutes, for two reasons found tonight. A build Android has only just installed
runs unoptimised until the system compiles it: `main` freshly installed cold-starts in about 1.2 s, the same code installed since the
morning in 0.92 s, and 0.98 s once compiled by hand (`cmd package compile -m speed`). And after an hour of installs and recordings on
the charger the phone runs warm (thermal status up to 2, skin about 40 °C). Each row gives both builds in the same state.

| Round | Commit | Cold start (ours · `main` back to back) | Tab p90 (ours · `main`) | Scroll (Tugas · Kuliah · Jadwal) | Hill 1 | Judges | What changed |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| 2 | 1eced93a (third wave: true numbers and tags on Beranda, one presence part, a Task page with one status line, Kuliah as counts, a course's page opening on its material, Ujian without the hole, Materi by calendar week, search by course name, Notifikasi without the stuck loader, Settings' switches folded away while off) | 1174 ms · 1167 ms (both compiled, thermal 0) | 82–110 ms · 90 ms (the first tour after a start is the slow one; a second run of ours: 82) | **2.1–2.7%** · 0.51% · 0.32% (`main`: 1.10% · 0.10% · 0.42%): **Tugas is twice as janky as `main`** | bar, avatar, four blocks, 17 things to tap, 8 tiles, no "0": ✓ · **words 58 (over 50)** | round 2's council: below | to fix before round 3: Tugas's scroll, Beranda's words, Beranda redrawing 87 times a second at rest (the "now" dot) |
| 1 | 0aa4379e (every screen in the new look: Foundations' solid tiles and kit, Beranda, Tugas as an agenda, Kuliah in course colours, Profil's card, Jadwal, Materi and Ujian, Search, the first minute's curtain; flows moved) | fresh installs: 1234 ms · 1228 ms (thermal 0–1). Compiled: 984 ms (ours) | 100 ms · 108 ms | 0.94% · 0.31% · 0.20% (`main` in the same minutes: 1.02% · 0.20% · 0.42%) | all rows ✓: bar ends in `tab.profile`, no avatar, the four blocks in order and fully visible, 17 things to tap, 46 words, 8 tiles (4+4) ending in "Lainnya", no "0". The reader's guess that "Ujian" and "Nilai" may be cut is wrong on the picture | round 1's council: below | Beranda no longer says a fact twice; the wave is a plain bar; presence is "Isi Presensi" on Beranda and Kuliah; 0 flows name an id the app lacks |
| 0, the base | 53c054cd (B merged over the Fluent icons, the first-minute scene, eight widgets) | 1197 ms · 1179 ms (warm, status 2) | 100 ms · 105 ms | 3.48% · 1.07% · 0.83% (warm; `main` cool: 0.38% · 0.27% · 0.29%; to be taken again back to back) | bar ends in `tab.profile` ✓ · no avatar ✓ · `home.search`, `home.now`, `home.strip`, `home.grid` in order and fully visible ✓ · 17 things to tap ✓ · 40 words ✓ · no "0" ✓ · the grid's tiles not yet countable by the reader | the direction round, above | step by step from `main`: icons 1190, first minute 1198, widgets 1161, iPhone widgets 1177, B 1197: no merge costs a start |
