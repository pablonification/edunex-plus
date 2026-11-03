# Round 2 judge, round 5

- Build: `mobile` at 9ef30e7f, CI run 41623239550, artifact `e2e-results-app` (`judge-light`, `judge-dark`: 37 screens × 2; also
  `use` and `smoke`).
- Judge: Claude Opus 5.5 (claude-opus-5-5) in Claude Code (Claude Agent SDK), 2026-11-03. Scores come from the screens only,
  without reading app code.
- Bar: next to Gojek, GoPay, Todoist and myBCA (calm, few words, one focal point). Gate: 8/10. Never compared with the desktop or round 1.
- Rules (`mobile/PROGRESS.md`, "Rules from Arqila's verdict"): **R1** text budget, **R2** one title, **R3** look, **R4** joy and
  micro-polish. A fail on any rule keeps the screen under 8. R4 is about motion, which still pictures can't show, so it's marked `–`
  unless a still shows a problem.

## Result

- **Light: 34 of 37 at 8 or more. Dark: 34 of 37.** (Pass 4: 34 and 35.)
- Under 8 in both themes: Beranda (01), unchanged; UKT (18), held under 8 this pass because it gives the same bill two different
  deadlines (third pass running); Semua siap (34), which shows the same attendance double-up as 01 (pass 4 let it through at 8
  while failing 01 for the same thing; corrected here).
- Back to 8: the Kumpulkan sheet (04b, both buttons now fit) and the Jadwal ⋮ menu in light (11, status bar icons are back).
- Words on each tab's first screen (`words-*.txt`, light, `mid`): Beranda **53**, Jadwal 45, Tugas 46, Kuliah 48, Akademik 41.
  Same as pass 4. Beranda is still the only tab over the 40s.
- CI: all four flows pass in this run (`judge-light`, `judge-dark`, `smoke`, `use`).
- Fixed across screens: every stack screen title is now in the same heading face (Plus Jakarta bold). Sheet titles are not
  ("Kumpulkan tugas ini?", "Status data" are still Roboto regular).
- Half fixed across screens: meta lines that stop mid-word. Pilihan on Kurikulum and three rows on Perlu kamu urus now fit; five
  still cut (02b ×2, 16, 20, 25).

## Scores

| # | Screen | Light | Dark | R1 | R2 | R3 | R4 | Fails | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Unchanged, 53 words. Attendance is said twice: the 73% card, then "Jatah habis" ×2 and "Di bawah target" on Nanti hari ini | Drop the chips from Nanti hari ini (about 46 words), or accept 7.5 here |
| 02 | Beranda, Hari ini (scrolled) | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: "Ingatkan sebelum kuliah?" wraps to 2 lines next to its button | – |
| 02b | Perlu kamu urus | 8 | 8 | ✓ | ✓ | ✓ | – | none: the title is now the heading face, "Maks 73%" fits. Small: 2 metas still cut ("Kam, 15 Okt, 11:00–12:…", "Link Teams Pertemuan 03: Jum…"); in dark the "7 hari" pill is page-black (#0c0e12) on the card, so it reads as a hole | Drop the end time ("Kam 15 Okt 11:00"); the neutral pill a step lighter than the card in dark |
| 03 | Tugas | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 04 | Task | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 04b | Kumpulkan sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none: both buttons now sit in full above the gesture bar. Small: the title is Roboto regular, not the heading face; in light the status bar icons are white on the grey scrim (2.33:1) | Sheet titles in the heading face |
| 06 | Exam | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the PDF row is a grey box inside a white card; "Kehadiran sebelum ujian" wraps to 2 lines beside its chip | Plain row, no inner box |
| 07 | Jadwal, week | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, newly seen: the now line (08:12) runs through the top of the current class's title, "Ekonomi dan Inovasi" reads as struck through (also on 11, 12, 37) | Draw the now line under the block's text, or nudge the text below it |
| 08 | Class sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: in light the status bar icons are white on the grey scrim (2.10:1) | – |
| 09 | Jadwal, Masa UTS | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 10 | Jadwal, month | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 11 | Jadwal ⋮ menu | 8 | 8 | ✓ | ✓ | ✓ | – | none: the light status bar has dark icons again (5.74:1). Small: every menu label wraps to 2 lines ("Ingatkan sebelum / kuliah", "Tampilkan di / Kalender HP") and the second sub-line wraps too | A wider menu, or shorter labels ("Ingatkan kuliah", "Kalender HP") |
| 12 | Calendar export done | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the snackbar covers Ekonomi Infrastruktur's room line; the now line crosses the first title (as 07) | – |
| 13 | Kuliah | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the top card breaks "80%" onto its own line; three actions in the top bar (⋮, search, avatar) | "1 mata kuliah tak capai 80%" on one line |
| 13b | Akademik | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: "IPK" and "SKS lulus" labels sit at different heights (stair-step); IPK 3,26 and 125 dari 144 each appear twice on the first screen (card and the Nilai / Kurikulum rows) | Labels on one line above both figures |
| 14 | Nilai | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: same stair-step labels as 13b; "IPK tertinggi yang mungkin" has a 2-line meta; the chart's axis starts at 2,00, so every point sits in the top third | Axis from 3,00; meta "jika semua A" |
| 15 | Rencana | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: "8" and "3,30" don't share a baseline (the 8 is bigger and lower); "1 hal perlu dicek" and "Semester 1–6" are two separate cards | Same size and baseline for both figures; one card with two rows |
| 16 | Kurikulum | 8 | 8 | ✓ | ✓ | ✓ | – | none: Pilihan's meta fits now. Small, still there: "+10" unexplained; the Kurikulum 2024 row cuts both lines; Pancasila's meta wraps; the bar's 4 colours have no key | As pass 4 |
| 17 | KRS | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the card's first line (term · full lecturer name) wraps to 2 lines | Term only; the lecturer a row lower down |
| 18 | UKT | 7.5 | 7.5 | ✓ | ✓ | ✓ | – | The same bill has two deadlines: "Batas bayar 23 Agu" on the card, "Batas bayar di SIX 24 Agu 2026" for 2026/2027 Ganjil in Riwayat (third pass running). Also: "Batas bayar di SIX" repeated on all 7 rows; Semester depan's meta wraps to 2 lines; in dark "Belum ditagih" is page-black on the card | One date, the same in both places; Riwayat meta = the date only |
| 19 | Kalender akademik | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: each row says its date twice (tile and meta); UTS's dates appear 3 times on the first screen | Meta = the weekday span only |
| 20 | Course | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small, still there: the now card's first line cuts the room ("R.SG P…"); in dark "Tidak wajib" is page-black on the card | Drop the time from that line so the room fits |
| 21 | Course, Pertemuan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 22 | Grade calculator | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: each "%" sits high beside its field instead of centred | – |
| 23 | Cari | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 24 | Status data sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none (this run shows "Memperbarui…", so pass 4's "Diperbarui dalam 4 menit" can't be checked). Small: the title is Roboto regular | Sheet titles in the heading face |
| 25 | Notifikasi | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: a meta cut off ("Link Teams Pertemuan 03: Jumat, 9 …"); the first title wraps to 2 lines | Shorter meta that fits |
| 26 | Pengaturan | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the profile meta wraps to 2 lines | – |
| 26n | Pengaturan, notifications | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: "Coba notifikasi" has no icon or chevron, so it reads as a label rather than something to tap | – |
| 26t | Pengaturan, Tentang | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26l | Lisensi | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: a 3-line intro | One line ("122 pustaka sumber terbuka") |
| 32 | Welcome | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 33 | Beranda while reading | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 34 | Semua siap | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | The same attendance double-up as 01 (73% card plus "Jatah habis" / "Di bawah target" chips), with one more row (Semua siap) on top, so more words than 01. Pass 4 scored it 8; that didn't match 01 | Same fix as 01 |
| 35 | Temuan (Ringkasan awal) | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the title is a 2-line sentence; 2 of 3 rows wrap | – |
| 36 | Beranda without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 37 | Jadwal without SIX | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the now line crosses the class title (as 07) | – |

## Pass 4's screens under 8

| # | Screen | Pass 4 (light / dark) | Now (light / dark) | Reaches 8? |
| --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 / 7.5 | 7.5 / 7.5 | No: chips kept (53 words) |
| 04b | Kumpulkan sheet | 7 / 7 | 8 / 8 | **Yes** |
| 11 | Jadwal ⋮ menu | 7.5 / 8 | 8 / 8 | **Yes** |

2 of 3 reach 8. Fell under 8 this pass: UKT (18, 8 → 7.5, the two deadlines) and Semua siap (34, 8 → 7.5, matched to 01).
Lowered but still at the gate: Jadwal week (07), Akademik (13b) and Rencana (15), 8.5 → 8.

## Across screens

Ranked by how much they'd bother a student.

1. **Two answers to one question.** UKT gives the same bill two deadlines (23 Agu, 24 Agu 2026). Beranda (01, 34) says the same
   attendance problem twice. Akademik says IPK and SKS twice. The first is the worst: a student can't tell which date to trust.
2. **Meta lines still cut mid-word** (02b ×2, 16, 20, 25). Better than pass 4, not gone. The cut part is usually the bit that
   matters (the end time, the room, the date).
3. **The now line runs through the current class's title** on Jadwal (07, 11, 12, 37). The one class the student is looking for
   reads as struck through.
4. **Neutral pills in dark are page-black on the card** (02b "7 hari", 18 "Belum ditagih", 20 "Tidak wajib"): text reads
   (12.10:1) but the pill looks like a hole.
5. **Big-number cards don't line up**: labels at different heights on 13b and 14, figures on different baselines on 15.
6. **Sheet titles use a different face** from every screen title (04b, 24: Roboto regular).
7. **Light status bar under a sheet's scrim**: white icons on grey, 2.10–2.33:1 (04b, 08), under 3:1 for icons.
8. Outside the judge set (`use`): the English settings row reads "How far ahead Needs you looks" (`use-26-english-dark`);
   the Task's answer card under Kumpulkan carries three explanatory lines ("Wajib diisi, meski…", "Dosen bisa melihat draf…",
   "Kamu kumpulkan dengan cara lain…") (`use-03-handled`).

## Contrast

Measured on the full-size pictures (text colour against its own background, WCAG ratio). No text is under 4.5:1.

| Pair | Where | Light | Dark |
| --- | --- | --- | --- |
| Status bar icons with the ⋮ menu open | 11 | 5.74:1 (#666666 on #ffffff): fixed | fine |
| Status bar icons under a sheet's scrim | 04b, 08 | **2.33:1 / 2.10:1** (#ffffff on #a8aaad / #b3b3b3) | fine |
| "Di kelas · dalam 7 hari" on the date card | 06 | 5.72:1 | **4.61:1** (#5b9ed1 on #1e3142): the weakest, just passes |
| "hari" on the purple Task tile | 03 | 6.17:1 | **4.74:1** (#bb7be5 on #332546): just passes |
| Quiet meta and Lisensi intro | 26l | 5.20:1 (#5f6673 on #f1f3f7) | – |
| Warnings in the Kumpulkan sheet | 04b | 6.24:1 (#855000 on #f6f7fb) | 10.70:1 |
| "Lewat batas 1×" pill | 13 | 6.15:1 (#a8201a on #fde7e6) | – |
| "Sekarang" time label | 07 | 5.36:1 (#1f63e0 on #ffffff) | – |
| Neutral pill ("7 hari", "Belum ditagih", "Tidak wajib") | 02b, 18, 20 | – | 12.10:1 (#c8cdd6 on #0c0e12). Reads, but the pill is page-black on the card |
| Welcome footnote | 32 | 7.29:1 | – |

## What changed since pass 4

- Kumpulkan sheet (04b): both buttons show in full. 7 → 8.
- Jadwal ⋮ menu (11): dark status bar icons in light again. 7.5 → 8 in light.
- One heading face for stack screen titles (Perlu kamu urus, Nilai, Rencana, Kurikulum, KRS, UKT, Kalender, Notifikasi,
  Pengaturan, the month, Lisensi). Sheets not yet.
- Shorter metas: Pilihan (16) and three rows on Perlu kamu urus (02b) now fit. Five cuts remain.
- Word counts unchanged (53, 45, 46, 48, 41).
- Judged stricter this pass: UKT's two dates (18) and Semua siap's double-up (34) now hold those screens under 8; the struck-through
  class title (07) and the stair-step figures (13b, 15) take three 8.5s down to 8.
