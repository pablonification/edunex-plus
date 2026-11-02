# Round 2 judge, round 2 (draft PR #285)

- Build: `mobile` at 6bbe4b8, CI run 41429330872, artifact `e2e-results-app` (`judge-light`, `judge-dark`: 37 screens × 2).
- Judge: Claude Opus 5.5 (claude-opus-5-5) in Claude Code (inside T3 Code), 2026-11-02. Screens only, no app code read for scores.
- Bar: next to Gojek, GoPay, Todoist and myBCA (calm, few words, one focal point). Gate: 8/10. Never compared with the desktop or round 1.
- Rules (`mobile/PROGRESS.md`, "Rules from Arqila's verdict"): **R1** text budget, **R2** one title, **R3** look, **R4** joy and
  micro-polish. A fail on any rule keeps the screen under 8. R4 is about motion, so stills can't show it: marked `–` unless
  a still shows a problem.

## Result

- **Light: 14 of 37 at 8 or more. Dark: 16 of 37.** (Dark passes 07 and 11 too: light's 07 opens past the class in progress, light's
  11 loses the status bar.)
- Words on each tab's first screen (`words-*.txt` in the same artifact, light, `mid`): Beranda **53**, Jadwal 40, Tugas 46,
  Kuliah 48, Akademik 42. Beranda is the only tab still over the 40s.

## Scores

| # | Screen | Light | Dark | R1 | R2 | R3 | R4 | Fails | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Beranda | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | 53 words. The attendance problem shows twice: the 73% card and the "Jatah habis"/"Di bawah target" chips on Nanti hari ini | Drop the attendance chips from Nanti hari ini (Perlu kamu urus already says it): about 46 words |
| 02 | Beranda, Hari ini (scrolled) | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 02b | Perlu kamu urus | 5.5 | 5.5 | ✗ | ✓ | ✗ | – | Rows of 3–4 lines; status written as red text; "biasanya 08:00–09:30", "tidak ada di jadwal SIX"; a header of date, term and a UTS sentence; old look (white page, grey boxes, no tiles). The round 2 fix changed Beranda's rows (`needs.tsx`), not this screen (`needs-screen.tsx`) | Rebuild on v4 `Group`/`GroupRow`: title, one meta line, one `Pill`; drop the header |
| 03 | Tugas | 8 | 8 | ✓ | ✓ | ✓ | – | Small: the tab title is in Roboto regular, but Beranda, Jadwal and Kuliah use Plus Jakarta bold | Use the same title face on every tab |
| 04 | Task | 7.5 | 7.5 | ✗ | ✓ | ✗ | – | "Belum dikerjakan" twice (chip and Jawabanmu); 3 lines under the date, one a purple sentence; the disabled Kumpulkan is 1.25:1 and gets a hint line | Drop the hero's chip; put "Boleh terlambat" on the date line; a disabled button whose label you can still read; no hint line |
| 04b | Kumpulkan sheet | 6.5 | 6.5 | ✗ | ✓ | ✗ | – | Two amber warning paragraphs (4 + 2 lines); the second button is cut off at the bottom | One short line per warning; the file-name warning only when the name is wrong; a sheet tall enough for both buttons |
| 06 | Exam | 7 | 7 | ✗ | ✓ | ✗ | – | Four action styles (Buka tugas, Cek pengumuman dosen, outline calendar button, Ke Presensi); a white box inside a tinted card; two dates for one UTS ("Take-home · Edunex menandainya UTS") | One date card; actions as rows in one group, calendar and pengumuman under ⋮ |
| 07 | Jadwal, week | 7.5 | 8.5 | ✓ | ✓ | ✗ light | – | Light opened past now: the class in progress is cut off at the top and the now line isn't on screen (dark is right). Today's circle and the now line use the error red | Always scroll to the now line on open; give today a colour that isn't the error red |
| 08 | Class sheet | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 09 | Jadwal, Masa UTS | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 10 | Jadwal, month | 6.5 | 6.5 | ✗ | ✓ | ✗ | – | Lines that read as sentences under the day ("PL3002 08:00: jadwal berubah", "4 kuliah", clash line); rows of 3–4 lines with chevrons; old look; day cells with 4 dots plus icons | v4 `Group` rows (tile, title, time · room, one pill); one summary line; at most 3 dots per cell |
| 11 | Jadwal ⋮ menu | 7.5 | 8 | ✓ | ✓ | ✗ light | – | Light: status bar icons white on white (1:1) while the menu is open | Dark status bar icons while the menu is open in light |
| 12 | Calendar export done | 7 | 7 | ✗ | ✓ | ✗ | – | The snackbar covers the tab bar (DESIGN: just above it); a 2-line message | Put it above the nav bar; one line ("34 acara masuk Kalender HP") |
| 13 | Kuliah | 8 | 8 | ✓ | ✓ | ✓ | – | Small: "Pilih PL3032" is a button that looks like a status pill | Give the action a button look (tonal button, not a chip) |
| 13b | Akademik | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | KRS row has two statuses (green "KRS sudah disahkan" and the "1 bentrok" chip); title face differs from other tabs | KRS meta "14 SKS", one chip; same title face as the other tabs |
| 14 | Nilai | 8 | 8 | ✓ | ✓ | ✓ | – | none (the 2-line "jika semua A…" meta is the limit) | – |
| 15 | Rencana | 7.5 | 7.5 | ✓ | ✓ | ✗ | – | One card holds 2 figures, a chip, a subtitle, a bar, a 3-item legend and a banner stuck to it | Card: the two figures and the chip only; bar to Kurikulum; "1 hal perlu dicek" as its own row |
| 16 | Kurikulum | 6.5 | 6.5 | ✗ | ✓ | ✓ | – | A 6-line explanation paragraph | One row "3 mata kuliah di luar catatan SIX" → its own screen |
| 17 | KRS | 6.5 | 6.5 | ✗ | ✓ | ✗ | – | Clash is red here but amber everywhere else; sentence "Tanyakan ke dosen…"; the long chip squeezes a title to 4 lines | Amber; chip "Bentrok"; the sentence goes to the clash screen |
| 18 | UKT | 8 | 8 | ✓ | ✓ | ✓ | – | Small: "Di SIX tertulis 24 Agu" next to "Batas bayar 23 Agu" | Keep one date |
| 19 | Kalender akademik | 6.5 | 6.5 | ✗ | ✓ | ✓ | – | Rows carry sentences ("…atau SIX menyembunyikan nilainya.", "Cek kehadiranmu sebelumnya."); "4 hari lagi" and "dalam 4 hari" both | Meta = dates only, sentences in the event's sheet; drop the row's countdown when the card shows it |
| 20 | Course | 7 | 7 | ✗ | ✓ | ✗ | – | Two focal cards; "Tandai Hadir belum muncul" above a Tandai Hadir button; two full-width outline buttons | Drop that line; Tandai Hadir as the one button; Catat di Edunex under ⋮ |
| 21 | Course, Pertemuan | 7 | 7 | ✗ | ✓ | ✓ | – | "Tanpa catatan Edunex" on almost every row; the last row has 3 meta lines | Show only the exception, as a pill; the meta line is the time |
| 22 | Grade calculator | 6.5 | 6.5 | ✗ | ✓ | ✗ | – | A 2-sentence banner with a button, a 2-line headline sentence, pencil and ✕ on every row | One-line banner; the number as the headline ("74 untuk A"); edit and remove in the row's long-press |
| 23 | Cari | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 24 | Status data sheet | 8 | 8 | ✓ | ✓ | ✓ | – | Small: "Diperbarui dalam 4 menit" reads as if it already happened, though it's still to come | "Dicek lagi dalam 4 menit" |
| 25 | Notifikasi | 7.5 | 7.5 | ✗ | ✓ | ✓ | – | Every row's meta wraps to 2 lines | Meta = what changed; the time at the row's end |
| 26 | Pengaturan | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26n | Pengaturan, notifications | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26t | Pengaturan, Tentang | 8 | 8 | ✓ | ✓ | ✓ | – | none | – |
| 26l | Lisensi | 6.5 | 6.5 | ✓ | ✓ | ✗ | – | Old look (white page, hairline boxes); a chevron at the start and ↗ at the end: two targets per row | v4 group; one target per row |
| 32 | Welcome | 7 | 7.5 | ✓ | ✓ | ✗ | – | Light: status bar icons white on white (1:1). Title in Roboto regular, not v4's display face; no brand moment | Dark icons in light; Plus Jakarta title; one picture or motion moment |
| 33 | Beranda while reading | 6.5 | 7 | ✓ | ✓ | ✗ | ✗ | The picture shows the welcome screen with a busy button, not Beranda filling in. Busy label 2.5:1 (light) / 2.6:1 (dark); light status bar 1:1 | A busy button keeps its colours (DESIGN says so); fix the flow so it photographs Beranda while it fills |
| 34 | Semua siap | 7 | 7 | ✓ | ✗ | ✗ | – | "Diperbarui baru saja" under the greeting (only when stale); the Semua siap card (sentence, meta, link, ✕) competes with the now card | Drop the status line; Semua siap as one quiet row or a snackbar with "Lihat ringkasan" |
| 35 | Temuan (Ringkasan awal) | 5.5 | 5.5 | ✗ | ✗ | ✗ | – | A sentence as an in-page heading under the top bar (two titles); rows of 3–5 lines with sentences; old look | v4 rebuild: one title; each finding a `GroupRow` (title, one meta, one pill), details one tap deeper |
| 36 | Beranda without SIX | 8.5 | 8.5 | ✓ | ✓ | ✓ | – | none | – |
| 37 | Jadwal without SIX | 8 | 8 | ✓ | ✓ | ✓ | – | none (the now line sits on the card's top edge) | – |

## Round 1's screens under 8 (gpt-6-luna, 0332fc3)

| # | Screen | Round 1 | Now (light / dark) | Reaches 8? |
| --- | --- | --- | --- | --- |
| 35 | Temuan | 5.5 | 5.5 / 5.5 | No (fix not in this build) |
| 37 | Jadwal without SIX | 5 | 8 / 8 | **Yes** |
| 02b | Perlu kamu urus | 6 | 5.5 / 5.5 | No: the fix reached Beranda's rows, not this screen |
| 33 | Beranda while reading | 6.5 | 6.5 / 7 | No (fix not in this build; the picture is the wrong moment) |
| 04 | Task | 7 | 7.5 / 7.5 | No: status twice, a sentence in the hero |
| 08 | Class sheet | 7 | 8 / 8 | **Yes** |
| 34 | Semua siap | 7 | 7 / 7 | No (fix not in this build) |
| 01 | Beranda | 7.5 (57 words) | 7.5 / 7.5 (53 words) | No: still over the 40s |
| 03 | Tugas | 7.5 (50 words) | 8 / 8 (46 words) | **Yes** |
| 32 | Welcome | 7.5 | 7 / 7.5 | No (fix not in this build; light's status bar is invisible) |

## Contrast

Measured on the full-size pictures (text colour vs its own background, WCAG ratio).

| Pair | Where | Light | Dark |
| --- | --- | --- | --- |
| Busy "Masuk dengan akun ITB" label on its faded button | 33 | **2.54:1** (#d3def5 on #6289da) | **2.57:1** (#274383 on #6d84be) |
| Status bar icons on the page | 11, 32, 33 (light) | **1:1** (white on #ffffff) | ok |
| Disabled "Kumpulkan" (the screen's main action) | 04 | 1.25:1 (#cbdaf8 on #abc4f3) | 1.32:1 (#35486e on #4e5a74) |
| "Di kelas" label, "hari" on the UTS tile | 06, 01 | 5.72:1 | 4.61:1 (#5b9ed1 on #1e3142): just passes |
| "Kumpulkan Jum 15:00–23:59 agar hadir" on the purple card | 04 | 6.17:1 | 4.74:1 (#bb7be5 on #332546): just passes |
| Quiet meta (#5f6673 / #9aa1ae on the card) | everywhere | 5.78:1 | 6.71:1 |
| Chips (amber, red, green) | 01, 08, 13, 13b | 6.15–6.81:1 | 9.03–11.12:1 |

Disabled controls don't have to meet 4.5:1, but a main action you can't read at 1.25:1 is a design problem (see 04). The busy
label is a real fail: it's an active state, and DESIGN says `busy` keeps its colours.
