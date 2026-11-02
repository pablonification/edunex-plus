# Round 2 judge, round 3 (draft PR #285)

- Build: `mobile` at a2297b16, CI run 41446320792, artifact `e2e-results-app` (`judge-light`, `judge-dark`: 37 screens × 2).
- Judge: Claude Opus 5.5 (claude-opus-5-5) in Claude Code (inside T3 Code), 2026-11-02. Scores come from the screens only,
  without reading app code.
- Bar: next to Gojek, GoPay, Todoist and myBCA (calm, few words, one focal point). Gate: 8/10. Never compared with the desktop or round 1.
- Rules (`mobile/PROGRESS.md`, "Rules from Arqila's verdict"): **R1** text budget, **R2** one title, **R3** look, **R4** joy and
  micro-polish. A fail on any rule keeps the screen under 8. R4 is about motion, which still pictures can't show, so it's marked `–`
  unless a still shows a problem.

## Result

- **Light: 28 of 37 at 8 or more. Dark: 28 of 37.** (Round 2: 14 and 16.) The same 9 screens are under 8 in both themes.
- Words on each tab's first screen (`words-*.txt`, light, `mid`): Beranda **53**, Jadwal 45, Tugas 46, Kuliah 48, Akademik 41.
  Beranda is still the only tab over the 40s; its fix (drop the chips from Nanti hari ini) is not in this build.
- CI: flow `use` fails in this run (`Assertion is false: "Drafmu aman.*" is visible`). a2297b16 removed the hand-in's old
  warning words, and the flow still looks for them.
- Across screens: stack screen titles use two typefaces. Perlu kamu urus and Lisensi use Plus Jakarta bold. Nilai, Rencana,
  Kurikulum, KRS, UKT, Kalender, Notifikasi, Pengaturan and the month use Roboto regular. Pick one.

## Scores

| # | Screen | Light | Dark | R1 | R2 | R3 | R4 | Fails | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Still 53 words. The attendance problem shows twice: the 73% card, then "Jatah habis" / "Di bawah target" chips on Nanti hari ini | Drop the attendance chips from Nanti hari ini (Perlu kamu urus already says it), which brings it to about 46 words |
| 02 | Beranda, Hari ini (scrolled) | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 02b | Perlu kamu urus | 6 | 6 | ✗ | ✓ | ✗ | – | Statuses are pills now, but the rest is unchanged: a header with date, term and a UTS sentence; rows of 3 lines ("target 80%", "biasanya 08:00–09:30", "tidak ada di jadwal SIX"); "dalam 7 hari" as text next to a row; no tiles in the first group. The v4 rebuild (4991fea2) does not show on `/needs` | Make `/needs` draw the v4 rows: tile, title, one meta line, one pill. Drop the header |
| 03 | Tugas | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none (title face now matches the other tabs) | – |
| 04 | Task | 8 | 8 | ✓ | ✓ | ✓ | – | none. One status, "Boleh terlambat" on the date line, the disabled Kumpulkan reads (5.20:1 / 7.43:1) | – |
| 04b | Kumpulkan sheet | 7 | 7 | ✓ | ✓ | ✗ | – | Warnings are one line each now, but the second button ("Tetap kumpulkan") is still cut off at the bottom of the sheet | Make the sheet fit both buttons above the gesture bar (or let it scroll); update `use.yaml` for the new words |
| 06 | Exam | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the PDF row is a grey box inside a white card | Plain row, no inner box |
| 07 | Jadwal, week | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none. Opens on the now line, today in blue | – |
| 08 | Class sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 09 | Jadwal, Masa UTS | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 10 | Jadwal, month | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | One summary line and ≤3 dots are fixed, but 3 of 4 rows are still 4 lines: the title wraps, and "PL3002 08:00–10:00 · R.SG PWK LT.6" wraps too | Meta = time · room only (the tile and title already name the course), cut to one line |
| 11 | Jadwal ⋮ menu | 8 | 8 | ✓ | ✓ | ✓ | – | none (light status bar icons are dark now) | – |
| 12 | Calendar export done | 7 | 7 | ✓ | ✓ | ✗ | – | One line now, but the snackbar still sits on the tab bar: the icons stick out above it | Lift it by the tab bar's height so it sits just above the tabs |
| 13 | Kuliah | 8 | 8 | ✓ | ✓ | ✓ | – | none ("Pilih PL3032" is a tonal button now) | – |
| 13b | Akademik | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 14 | Nilai | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 15 | Rencana | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 16 | Kurikulum | 7.5 | 7.5 | ✗ | ✓ | ✗ | – | The paragraph is gone (good), but the top card holds about 10 lines: the program name, the figure, a bar, a 3-item legend, then Wajib and Pilihan blocks. "Sisa saja" repeats the same numbers | Card = figure + bar only; Wajib and Pilihan as two rows in a group; "Sisa saja" without the meta line |
| 17 | KRS | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Amber and the "Bentrok" chip are fixed. The top card has two statuses ("KRS sudah disahkan" + "1 bentrok"), and the clash row right under it says the same; its meta wraps to 2 lines | Drop "1 bentrok" from the card; clash meta "Kam 8 Okt 16:00–16:30" on one line |
| 18 | UKT | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: "Batas bayar 23 Agu" on the card, "di SIX 24 Agu 2026" in Riwayat | Keep one date |
| 19 | Kalender akademik | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: each row says its date twice (tile and meta) | Meta = the weekday span only |
| 20 | Course | 7.5 | 7.5 | ✓ | ✓ | ✗ | – | The extra line and buttons are gone, but two raised cards still compete. The 85% card uses a divider and a whole row for one "Sisa 1×" chip; the now card's meta wraps to 2 lines | Put attendance on one line under the title ("85% hadir · Sisa 1×"), and keep the now card as the one card |
| 21 | Course, Pertemuan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 22 | Grade calculator | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 23 | Cari | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 24 | Status data sheet | 8 | 8 | ✓ | ✓ | ✓ | – | Small, still there: "Diperbarui dalam 4 menit" | "Dicek lagi dalam 4 menit" |
| 25 | Notifikasi | 8 | 8 | ✓ | ✓ | ✓ | – | none. Small: the meta is cut off mid-word ("biasanya 0…", "tidak ada d…") | Shorter meta that fits |
| 26 | Pengaturan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26n | Pengaturan, notifications | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26t | Pengaturan, Tentang | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26l | Lisensi | 8 | 8 | ✓ | ✓ | ✓ | – | none. v4 group, one target per row. Small: a 3-line intro | One line ("122 pustaka sumber terbuka") |
| 32 | Welcome | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none: dark status bar icons in light, Plus Jakarta title, the brand card | – |
| 33 | Beranda while reading | 8 | 8 | ✓ | ✓ | ✓ | – | none: now shows Beranda filling (skeletons, "Membaca SIX · Kehadiran…") | – |
| 34 | Semua siap | 7.5 | 7.5 | ✓ | ✗ | ✓ | – | The card is now one quiet row (good), but "Diperbarui baru saja" is still under the greeting | Show that line only when data is stale or offline |
| 35 | Temuan (Ringkasan awal) | 8 | 8 | ✓ | ✓ | ✓ | – | none: one title, one-line rows, Lihat semua. Small: the title is a 2-line sentence | – |
| 36 | Beranda without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 37 | Jadwal without SIX | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |

## Round 2's screens under 8

| # | Screen | Round 2 (light / dark) | Now (light / dark) | Reaches 8? |
| --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 / 7.5 | 7.5 / 7.5 | No: fix not in this build (53 words) |
| 02b | Perlu kamu urus | 5.5 / 5.5 | 6 / 6 | No: only the pills changed |
| 04 | Task | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 04b | Kumpulkan sheet | 6.5 / 6.5 | 7 / 7 | No: second button still cut off |
| 06 | Exam | 7 / 7 | 8 / 8 | **Yes** |
| 07 | Jadwal, week | 7.5 / 8.5 | 8.5 / 8.5 | **Yes** |
| 10 | Jadwal, month | 6.5 / 6.5 | 7.5 / 7.5 | No: rows still 4 lines |
| 11 | Jadwal ⋮ menu | 7.5 / 8 | 8 / 8 | **Yes** |
| 12 | Calendar export done | 7 / 7 | 7 / 7 | No: still on the tab bar |
| 13b | Akademik | 7.5 / 7.5 | 8.5 / 8.5 | **Yes** |
| 15 | Rencana | 7.5 / 7.5 | 8.5 / 8.5 | **Yes** |
| 16 | Kurikulum | 6.5 / 6.5 | 7.5 / 7.5 | No: the card is crowded and repeats itself |
| 17 | KRS | 6.5 / 6.5 | 7.5 / 7.5 | No: two statuses on the card |
| 19 | Kalender akademik | 6.5 / 6.5 | 8 / 8 | **Yes** |
| 20 | Course | 7 / 7 | 7.5 / 7.5 | No: two cards compete |
| 21 | Course, Pertemuan | 7 / 7 | 8 / 8 | **Yes** |
| 22 | Grade calculator | 6.5 / 6.5 | 8 / 8 | **Yes** |
| 25 | Notifikasi | 7.5 / 7.5 | 8 / 8 | **Yes** |
| 26l | Lisensi | 6.5 / 6.5 | 8 / 8 | **Yes** |
| 32 | Welcome | 7 / 7.5 | 8.5 / 8.5 | **Yes** |
| 33 | Beranda while reading | 6.5 / 7 | 8 / 8 | **Yes** |
| 34 | Semua siap | 7 / 7 | 7.5 / 7.5 | No: "Diperbarui baru saja" still shows |
| 35 | Temuan | 5.5 / 5.5 | 8 / 8 | **Yes** |

14 of 23 reach 8.

## Contrast

Measured on the full-size pictures (text colour against its own background, WCAG ratio). Nothing in this build is under 4.5:1.
Round 2's fails are fixed: the light status bar is no longer white on white, and the disabled Kumpulkan reads.

| Pair | Where | Light | Dark |
| --- | --- | --- | --- |
| "Di kelas · dalam 7 hari" on the date card | 06 | 5.72:1 (#015f98 on #e3edf4) | **4.61:1** (#5b9ed1 on #1e3142): the weakest, just passes |
| "hari" on the purple Task tile | 03 | 6.17:1 (#8500c2 on #f2e3f8) | **4.74:1** (#bb7be5 on #332546): just passes |
| Disabled "Kumpulkan" | 04 | 5.20:1 (#5f6673 on #f1f3f7) | 7.43:1 (#9aa1ae on #0c0e12). Dark: the disabled button is page-black on the grey bar, so it looks like a hole |
| Quiet meta, footers | 25, 26t | 5.20–5.78:1 | 6.71–7.43:1 |
| "Kehadiran" chip, 73% | 01 | 5.41:1, 6.34:1 | 7.98:1, 7.07:1 |
| "Lihat ringkasan" on the Semua siap row | 34 | 5.64:1 (#1450c4 on #dbe6ff) | 7.65:1 |
| Amber chips and banners (Bentrok, Habis, example weights) | 08, 10, 13, 22 | 6.80:1 | 9.57:1 |
| Red chip (Lewat batas) | 13 | 6.15:1 | 9.03:1 |
| Hand-in warning lines | 04b | 6.24:1 | 10.70:1 |
| Snackbar | 12 | 11.72:1 | 11.28:1 |
