# Beranda and the first run (round 2: W4/W11, W7, W10, W12, W15 on Beranda): notes

Helper `r2-home`, branch `mobile-r2-home`, on DESKTOP-4SEOA4J. What changed, what was decided and what was measured.
The design system is `mobile/DESIGN.md`; the plan rows are in `mobile/PROGRESS.md` ("Screen plans").

## Beranda

In three seconds: is a class on now or next, is there Tandai Hadir to press, what's urgent.

| Order | Part | What it shows | A tap |
| --- | --- | --- | --- |
| 0 | Greeting | `Kamis, 8 Oktober · Semester 1 2026/2027`, `Selamat pagi, Dimas` (Headline S), an exam period coming as one quiet line | - |
| 1 | Now card (`screens/home/now.tsx`) | the state (`Sedang berlangsung · sampai 10:00` / `Berikutnya · dalam 25 mnt`), the time big (Display S start, Title L end), the course (Title L), code and room, chips for what's unusual (`Jam berubah`, `Jatah absen habis`, `UTS`, `Tidak ada di jadwal SIX`), one line about Tandai Hadir, at most one filled button (Tandai Hadir when SIX shows it, the Presence when it counts, Gabung when an online class is on or about to start) | the card: its class's sheet; the button: its action |
| 2 | Perlu perhatianmu (`needs.tsx`) | three rows at most; `Lihat semua` when there are more or some are put off or away (the whole list is `/needs`) | a row: its Task or exam; swipe / long press: Sudah beres, Ingatkan nanti |
| 3 | Hari ini (`today.tsx`) | short rows: time, course, code and room, one warning line (no absences left, a clash, a new time); tomorrow under it | a class: the same class sheet; a deadline: its Task |
| 4 | Yang berubah (`changes.tsx`) | one row: how many this week, the newest | its sheet (the last five), `Lihat semua` → the bell |

The class sheet (`class-sheet.tsx`) holds what the card and rows left out: the day and time, a new time with the usual
one, the room, a clash and which to pick, where attendance counts with the share and what's left, Tandai Hadir's state
and "Dicek tiap 2 menit selama aplikasi terbuka", the Presence window with its countdown, what comes after, a class SIX
couldn't read. Its footer: the one action (filled) beside `Buka mata kuliah` / `Buka ujian` (outlined).

Cut from Beranda: the term's course cards (they're Kuliah's job, and their ↗ to Edunex beside a card that opened the
course was W12), the Presensi paragraphs and "Dicek tiap 2 menit" (in the sheet), five changes (one row), the visible
✓ and alarm icons on every row (the swipe, the long press and TalkBack's actions do it; they crowded each row, W11).

States: saved data at once; before any, a skeleton in Beranda's shape (the card, three rows, two rows); Hari ini while
SIX is still being read is a skeleton too (it used to say "after SIX is connected" while SIX was connecting); empty
lists say why (the desktop's words); the status line and banner are the shell's.

### Decisions

1. **Beranda's own class sheet**, not Jadwal's (`screens/schedule/details.tsx`). Jadwal's sheet reads Jadwal's world
   (`ScheduleWorldProvider`) and is being redesigned by the Jadwal helper at the same time; Beranda's carries the now
   card's facts (Tandai Hadir's state, the Presence window, what comes after) that Jadwal's doesn't. Worth merging into
   one `parts/class-sheet.tsx` once both land (the lead's call).
2. **No visible row icons** on Beranda's rows: the long press (an ActionSheet) is the visible way, TalkBack gets the
   same actions (`Row quick=`), and the swipe is the shortcut.
3. **The courses left Beranda** for Kuliah. Check A's `home.absence-budget.*` entries are checked on Kuliah
   (`screens.json` `byEntry`).
4. **After Tandai Hadir** the card marks the Student's step (they went to SIX's page from the app, `checked-in.ts`,
   and SIX's next read no longer shows the button) with the check that draws itself, and says only what the app
   knows: "SIX tak lagi menampilkan Tandai Hadir. Hitungan SIX setelah kuliah menunjukkan apakah hadirmu tercatat."
   The button going away can also mean SIX closed it, or a press that failed: no claim of presence (the lead's
   review). The demo's pretend SIX page closes the button when opened (`host.ts`), so the moment can be seen.

## The swipe (W7, `ui/swipe.tsx`, shared)

Gmail's: the row follows the finger over the action's colour; past 35% of its width (or a flick past 25%) a haptic tick
and the icon growing say letting go will do it. Toward the end: Sudah beres (success), the row slides out, folds away
(250 ms), the action runs and the snackbar offers Urungkan; a row still there 1.5 s later (the action failed) comes back.
Toward the start: Ingatkan nanti (warning), the row springs back with the expressive spring and the times open. All on
the UI thread (gesture handler 3's `usePanGesture`, Reanimated); the gesture's config is memoized so a redraw doesn't
rebuild it. Remove animations: the row fades instead of sliding. Tugas' and the exam rows get the same swipe (their
`SwipeRow` API is unchanged: a success action goes toward the end, others toward the start).

## The first run (W15)

`shell/welcome.tsx`: one screen in the app's colours (light or dark with the phone): the mark, "Edunex Plus", one
line, three reasons (an icon in a tonal circle and a few words), the language as a small outlined chip in the corner,
and at the bottom one filled button "Masuk dengan akun ITB" with "Kata sandimu tidak pernah sampai ke Edunex Plus" under
it. Each part comes up a beat after the one before (a spring; a fade with Remove animations). An error opening the
sign-in is an inline banner above the button, not a toast.

The button opens Edunex's sign-in (`shell/sign-in.tsx`): ITB's Microsoft page slides up as a full-screen dialog with a
Material bar (close, "Masuk ke Edunex", the lock and the host); SIX joins quietly on the same Microsoft session (the
desktop's `signInToBoth`). As soon as one system is in, the welcome fades and Beranda is there, in its own shape,
filling in; the top bar's status line says what the first read is on ("Membaca Edunex · Tugas…", `TabHeader`, shared).
When the read is in, a card on Beranda: "Semua siap, Dimas. 5 mata kuliah · 10 tugas · 40 pertemuan", `Lihat ringkasan`
(the summary screen) and close; either marks it seen (`firstScanDone`). Notifications are asked on Beranda the first
time there's a class: "Ingatkan aku sebelum kuliah", Nanti / Nyalakan (then Android's prompt); the answer is kept on
the phone (`home-asked.json`) and the card never comes back. Gone: the credit, the three-step deck, the reading step's
glimpse of Beranda, the summary taking over the screen, the permission at "Buka Edunex Plus".

## Contrast (design skill's scripts/contrast.py)

New pairs: onPrimaryContainer on primaryContainer (the summary card) 8.25 light / 7.93 dark; primary on
primaryContainer (its Lihat ringkasan) 4.86 / 4.64; success text on surfaceContainer (the card's "Sedang berlangsung")
6.56 / 10.04; warning on surfaceContainer 5.96 / 10.09; onSurfaceVariant on surfaceContainer 6.51 / 7.79; the chips:
warning 5.99 / 8.51, danger 5.54 / 7.64, neutral 7.23 / 8.23; the swipe's layers: success 6.34 / 8.95, warning
5.99 / 8.51; onSecondaryContainer on secondaryContainer (the reasons, the bell) 11.58 / 9.11; the language chip's
outline on surface 3.92 / 5.35 (3:1 for a border). All pass.

## Fresh install to Beranda with data (item 5): where the time goes, and the proposal

Measured with the `[startup]` lines this branch adds (`host.ts`, `demo/world.ts`), release builds, the signed-in demo
from a fresh install:

| Step (JS thread) | weak | mid |
| --- | ---: | ---: |
| Saved data loaded (`host load`) | 22 ms | 22 ms |
| The demo signs in to Edunex (its first read of Edunex is played fast inside `engine.signIn`) | 195 ms | see table below |
| The demo signs in to SIX, playing SIX's first read fast (13 pages, parsed on the JS thread) | 3242 ms | |
| The rest: ITB's calendar, the public catalog (53 pages), the first alerts settle (`clock.advance(200 s)`) | 1655 ms | |
| **All of it, before the first frame** (`prepare`) | 5093 ms | 5043 ms |
| After the first frame: the catalog's parse still blocks JS (`js-block … itb.catalog`) | 1247 ms | 1048–1169 ms |
| `[perf] first-data` (JS start → Beranda drawn with data) | | 6269–6372 ms |

So ~80% of the 6.3 s is the demo's own first sync, played before the first frame; Beranda's own drawing is ~0.2–0.4 s.
The real app doesn't do this: it draws Beranda first and fills it in after the sign-in, which this branch's first run
now shows (W15: Beranda's skeleton at once after "Masuk dengan akun ITB", data as it comes).

Proposal (not made here: it changes the shared demo, `test/pretend/demo.ts`, which the desktop's demo and the
inventory also run, and Check A's launch):

1. **The phone's demo signs in before the first frame, and syncs after it**: `demoRun.prepare` split into
   `signIn` (the Edunex token and SIX cookie in the vault, no read) and `settle` (the fast-played first read). The
   phone awaits only `signIn` (~0.1 s), so the first frame comes at ~1.2 s with Beranda's skeleton, Edunex's data
   ~1 s later, SIX's ~3 s later, exactly as after a real sign-in. Check A's `launch` then waits for the first read to
   end (the status line's `status.firstRead` gone, or a `[startup] settled` mark) before its checks, so its 100% holds.
2. **The public catalog leaves the first read**: 53 pages parsed on the JS thread (1.0–1.2 s blocked right after the
   first frame) for Kurikulum only; read it when Kurikulum opens, or later in the background, or parse it off the JS
   thread.

Expected with both: fresh install → first frame ~1.2 s, Beranda with Edunex's data < 2 s on mid.

## Numbers

Release builds, the lab's emulators, `qa/shell-measure.sh` with this branch's tours (`qa/flows/home-idle-scroll.yaml`:
two of the minute's ticks on Beranda untouched, then three scrolls down and up; `home-tour.yaml`: the now card's sheet
×3, a Hari ini sheet ×2, Yang berubah's sheet, a swipe and Urungkan, an exam ×2). Runs under `C:\qa\runs\*-shell-home-*`.
"Before" is the shell (981d27f), the build these screens started from; round 1 (9395cea) had the same Beranda.

`weak`, quiet machine (nothing else measured or built):

| Measure (target) | before (981d27f) | after: swipe memoized (b357b2a) | after: rows held (488b31b) |
| --- | --- | --- | --- |
| JS block at the minute's tick on Beranda (< 50 ms) | 168, 182 ms | 108, 123 ms | 52, 110 ms (Beranda's own sections 39–52 ms) |
| JS block when SIX's check-in read lands (every 2 min in class) | 508, 530 ms | 340, 420 ms | 195, 562 ms (all five tabs redraw on that data; Beranda's part is the smaller one) |
| Scrolling Beranda (< 5% janky) | 1.04% of 961 frames, p90 11 ms | 0.41% of 973, p90 10 ms | 0.82% of 975, p90 11 ms |
| Tab switch to Beranda (< 300 ms) | | 10–11 ms | |
| Opening an exam from Perlu perhatianmu (< 500 ms) | | 36–38 ms | |
| Tour janky frames (sheets, swipes) | | 5.72% of 1485 | |

The final build (2843f6b, rebased) measured again on `weak` with four emulators and a build running on the machine:
both builds degraded alike (the shell's idle tour: 64 JS blocks, median 90 ms; this build's: 73, median 91 ms), so those
runs compare nothing and aren't in the table.

`mid` (f3b5393, the first build, before either change): minute tick 89–90 ms; first-data 6.3 s (see above).

What's left over 50 ms: the tick still redraws the now card, the greeting and the top bar's status line (~50 ms on
`weak`); a data change redraws every tab subscribed to it at once (Jadwal, Kuliah, Beranda), a shell-level matter
(gate data like the clock, or let hidden tabs skip it).

## Check A (same data), release 2843f6b on `mid`

| Scenario | Screens run | Score |
| --- | --- | --- |
| signed-in | home 20/20, changes 3/3, courses 6/6, alerts 3/3, settings 12/12, first-scan 8/8, presence 9/9, tasks 15/15 | 100% of those |
| first-run | welcome 4/4, first-scan 8/8 | 12/12, 100% |
| check-in-open | home | 20/20 |
| edunex-only | home | 9/9 |

`screens.json` changes: Beranda's now-card facts are checked in its sheet, Yang berubah's in its sheet, the old course
cards' (class, SKS, absences) on each course's page from Kuliah; the first run's account on Settings once SIX joined,
its counts on Beranda's summary card, each state from a fresh start. Not rerun here: the other helpers' screens this
branch doesn't touch (course, module, plan, grades, task, exam, schedule, class, search); the shell measured them at
100% on the same base. A full-scenario run (`maestro test …/signed-in`) stalled once in the course flow with the app
in the background (Maestro grinding through optional scrolls on the launcher); the per-screen runs above are each
their own `maestro test`.

## Pictures and recordings

`mobile/report/img/mobile-r2-home/`: `weak-{light,dark,light-font1.3}-NN-*.webp` and `mid-…` (the flow:
`qa/flows/home-shots.yaml`): the welcome, Beranda filling in, the summary card, the now card with Tandai Hadir, its
sheet, Beranda, Hari ini, Yang berubah's sheet, a swipe and its snackbar, Ingatkan nanti's times.
Recordings on branch `media-mobile-r2-home`, `qa-media/mobile-r2-home/`: `r2home-first-run-weak.mp4` (40 s),
`r2home-beranda-weak.mp4` (38 s), real speed (flows `qa/flows/rec-home-*.yaml`).

## Shaky, and for others

- **The shared `Sheet`'s `footer` is cut off** (shell, `src/ui/sheet.tsx`): on `mid` and `weak` the native sheet
  measured content with a footer short and hid the footer's last ~20–60 dp. Beranda's sheets put their buttons at the
  end of the content instead (as Jadwal's does). Every other `footer` user should be looked at.
- **A data change redraws every tab** that reads it (the check-in read every 2 min in class: 200–560 ms on `weak`).
- The swipe's flick and threshold were tuned by hand on the emulators; worth a feel on a real phone.

## Round 2, v4 (Arqila's pick): what was built, and what didn't carry over as drawn

Built from `mobile/design/r2-directions/v4/` (`origin/mobile-r2-mockups`), Beranda and its class sheet only (Decision 23).

| v4 asks | Built | Where |
| --- | --- | --- |
| Header in Edunex blue, the greeting the one title, search and the bell | as drawn; the bell's dot in #ffcc4d when something's new; a tap on the greeting opens the sources' sheet; the status line under it only when stale, offline or reading | `screens/home/header.tsx`; the status bar's strip `app/(tabs)/index.tsx` |
| Now card: white, over the header by 60 dp, radius 24, tile, "Sekarang · room" with a pulsing dot, name in Plus Jakarta Sans 18 bold, the wave and the minutes left, one Tandai Hadir | as drawn; minutes up to two hours, then hours, then days; the next class counts down without a wave; a Presence window gets the wave too; another day shows "Besok · 08:00" | `screens/home/now.tsx` |
| After Tandai Hadir: tonal green, the cookie scales in, its check draws, a haptic | as drawn, but the words are "Sudah ke SIX · 09:07" (the Student's step), not "Hadir · 09:07" (the app can't know SIX counted them: the lead's review) | `now.tsx`, `ui/expressive.tsx` CookieCheck |
| Perlu kamu urus: two tinted cards, the course glyph, a kind pill, a big countdown, red when overdue; chevron to the list | as drawn; an attendance item's figure is its best reachable share ("73%", red); nothing to handle: one quiet line, still the way in | `screens/home/urus.tsx` |
| Nanti hari ini: tile, title, "time · room", one chip | as drawn; the chips: Jatah habis, Di bawah target, Bentrok, Jam berubah, Ruang berubah, Tak di SIX | `screens/home/later.tsx` |
| Class sheet: tile, "code · Kuliah", title, facts with a pip meter, buttons | as drawn on the native Material sheet (white, v4's card); three rows on Arqila's word: the time (a move or a clash its one quiet line, "Sekarang" or "Tak di SIX" its chip), the room, the absences with the pips and "Kehadiran 33% · target 80%"; Tandai Hadir and the Presence are the filled button, only while open; the class after this one is its own row in Nanti hari ini (its sheet reads "DK4073 Komunikasi Pemasaran"), SIX's unread timetable is on the course's page | `screens/home/class-sheet.tsx` |
| Plus Jakarta Sans for headings and numbers | bundled as Android font assets (`plugins/fonts.js`), one family per weight (Android won't pick a weight from one file), OFL in the licences | `assets/fonts` |
| Course ink and tint from the app's course colours | solved per colour so each pair is ≥ 4.6:1 (88 pairs through contrast.py); the mock's green for II4091 isn't one of the app's ten colours, so II4091 is its own colour's tint | `ui/theme.ts` courseTile |
| Course icons | picked from words in the course's name (Ekonomi → chart, Komunikasi → megaphone, Transportasi → train, …), a book otherwise | `ui/tile.tsx` |
| Motion on the UI thread: press 0.965 + expressive spring, rise once, count up once, the wave moves; Reduce Motion fades | as drawn (Reanimated); the count-up writes a read-only field from the UI thread | `ui/press.tsx`, `ui/expressive.tsx` |
| The ask for notifications | a v4 card after Nanti hari ini: the bell on a brand tint, "Ingatkan sebelum kuliah?", Nyalakan, close | `screens/home/first-run.tsx` |

What Beranda leaves out is one tap deeper, on Perlu kamu urus's screen (`needs-screen.tsx`): every item with its swipe and long press, what's put off and away, the date and term, an exam period coming, what changed. Settings is behind the avatar on the other tabs (v4's header has none).

Found on the way: an animation that never ends (the wave) keeps Android's `uiautomator dump` from ever reaching idle, so the lab's word counter reads Maestro's hierarchy instead. And the lab machine's Gradle hung for good while enumerating the machine's volumes (file-system watching); `org.gradle.vfs.watch=false` in a build's Gradle home gets past it (the other builds on this machine likely need it too).
