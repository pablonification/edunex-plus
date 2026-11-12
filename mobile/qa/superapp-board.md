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

## Round 4's council (06:25): the last full round

Commit 91a8088b beside today's app and round 3 (three versions by letter, shuffled per judge, light and dark).

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three versions | **round 3**, round 4, today's | **round 4**, round 3, today's | **round 4** (10 serious charges on 15 screens), round 3 (13), today's (26 on its 11) |
| Against today's app | ours on 11 of 11 | ours on 11 of 11 | ours on 10; today's on Nilai (narrowly: "shows real history") |
| Against last round | **round 3 on Beranda, Beranda scrolled, Jadwal (close), Tugas (close), Kuliah, Profil (a hair), a course's page, a Task (a hair)**; round 4 on Semua layanan, Materi, Ujian, Nilai, Notifikasi, Pengaturan, Search | round 4 on 10 of 15; **round 3 on Tugas, Kuliah, Materi, Ujian, Search** | round 4 on 9; **round 3 on Beranda (narrowly), Tugas, Kuliah, a course's page, Nilai (narrowly)** |
| "I know where everything is", five apps | 2nd (behind Gojek) | **1st** | 3rd (behind Gojek and Grab) |
| Overall, five apps | 2nd (behind Duolingo) | 2nd (behind Duolingo) | 4th (Duolingo, Gojek, Grab, ours) |
| Squint | 5 of 5 | 5 of 5 | 5 of 5 |
| Scores per screen, lowest–highest | (scored round 3: 5–9) | 5–9; Beranda 8 8 8 8 7 8 8 7 8 8 | 5–8; Beranda 6 7 7 7 6 6 6 7 6 6 |
| Sureness: due soonest · attendance · material | | 8 · 7 · 8 | |

**Not at the top, and one judge prefers last round's.** The designer puts round 3 first on the five tabs; two or more judges
prefer round 3's Tugas (an undated exam now sits inside a dated group), Kuliah (the dots and "absen" on every row), Beranda (the
strip's "1 lewat batas" reads as an overdue task; "Presensi" twice on the class block; the clash's time on two rows) and a
course's page (this week's module named twice). Those six parts went back to round 3's form in a last change after this council
(the six fixes below, **not judged**). What round 4 kept and every judge preferred: Semua layanan's tiles, a Materi page that
isn't empty, Nilai's guesses said once, Notifikasi and Search with one glyph per row, Jadwal's clash side by side.

## Round 3's council (05:05)

Commit d09a29a0 beside today's app and round 2 (three versions by letter, shuffled per judge, all in light and dark).

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three versions | **round 3**, round 2, today's | **round 3**, round 2, today's | **round 3** (11 serious charges on 15 screens), round 2 (14), today's (26 on its 11) |
| Against today's app | ours on 11 of 11 | ours on 10; today's on Nilai ("answers at a glance") | ours on 10; today's on Beranda scrolled (narrowly) |
| Against last round | round 3 on 13 of 15; **round 2 on Materi and Nilai (close)** | round 3 on 10; **round 2 on Semua layanan, Materi, Ujian, a course's page, Nilai** | round 3 on 10; **round 2 on Beranda scrolled, Semua layanan, Materi, Nilai, Search** |
| "I know where everything is", five apps | 2nd (behind Gojek) | **1st** | 3rd (behind Gojek and Grab) |
| Overall, five apps | 3rd (Duolingo, Gojek, ours) | 2nd (Duolingo, ours) | 3rd (Duolingo, Gojek, ours) |
| Squint | 5 of 5 | 5 of 5 | 5 of 5 |
| Scores per screen, lowest–highest | 5–9; Beranda 9 8 8 8 7 7 7 8 9 8 | 5–9; Beranda 9 8 8 8 8 8 8 7 8 8 | 4–8; Beranda 6 7 7 7 7 7 7 7 6 6 |
| Sureness: due soonest · attendance · material | | 7 · 8 · 7 | |

**Not at the top.** No judge prefers today's app or round 2 overall, but every judge prefers round 2's Materi (round 3's opens on one
row and a folded "Sebelumnya 12") and none prefers round 3's Nilai ("perkiraan" on every row). The prosecutor would ship round 3
"with the listed charges cleared": Beranda's day list skips tomorrow's meeting and shows an exam as a class; two strip tiles need
a second read; the clash on Jadwal hides a room; Kuliah's dots need a key; grey service tiles look switched off. Round 4 works
from that list (seven screen children and the kit).

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

## The first minute: rounds 5 and 6 (06:08 and 06:35)

Round 5: nothing at a door's foot before the tap, a bright ring, the name staying on its door, the greeting when the first door
lights. Judged blind beside today's welcome and round 4's scene by three new judges.

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three | **round 5** (narrowly), round 4, today's | **round 5**, round 4, today's | **round 4** (4 serious charges in light, 3 in dark), round 5 (5 and 3), today's (7) |
| "Sets a mood" · "I'd remember it" · "it never made me wait" | 8 · 8 · 7 | 7 · 7 · 6 | 7 · 7 · 6 |
| Motion has a job · hand-over · would ship | 7 · 7 · 7 | (knew what was happening 8, trust 8, one move 6) | nothing shows off or delays 7 · 7 · 5 |

**One judge preferred last round's**: the prosecutor, for a headline swap that printed two lines over each other, doors that met a
second before the second system was in, and stutter. Round 6 fixed the first two, fades the doors as the stage lifts (they were
cut by the status bar's line), and gives the phone's own buttons white ink on the stage. Measured on the phone over five runs
each, without recording: tap to the end of the lift **7–11% janky frames in round 5, 8–10% in round 6** (the top is under 5%);
the stage at rest draws 0 frames; Beranda filling 3–8%. Round 6's own check by two judges is in the hand-off, not here.

## The first minute: round 4 (05:05)

No hold after the ticks: as SIX connects the headline becomes "Pagi, Dimas.", the doors close onto the mark and the stage lifts
in the same move; each door's ring turns while its system connects; the failed, offline and SIX-later ways in have their own
state. Judged blind beside today's welcome and round 3's scene by three new judges.

| | Designer | Student | Prosecutor |
| --- | --- | --- | --- |
| Rank of the three | **round 4**, round 3, today's | **round 4**, round 3, today's | **round 4** (1 serious charge in light, 1 more in dark), round 3 (2 and 3), today's (6) |
| "Sets a mood" · "I'd remember it" · "it never made me wait" | 7 · 7 · 8 | 8 · 8 · 7 | 8 · 8 · 8 |
| Motion has a job · hand-over · would ship | 8 · 7 · 7 | (knew what was happening 8, trust 8, one move 8) | nothing shows off or delays 8 · 8 (light) · 7 |

Preferred to today's and to last round's by every judge, three rounds in a row. **Not at the top (9).** Janky frames on the phone:
the stage at rest 0 frames drawn, tap to the end of the lift 8% (22 of 276), Beranda filling 2%. Left: the empty rings at rest
read as radio buttons; the turning ring is faint; the greeting is on screen for under a second; "Terhubung" repeats the tick; the
dark strip the judges got missed the lift (the lead's mistake: it is recorded, and goes in the next pack). Round 5 works from
that list.

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

## The journeys, walked on the phone (05:35, commit 5198109f, the demo app, Maestro flows in `mobile/flows/journeys/`)

| Journey | Top of the hill | On the phone | Steps |
| --- | --- | --- | --- |
| Morning: what's my day, what's due, am I safe | 0 taps | **0 taps, pass** (38 s to run) | Beranda's first screen: the class on now, the strip (next deadline, absences, days to the exam), the grid |
| A class starts | 2 taps or fewer, landing somewhere useful | **1 tap, pass**: "Isi Presensi" opens Edunex's presence page; Back lands on Beranda with its four blocks | Beranda → "Isi Presensi" |
| A deadline | 3 taps or fewer to the brief; a clear finish | 2 by the flow's count; **not run on the phone** (the hand-in opens the phone's own file picker, which the lead keeps away from the owner's files); CI's emulator runs it | Beranda → the strip's deadline (or Tugas → the Task) → the brief |
| After class: this week's material, opened | 2 taps or fewer | **3 taps, pass, one over the top**: the demo's only item this week is a meeting link that opens outside the app, so the flow opens an older module's page behind "materi lainnya" | Beranda → Materi → the rest → an item |
| After an exam: my grade and my IPK | 2 taps or fewer | **2 taps, pass** | Beranda → Nilai → a course |
| The office things: KRS, UKT, the calendar | 2 taps or fewer each | **2 taps from Profil, 1 from the grid, pass** | Profil → the row; or the tile |
| Looking for something by name | result opened in 2 taps after typing | **2 taps, pass** | `home.search` → type → a result |

Six of seven pass as flows on the phone; one isn't run on this phone. CI's own flows (`smoke`, the judge's walk without its file
picker and calendar steps, the first run, Edunex alone) pass on the phone too.

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

**The widget council, round 2 (02:45; read at 04:45):** three new judges, this round's renders beside round 1's and today's two, by
letter. Every judge prefers this round's set to round 1's (designer on 6 of 8 widgets, student on 7 of 8, prosecutor by serious
charges, 19 against 28) and to today's two. "I'd keep this on my home screen" (designer · student · prosecutor): Sekarang 8 · 8 · 7,
Hari ini 8 · 6 · 7, Tenggat 7 · 7 · 7, Kehadiran 8 · 7 · 6, Ujian 5 · 5 · 5, Kelas berikutnya 7 · 6 · 5, Pintasan 5 · 3 · 4, Satu
mata kuliah 5 · 4 · 5. **Not at the top (9).** Worst: Ujian leads with a date instead of the day count; Pintasan's bare numbers
and a grade average on the home screen; Satu mata kuliah's dots that flip meaning; sizes that only add blank space; the update
stamp reading as a debug line. Round 3 of the widgets works from that list.

**The widget council, round 3 (05:33):** three new judges, this round's renders beside round 2's and today's two. Every judge
prefers this round's set (designer and student on 6 of 8 widgets, prosecutor by serious charges, 8 against 20). "I'd keep this on
my home screen" (designer · student · prosecutor): Sekarang 8 · 8 · 7, Hari ini 8 · 7 · 7, Tenggat 8 · 8 · 6, Kehadiran 7 · 6 · 4,
Ujian 9 · 7 · 7, Kelas berikutnya 8 · 8 · 6, Pintasan 5 · 3 · 5, Satu mata kuliah 8 · 5 · 5. **Not at the top (9).** Decided from
it: Pintasan leaves the set ("a launcher folder already does this": seven widgets ship), and the absence dots follow one rule in
the app and the widgets, the one all three judges named: a full dot is an absence still left, a ring one used, red one over.

**The widget council, round 4 (06:27):** seven widgets (Pintasan is out), the dots under one rule, every deadline with its hour.
The designer and the prosecutor prefer this round's set (5 serious charges against 8); **the student prefers round 3's** on
Tenggat (course names, not codes), Kehadiran (marks in the state's colour drew the eye to the courses in trouble) and Kelas
berikutnya. "I'd keep this on my home screen" (designer · prosecutor; the student scored round 3's set): Sekarang 8 · 8, Hari ini
8 · 7, Tenggat 7 · 6, Kehadiran 8 · 7, Ujian 7 · 6, Kelas berikutnya 8 · 7, Satu mata kuliah 5 · 6. **Not at the top (9).**

**On the real phone (06:24):** the launcher's cells are bigger than every render assumed: a 4×2 is 373×260 dp on this Samsung,
not about 290×200. At that size "Sekarang" drew only its block, stretched, with none of its rows. Every widget score above is
for a grid this phone doesn't have. The last widget change makes each widget choose its layout from the dp it is given and
renders at this phone's sizes; it is **not judged**.

## Motion, on film strips (06:30)

Five interactions recorded on the phone (the demo, commit 91a8088b), 12 frames each, 0.1 s apart: opening Semua layanan, the
Tugas tab, "Belum selesai" to "Selesai", opening Materi, unfolding Materi's older items. Two judges (a designer and a prosecutor).

| | Designer | Prosecutor |
| --- | --- | --- |
| The touch is answered at once (A · B · C · D · E) | 7 · 8 · 6 · 7 · 8 | 7 · 9 · 8 · 8 · 9 |
| The motion has a job / nothing cut, blank or broken | 6 · 5 · 2 · 6 · 2 | 5 · 4 · 2 · 5 · 3 |
| The right length / nothing delays | 4 · 8 · 3 · 4 · 4 | 4 · 9 · 4 · 4 · 8 |
| Verdict | "unfinished" | "yes with the listed charges cleared; as it stands, no" |

**Not at the top (9).** Every touch is answered in the frame it lands and nothing decorates. But the switch to "Selesai" shows
an empty list for 0.2 s with the underline still under the other tab; a pushed page starts 0.4 s after the touch and passes
through one frame of both pages at half strength; the Tugas tab and Materi's unfold cut. Not fixed tonight.

## Rounds

Speed is read beside `main` measured in the same minutes, for two reasons found tonight. A build Android has only just installed
runs unoptimised until the system compiles it: `main` freshly installed cold-starts in about 1.2 s, the same code installed since the
morning in 0.92 s, and 0.98 s once compiled by hand (`cmd package compile -m speed`). And after an hour of installs and recordings on
the charger the phone runs warm (thermal status up to 2, skin about 40 °C). Each row gives both builds in the same state.

| Round | Commit | Cold start (ours · `main` back to back) | Tab p90 (ours · `main`) | Scroll (Tugas · Kuliah · Jadwal) | Hill 1 | Judges | What changed |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| 4, final | cfb2de89 (after round 4's council: the six parts two judges preferred from round 3 put back: the strip's absence tile, "tutup 09:30", a clash's time once, an undated exam under its period's label, a course's module named once, Kalender's glyph; the absence marks in their row's colour; widgets that choose their layout from the dp the launcher gives; the first minute's round 6 with no entrance on its mark, headline and button) | 1107 ms · 1078 ms (taken one commit earlier, 06:35, both compiled, thermal 0, 36 °C; **+2.7%, and over 1.0 s for both**: at 04:50 both read about 990 ms) | 80 ms · 86 ms | 0.91% · 0.31% · 0.20% (`main`: 1.20% · 0.10% · 0.51%) | all rows ✓: 16 things to tap, 49 words, 8 tiles ending in "Lainnya", no "0" | not judged | CI's emulator flows on 91a8088b: `smoke`, `use`, `judge-light` pass, `judge-dark` failed on the first-run stage (fixed here) |
| 4 | 91a8088b (fifth and sixth waves: motion in the kit and the screens; Beranda's strip naming the task and its hour, tomorrow in the day list, exams as exams; Jadwal's clash side by side; Kuliah's absences as rings and full dots with their noun; Materi filled; Nilai's guesses said once; tiles in the app's pale blue instead of grey, new glyphs for KRS, Rencana, Ujian; seven widgets; the first minute's round 5) | 1122 ms · 1079 ms (both compiled, **thermal 2, 38 °C**: the phone was warm from an hour of jobs; +4.0%) | 89 ms · 98 ms | 1.79% · n/a · n/a (`main`: 1.10% · 0.10% · 0.41%; an earlier build of this round: 2.96% · 0.20% · n/a) | all rows ✓: 16 things to tap, 50 words (the limit), 8 tiles ending in "Lainnya", no "0" | round 4's council: below | the phone ran warm: every number in this row is slower than round 3's for both builds; cold start is 4% behind `main` here against 0.3% in round 3: to be taken again cool |
| 3 | d09a29a0 (fourth wave: Beranda at 48 words with the absence tile counting every course at its limit and a held first read; Tugas led by the soonest thing of any kind; Jadwal's blocks at their real heights with clashes offset; Kuliah's absences as dots said once; a course's page under its name; Materi folded to this week; Ujian, Search and Notifikasi with course glyphs; Profil's card strong in dark; the first minute's greeting and lift) | 991 ms · 988 ms (both compiled, thermal 0, 33–36 °C) | 78 ms · 87 ms | 0.1–2.4% over four runs, median 1.5% · 0.51% · 0.22% (`main`: 1.29% · 0.19% · 0.31%) | all rows ✓: bar ends in `tab.profile`, no avatar, the four blocks in order and fully visible, 16 things to tap, **48 words**, 8 tiles ending in "Lainnya", no "0" | round 3's council: below | Beranda's words back under 50; nothing redraws at rest; Tugas's scroll back beside `main`'s (5 to 20 janky frames in about 900, `main` 13) |
| 2 | 1eced93a (third wave: true numbers and tags on Beranda, one presence part, a Task page with one status line, Kuliah as counts, a course's page opening on its material, Ujian without the hole, Materi by calendar week, search by course name, Notifikasi without the stuck loader, Settings' switches folded away while off) | 1174 ms · 1167 ms (both compiled, thermal 0) | 82–110 ms · 90 ms (the first tour after a start is the slow one; a second run of ours: 82) | **2.1–2.7%** · 0.51% · 0.32% (`main`: 1.10% · 0.10% · 0.42%): **Tugas is twice as janky as `main`** | bar, avatar, four blocks, 17 things to tap, 8 tiles, no "0": ✓ · **words 58 (over 50)** | round 2's council: below | to fix before round 3: Tugas's scroll, Beranda's words, Beranda redrawing 87 times a second at rest (the "now" dot) |
| 1 | 0aa4379e (every screen in the new look: Foundations' solid tiles and kit, Beranda, Tugas as an agenda, Kuliah in course colours, Profil's card, Jadwal, Materi and Ujian, Search, the first minute's curtain; flows moved) | fresh installs: 1234 ms · 1228 ms (thermal 0–1). Compiled: 984 ms (ours) | 100 ms · 108 ms | 0.94% · 0.31% · 0.20% (`main` in the same minutes: 1.02% · 0.20% · 0.42%) | all rows ✓: bar ends in `tab.profile`, no avatar, the four blocks in order and fully visible, 17 things to tap, 46 words, 8 tiles (4+4) ending in "Lainnya", no "0". The reader's guess that "Ujian" and "Nilai" may be cut is wrong on the picture | round 1's council: below | Beranda no longer says a fact twice; the wave is a plain bar; presence is "Isi Presensi" on Beranda and Kuliah; 0 flows name an id the app lacks |
| 0, the base | 53c054cd (B merged over the Fluent icons, the first-minute scene, eight widgets) | 1197 ms · 1179 ms (warm, status 2) | 100 ms · 105 ms | 3.48% · 1.07% · 0.83% (warm; `main` cool: 0.38% · 0.27% · 0.29%; to be taken again back to back) | bar ends in `tab.profile` ✓ · no avatar ✓ · `home.search`, `home.now`, `home.strip`, `home.grid` in order and fully visible ✓ · 17 things to tap ✓ · 40 words ✓ · no "0" ✓ · the grid's tiles not yet countable by the reader | the direction round, above | step by step from `main`: icons 1190, first minute 1198, widgets 1161, iPhone widgets 1177, B 1197: no merge costs a start |
