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
4. **Tandai Hadir done** is said only when the Student went to press it from the app (`checked-in.ts`) and SIX's next
   read no longer shows the button; otherwise the card says SIX's own "no longer shows" line. The demo's pretend SIX
   page counts as pressed (`host.ts`), so the moment can be seen.

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

## Numbers

See the hand-back (and below once measured).
