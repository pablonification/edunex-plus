# Round 2 judge, round 4 (draft PR #285)

- Build: `mobile` at e261d21a, CI run 41455400716, artifact `e2e-results-app` (`judge-light`, `judge-dark`: 37 screens × 2).
- Judge: Claude Opus 5.5 (claude-opus-5-5) in Claude Code (inside T3 Code), 2026-11-02. Scores come from the screens only,
  without reading app code.
- Bar: next to Gojek, GoPay, Todoist and myBCA (calm, few words, one focal point). Gate: 8/10. Never compared with the desktop or round 1.
- Rules (`mobile/PROGRESS.md`, "Rules from Arqila's verdict"): **R1** text budget, **R2** one title, **R3** look, **R4** joy and
  micro-polish. A fail on any rule keeps the screen under 8. R4 is about motion, which still pictures can't show, so it's marked `–`
  unless a still shows a problem.

## Result

- **Light: 34 of 37 at 8 or more. Dark: 35 of 37.** (Pass 3: 28 and 28.)
- Under 8 in both themes: Beranda (01) and the Kumpulkan sheet (04b), both left as they were on purpose. Under 8 in light only:
  the Jadwal ⋮ menu (11), a slip since pass 3: its status bar is blank again.
- Words on each tab's first screen (`words-*.txt`, light, `mid`): Beranda **53**, Jadwal 45, Tugas 46, Kuliah 48, Akademik 41.
  Beranda is still the only tab over the 40s. Keeping the attendance chips is a choice, and the rule still marks it down.
- CI: all four flows pass in this run (`judge-light`, `judge-dark`, `smoke`, `use`). `use` failed in pass 3.
- Across screens, still there: stack screen titles use two typefaces. Perlu kamu urus and Lisensi use Plus Jakarta bold. Nilai,
  Rencana, Kurikulum, KRS, UKT, Kalender, Notifikasi, Pengaturan and the month use Roboto regular. Pick one.
- Across screens, new: cut-off meta lines that say nothing ("Paling tinggi…", "biasanya 0…", "tidak a…", "6 di…"). Where the
  meta can't fit, write a shorter one rather than cut it.

## Scores

| # | Screen | Light | Dark | R1 | R2 | R3 | R4 | Fails | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Unchanged, 53 words. The attendance problem shows twice: the 73% card, then "Jatah habis" / "Di bawah target" chips on Nanti hari ini (left in on purpose) | Drop the chips from Nanti hari ini (about 46 words), or accept 7.5 here |
| 02 | Beranda, Hari ini (scrolled) | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 02b | Perlu kamu urus | 8 | 8 | ✓ | ✓ | ✓ | – | none: no header, v4 rows (tile, title, one meta, one pill), Yang berubah as its own group. Small: 3 of 5 metas cut mid-word ("Paling tinggi…", "biasanya 0…", "tidak a…"). In dark, the "7 hari" pill is page-black on the card, so it reads as a hole | Shorter metas that fit ("Kam 8 Okt 08:00–10:00"); the neutral pill a step lighter than the card in dark |
| 03 | Tugas | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 04 | Task | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 04b | Kumpulkan sheet | 7 | 7 | ✓ | ✓ | ✗ | – | Unchanged: the second button ("Tetap kumpulkan (tidak dihitung hadir)") is still cut off at the bottom of the sheet | Let the sheet fit both buttons above the gesture bar, or scroll |
| 06 | Exam | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the PDF row is a grey box inside a white card | Plain row, no inner box |
| 07 | Jadwal, week | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 08 | Class sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 09 | Jadwal, Masa UTS | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 10 | Jadwal, month | 8 | 8 | ✓ | ✓ | ✓ | – | none: each row is now a title and one meta line (time · room), titles end in "…" | – |
| 11 | Jadwal ⋮ menu | 7.5 | 8 | ✓ | ✓ | ✗ (light) | – | Light: the status bar is blank, white on white (measured 1.00:1, no icons visible) while the menu is open. It was fixed in pass 3. Dark is fine | Keep dark status bar icons while the menu is open in light |
| 12 | Calendar export done | 8 | 8 | ✓ | ✓ | ✓ | – | none: the snackbar now sits just above the tabs | – |
| 13 | Kuliah | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 13b | Akademik | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 14 | Nilai | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 15 | Rencana | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 16 | Kurikulum | 8 | 8 | ✓ | ✓ | ✓ | – | none: the card is the figure and a bar, Wajib and Pilihan are rows. Small: Pilihan's meta is cut ("6 di…") and "+10" next to "27 dari 27 SKS" needs explaining; the Kurikulum 2024 row cuts both lines; Pancasila's meta wraps to 2 lines; the bar's 4 colours have no key | Pilihan: one number ("37 SKS, 10 lebih"); meta for the curriculum row on one line; a short meta for courses taken under another code ("lewat KU2071") |
| 17 | KRS | 8 | 8 | ✓ | ✓ | ✓ | – | none: one status on the card, the clash meta on one line. Small: the card's first line (term · full lecturer name) wraps to 2 lines | Term only; the lecturer a row lower down |
| 18 | UKT | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: "Batas bayar 23 Agu" on the card, "di SIX 24 Agu 2026" in Riwayat | Keep one date |
| 19 | Kalender akademik | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: each row says its date twice (tile and meta) | Meta = the weekday span only |
| 20 | Course | 8 | 8 | ✓ | ✓ | ✓ | – | none: attendance is one line under the title ("85% hadir · Sisa 1×"), the now card is the one card. Small: its first line cuts the room ("R.SG P…") | Drop the time from that line (the wave already shows it) so the room fits |
| 21 | Course, Pertemuan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 22 | Grade calculator | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 23 | Cari | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 24 | Status data sheet | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: "Diperbarui dalam 4 menit" | "Dicek lagi dalam 4 menit" |
| 25 | Notifikasi | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: the meta is cut off mid-word ("biasanya 0…", "tidak ada d…") | Shorter meta that fits |
| 26 | Pengaturan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26n | Pengaturan, notifications | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26t | Pengaturan, Tentang | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26l | Lisensi | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: a 3-line intro | One line ("122 pustaka sumber terbuka") |
| 32 | Welcome | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 33 | Beranda while reading | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 34 | Semua siap | 8 | 8 | ✓ | ✓ | ✓ | – | none: "Diperbarui baru saja" is gone, one quiet row under the now card | – |
| 35 | Temuan (Ringkasan awal) | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the title is a 2-line sentence | – |
| 36 | Beranda without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 37 | Jadwal without SIX | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |

## Pass 3's screens under 8

| # | Screen | Pass 3 (light / dark) | Now (light / dark) | Reaches 8? |
| --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 / 7.5 | 7.5 / 7.5 | No: chips kept on purpose (53 words) |
| 02b | Perlu kamu urus | 6 / 6 | 8 / 8 | **Yes** |
| 04b | Kumpulkan sheet | 7 / 7 | 7 / 7 | No: second button still cut off |
| 10 | Jadwal, month | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 12 | Calendar export done | 7 / 7 | 8 / 8 | **Yes** |
| 16 | Kurikulum | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 17 | KRS | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 20 | Course | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 34 | Semua siap | 7.5 / 7.5 | 8 / 8 | **Yes** |

7 of 9 reach 8. One screen fell under 8: the Jadwal ⋮ menu in light (8 → 7.5), its status bar.

## Contrast

Measured on the full-size pictures (text colour against its own background, WCAG ratio). No text is under 4.5:1. The one fail
is the light status bar on the ⋮ menu.

| Pair | Where | Light | Dark |
| --- | --- | --- | --- |
| Status bar icons with the ⋮ menu open | 11 | **1.00:1** (#ffffff on #ffffff): no icons visible, fails | fine |
| "Di kelas · dalam 7 hari" on the date card | 06 | 5.72:1 (#015f98 on #e3edf4) | **4.61:1** (#5b9ed1 on #1e3142): the weakest, just passes |
| "hari" on the purple Task tile | 03 | 6.17:1 (#8500c2 on #f2e3f8) | **4.74:1** (#bb7be5 on #332546): just passes |
| Quiet meta (rows, month summary, Kurikulum) | 02b, 10, 16 | 5.20–5.78:1 (#5f6673 on #f1f3f7 / #fff) | 6.71–7.43:1 |
| "Di bawah target" pill | 02b | 6.15:1 (#a8201a on #fde7e6) | 9.03:1 (#ffb4ab on #3d1b1a) |
| "7 hari" neutral pill | 02b | 8.56:1 (#3f4652 on #f1f3f7) | 12.10:1 (#c8cdd6 on #0c0e12). Reads, but the pill is page-black on the card |
| "Lihat semua" | 02b | 6.36:1 (#1450c4 on #f1f3f7) | 12.27:1 |
| "73%" on the Kehadiran card | 01 | 6.34:1 (#a8201a on #e3f2f6) | 7.07:1 (#ffb4ab on #143b48) |
| "Sisa 1×" on the course page | 20 | 6.13:1 (#11692f on #f1f3f7) | 12.32:1 |
| "+10" on Pilihan | 16 | 6.81:1 (#11692f on #fff) | 11.12:1 |
| "KRS sudah disahkan" chip | 17 | 5.95:1 (#11692f on #e3f4e8) | 9.10:1 |
| "Lihat ringkasan" on the Semua siap row | 34 | 5.64:1 (#1450c4 on #dbe6ff) | 7.65:1 |
| Snackbar | 12 | 11.72:1 | 11.28:1 |
