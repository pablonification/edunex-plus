# Round 2 judge, round 6

- Build: `mobile-finish` at 526a5c6e, CI run 41648678914, artifact `e2e-results-app` (`judge-light`, `judge-dark`: 37 screens × 2;
  also `use` and `smoke`).
- Judge: Claude Opus 5.5 (claude-opus-5-5) in Claude Code (Claude Agent SDK), 2026-11-04. Scores come from the screens only,
  without reading app code.
- Bar: next to Gojek, GoPay, Todoist and myBCA (calm, few words, one focal point). Gate: 8/10. Never compared with the desktop or round 1.
- Rules (`mobile/PROGRESS.md`, "Rules from Arqila's verdict"): **R1** text budget, **R2** one title, **R3** look, **R4** joy and
  micro-polish. A fail on any rule keeps the screen under 8. R4 is about motion, which still pictures can't show, so it's marked `–`
  unless a still shows a problem.

## Result

- **Light: 34 of 37 at 8 or more. Dark: 34 of 37.** (Pass 5: 34 and 34.) Same count, different screens.
- Under 8 in both themes: Beranda (01) and Semua siap (34), both unchanged (53 words, attendance said twice); Beranda scrolled (02),
  held under 8 this pass because it shows the very same 73% card and chip column that keeps 01 and 34 under 8 (pass 5 let it
  through at 8; corrected here, not a change in the build).
- Back to 8: UKT (18). The bill has one deadline now, the repeated "Batas bayar di SIX" is gone, the neutral pill is no longer a hole.
- Up to 8.5: Jadwal week (07) and Jadwal without SIX (37), the now line no longer strikes through the class title; Akademik (13b),
  labels on one line and IPK/SKS no longer said twice; Rencana (15), both figures share size and baseline.
- Words on each tab's first screen (`words-*.txt`, light, `mid`): Beranda **53**, Jadwal 45, Tugas 46, Kuliah 48, Akademik 39
  (was 41). Beranda is still the only tab over the 40s.
- CI: all four flows produced pictures in this run (`judge-light`, `judge-dark`, `smoke`, `use`).
- Not fixed, though the build's commit says so: the light status bar under a sheet's scrim is still white icons on grey (04b 2.33:1,
  08 2.10:1, the same pixels as pass 5).
- Newly seen: Beranda's attendance card says "Kehadiran 73%" for Teknik Penyelesaian, while that class's sheet (08) says "Kehadiran
  33%". The 73% is the most the student can still reach ("Maks 73%" on 02b), but on Beranda nothing says so.

## Scores

| # | Screen | Light | Dark | R1 | R2 | R3 | R4 | Fails | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Unchanged, 53 words. Attendance is said twice: the 73% card, then "Jatah habis" ×2 and "Di bawah target" on Nanti hari ini. And the card's "Kehadiran 73%" is the best case, which the class sheet contradicts (33%) | Drop the chips from Nanti hari ini; label the card's figure "Maks 73%" as 02b does |
| 02 | Beranda, Hari ini (scrolled) | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | The same card and chip column as 01 and 34 (Teknik Penyelesaian: 73% card and "Di bawah target"; every row of Nanti hari ini carries a warm chip). Pass 5 scored it 8; that didn't match 01 and 34. Small, still there: "Ingatkan sebelum kuliah?" wraps beside its button | Same fix as 01 |
| 02b | Perlu kamu urus | 8 | 8 | ✓ | ✓ | ✓ | – | none: no meta is cut now, and in dark the "7 hari" pill is a step lighter than the card (#2a2f39 on #171a20). Small: two titles now wrap to 2 lines; dates written two ways ("Kam, 15 Okt, 11:00" and "Kam, 8 Okt 08:00–10:00") | One date format |
| 03 | Tugas | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 04 | Task | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: in dark the disabled Kumpulkan is page-black (#0c0e12) on the bottom bar (#171a20), so it reads as a hole; in light the scroll bar shows on the right edge | Disabled button a step lighter than the bar |
| 04b | Kumpulkan sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none: the title is now the heading face. Small, still there: in light the status bar icons are white on the grey scrim (2.33:1) | Dark status bar icons while a sheet is open in light |
| 06 | Exam | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the PDF row is a grey box inside a white card; "Kehadiran sebelum ujian" wraps beside its chip. Newly seen: "UTS Markom · Take-home · Kam 22 Okt" sits right under the 15 Okt date card without saying how the two dates relate | Plain row, no inner box; say "Tugas take-home" on that row |
| 07 | Jadwal, week | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none: the now line passes behind the class block, the title reads clean. Small: the block's darker "elapsed" band ends right at the title's cap height | – |
| 08 | Class sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: in light the status bar icons are white on the grey scrim (2.10:1). Newly seen: four red bars beside "Kehadiran 33%" with no key | As 04b |
| 09 | Jadwal, Masa UTS | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 10 | Jadwal, month | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: 3 of the day's 4 titles end in "…"; in dark the Masa UTS week is a loud solid purple band | – |
| 11 | Jadwal ⋮ menu | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: both menu labels wrap to 2 lines and the second sub-line wraps too; in dark the menu (#212125) barely lifts off the page (#171a20, 1.09:1) | Shorter labels ("Ingatkan kuliah", "Kalender HP"); a lighter menu surface in dark |
| 12 | Calendar export done | 8 | 8 | ✓ | ✓ | ✓ | – | none: the now line no longer crosses the title. Small, still there: the snackbar covers Ekonomi Infrastruktur's room line | – |
| 13 | Kuliah | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the top card breaks "80%" onto its own line; three actions in the top bar (⋮, search, avatar); in light that one card has a shadow and no other does | "1 mata kuliah tak capai 80%" on one line |
| 13b | Akademik | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none: "IPK" and "SKS lulus" sit on one line; the rows now say new things (IP terakhir 3,27, 19 SKS lagi), not the card's figures again | – |
| 14 | Nilai | 8 | 8 | ✓ | ✓ | ✓ | – | none: labels on one line now. Small, still there: "IPK tertinggi yang mungkin" has a 2-line meta; the chart's axis starts at 2,00, so every point sits in the top third; "3,30 saat lulus" twice (pill and chart). In dark the target icon tile is page-black on the card | Axis from 3,00; meta "jika semua A" |
| 15 | Rencana | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none: "8" and "3,30" share size and baseline. Small, still there: "1 hal perlu dicek" and "Semester 1–6" are two separate cards; in dark Semester 1–6's icon tile is page-black | One card with two rows |
| 16 | Kurikulum | 8 | 8 | ✓ | ✓ | ✓ | – | none: the Kurikulum 2024 row now wraps instead of cutting. Small, still there: "+10" unexplained; the bar's colours have no key; Pancasila's meta wraps | As pass 4 |
| 17 | KRS | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the card's first line (term · full lecturer name) wraps to 2 lines | Term only; the lecturer a row lower down |
| 18 | UKT | 8 | 8 | ✓ | ✓ | ✓ | – | none: one deadline per bill, the card says "Lunas" big and green, one caption ("Tanggal: batas bayar di SIX") instead of the label on every row, Semester depan fits, "Belum ditagih" is a step lighter than the card in dark. Small: this term's bill shows twice (card, then the first Riwayat row); in dark the wallet tile is page-black | Start Riwayat at the term before |
| 19 | Kalender akademik | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: each row says its date twice (tile and meta); UTS's dates appear 3 times on the first screen | Meta = the weekday span only |
| 20 | Course | 8 | 8 | ✓ | ✓ | ✓ | – | none: the now card's first line fits ("Sekarang · R.SG PWK LT.6"), "Tidak wajib" is no longer a hole in dark. Small: "Tidak wajib" beside a big Tandai Hadir sends two messages; in dark the module number tiles (1, 3, 5) are page-black | – |
| 21 | Course, Pertemuan | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: only the first of six past meetings says "Hadir"; the rest say nothing | – |
| 22 | Grade calculator | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: each "%" sits high beside its field | – |
| 23 | Cari | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 24 | Status data sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none: the title is now the heading face. Small: "Terhubung" on all three rows | Show the state only when it isn't "Terhubung" |
| 25 | Notifikasi | 8 | 8 | ✓ | ✓ | ✓ | – | none: no meta is cut now. Small: two titles wrap to 2 lines; the same "Jadwal berubah" item is orange on 02b and purple here; in dark the Atur notifikasi tile is page-black | One colour per kind of item |
| 26 | Pengaturan | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the profile meta wraps to 2 lines | – |
| 26n | Pengaturan, notifications | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: "Coba notifikasi" has no icon or chevron | – |
| 26t | Pengaturan, Tentang | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: in dark the Versi, Laporkan masalah and Lisensi tiles are page-black on the card | – |
| 26l | Lisensi | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: a 3-line intro | One line ("122 pustaka sumber terbuka") |
| 32 | Welcome | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none. Small: the language button sits closer to the right edge than the content's margin | – |
| 33 | Beranda while reading | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 34 | Semua siap | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Unchanged: the same attendance double-up as 01, with the Semua siap row on top, so more words than 01 | Same fix as 01 |
| 35 | Temuan (Ringkasan awal) | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the title is a 2-line sentence; 2 of 3 rows wrap | – |
| 36 | Beranda without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 37 | Jadwal without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none: the now line no longer crosses the title | – |

## Pass 5's screens under 8

| # | Screen | Pass 5 (light / dark) | Now (light / dark) | Reaches 8? |
| --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 / 7.5 | 7.5 / 7.5 | No: chips kept (53 words) |
| 18 | UKT | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 34 | Semua siap | 7.5 / 7.5 | 7.5 / 7.5 | No: same as 01 |

1 of 3 reaches 8. Fell under 8 this pass: Beranda scrolled (02, 8 → 7.5), matched to 01 and 34; the screen itself didn't change.
Up from 8 to 8.5: Jadwal week (07), Akademik (13b), Rencana (15), Jadwal without SIX (37).

## Across screens

Ranked by how much they'd bother a student.

1. **Two answers to one question.** Beranda's card says "Kehadiran 73%" for Teknik Penyelesaian; the class sheet says "Kehadiran 33%"
   (73% is the most still reachable, said only on 02b). The same status also goes by four names: "Di bawah target" (01, 02b), "Lewat
   batas 1×" (13), "tak bisa lagi capai 80%" (13), "33% · target 80%" (08); and "Jatah habis" / "Habis" / "Jatah absen habis"
   (01, 13, 06). UKT's two deadlines, the worst of these in pass 5, are fixed.
2. **Beranda still says attendance twice** (01, 02, 34): the 73% card plus a warm chip on every class row. It is the one tab over the
   40s (53 words) and the reason three screens sit under 8.
3. **Light status bar under a sheet's scrim**: white icons on grey, 2.33:1 (04b) and 2.10:1 (08), under 3:1 for icons. Unchanged
   from pass 5, though the commit for this build lists it as fixed.
4. **Page-black tiles in dark.** The neutral pills are fixed (#2a2f39 on the #171a20 card), but neutral icon tiles and the disabled
   button still use the page colour (#0c0e12) on the card, 1.11:1, so they read as holes: 14, 15, 18, 20 (module numbers), 25, 26t,
   and the disabled Kumpulkan on 04.
5. **Lines that wrap where one would do**: 11 (both menu labels), 13 ("80%" alone), 14 (meta), 17 (lecturer), 02b and 25 (titles).
   Nothing is cut mid-word in the judge set any more; ellipses remain only on the month list's titles (10) and collapsed top bars.
6. **Dates written several ways**: "Kam, 15 Okt, 11:00", "Kam 8 Okt 16:00–16:30", "Kam, 8 Okt 08:00–10:00", "4 Des · Jum".
7. **Colour per item kind isn't steady**: the same "Jadwal berubah" item is orange on 02b and purple on 25; the Kuliah badge "1"
   shows on 33, 36 and 37 but not on 01 or 34.
8. Outside the judge set (`use`): the English row now reads "How far ahead to look" (`use-26-english-dark`), fixed. The handled
   Task (`use-03-handled`) is down to one line ("Kamu kumpulkan dengan cara lain · Urungkan"), but the card above it still says
   "Belum dikerjakan" and Kumpulkan is still offered, so the screen says both done and not done.

## Contrast

Measured on the full-size pictures (text colour against its own background, WCAG ratio). No text is under 4.5:1.

| Pair | Where | Light | Dark |
| --- | --- | --- | --- |
| Status bar icons under a sheet's scrim | 04b, 08 | **2.33:1 / 2.10:1** (#ffffff on #a8aaad / #b3b3b3): unchanged | fine |
| Status bar icons over the scrimmed blue header | 24 | 8.85:1 (#ffffff on #16459d) | fine |
| "Di kelas · dalam 7 hari" on the date card | 06 | – | **4.61:1** (#5b9ed1 on #1e3142): the weakest, just passes |
| "hari" on the purple Task tile | 03 | – | **4.74:1** (#bb7be5 on #332546): just passes |
| Quiet meta and Lisensi intro | 26l | 5.20:1 (#5f6673 on #f1f3f7) | – |
| "Lewat batas 1×" pill | 13 | 6.15:1 (#a8201a on #fde7e6) | – |
| "Sekarang" time label | 07 | 5.36:1 (#1f63e0 on #ffffff) | – |
| Neutral pill ("7 hari", "Belum ditagih", "Tidak wajib") | 02b, 18, 20 | – | text 8.41:1 (#c8cdd6 on #2a2f39); pill on card 1.30:1: fixed, no longer a hole |
| Neutral icon tile, disabled button on card | 04, 14, 15, 18, 20, 25, 26t | – | 1.11:1 (#0c0e12 on #171a20): reads as a hole |
| ⋮ menu on the page | 11 | 1.12:1 (#ffffff on #f0f2f7), with a shadow | 1.09:1 (#212125 on #171a20), no visible edge |
| Welcome footnote | 32 | 7.29:1 (#55565e on #ffffff) | – |

## What changed since pass 5

- UKT (18): one deadline per bill, a big "Lunas", one caption for the Riwayat dates, the neutral pill fixed in dark. 7.5 → 8.
- The now line (07, 12, 37) runs behind the class block; the current class's title no longer reads as struck through. 07 and 37
  8 → 8.5.
- Sheet titles (04b, 24) are now in the heading face, like every screen title.
- Big-number cards line up: labels on one line (13b, 14), figures on one baseline (15). 13b and 15 8 → 8.5.
- Akademik no longer repeats IPK and SKS in its rows (IP terakhir, SKS left instead); 39 words (was 41).
- No meta cut mid-word in the judge set: 02b, 16, 20 and 25 now fit or wrap.
- Neutral pills in dark are a step lighter than the card (02b, 18, 20).
- Not changed: Beranda (01, 34, 53 words), the light status bar under sheet scrims (04b, 08).
- Judged stricter this pass: Beranda scrolled (02) held under 8 to match 01 and 34. No screen got worse in the build.
