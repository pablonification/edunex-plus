# Round 4 board: laid out like the apps students use daily

An emulator on the developer's Mac (Apple M1): Android 16 (API 36, AOSP arm64), 1080 × 2400 at 420 dpi, 4 GB, 4 cores,
font size 1.1, 3-button navigation, Indonesian. The demo's made-up data, release JavaScript (Hermes). Numbers only:
never real data.

How each number is taken:

- **Hill 1** (the layout): `maestro hierarchy` on Beranda's first screen, read by `mobile/qa/r4-hill1.mjs` (the tabs
  in order, an avatar in a top bar or not, the search bar, now card, strip and grid fully above the tab bar and in
  order, things to tap, words, the grid's tiles and words).
- **Builds**: no Gradle on this Mac (the network gave about 0.6 MB/s). The round's JavaScript is bundled as a release
  build does (`expo export:embed`, Hermes bytecode) and put in CI's demo release APK of `main` (74fc4a40) in place of
  its bundle, so the native side is `main`'s and the comparison with `main` is the JavaScript's alone.
- **Cold start**: force-stop, `am start -W`, Android's `TotalTime`, median of 5. **Tab**: the app's own `[perf] tab`
  lines, p90 over 3 tours of the 5 tabs. **Row**: `[perf] screen` for a Task opened from Tugas.
- **Council**: three judges a round (Claude Opus 5.5, high effort), each new, blind and on a different account, with
  the pictures only. Five apps by letter, shuffled each round: ours, Gojek, Grab, Edunex Mobile LMS, Duolingo.

## Hill 1: the layout students know

| What | `main` 74fc4a40 | Round 1 (7c640072) | Round 2 (the strip, Profil, Kuliah, Tugas, Materi, services reworked) | Final (Kuliah a list again, Ujian compact) | Top of the hill |
| --- | --- | --- | --- | --- | --- |
| Bottom bar | home · schedule · tasks · courses · academic | home · schedule · tasks · courses · **profile** | same | same | the last is `tab.profile` |
| The avatar in a top bar | on every tab | nowhere | nowhere | nowhere | nowhere |
| Beranda's first screen, in order and fully visible | header, now card, a list | `home.search`, `home.now`, `home.strip`, `home.grid` (50 dp to spare above the tab bar) | all four (53 dp to spare) | all four (53 dp to spare) | all four, no scrolling |
| Things to tap on Beranda's first screen | 11 | 15 | 16 | 16 | 12 or more |
| Words on Beranda's first screen | 50 | 44 | 48 | 48 | 60 or fewer |
| Service grid | none | 8 tiles, one word each, "Lainnya" last | 8 tiles by group: Presensi · Materi · Ujian · Nilai · KRS · Kalender · UKT · Lainnya | same 8 | 8 at most, "Lainnya" last, one word |
| "What's due today" | 0 taps | 0 taps (the strip's number, when something is due this week) | 0 taps (the strip's first tile, always there: today's count, else this week's, else 0) | 0 taps | 0 |
| "Is my attendance safe" | 0 taps for a class at risk | 0 taps (the strip: a count at risk, or "Aman") | 0 taps (the strip's second tile) | 0 taps | 0 |
| "Open this week's material" | 3–4 taps | 2 taps (Materi tile, the material's row) | 2 taps | 2 taps | 2 or fewer |
| Cold start (ms, median of 7, both APKs as CI built them) | 599 | 623 (+4%) | not measured again as CI builds it (repacked: 772 against 725 for `main`, +6%) | 630 against 608 for `main` measured back to back (+4%) | within 10% of `main` |
| Tab switch p90 (ms) | 43 | 35 | 35 | 38 | within 10% of `main` |

## Hill 2: the council

Five apps by letter (shuffled each round). "Where" = ranked for "I know where everything is"; LMS = Edunex Mobile LMS.
Scores are 1–10 over ten categories for each of our screens (17 pictures: 12 light, the 5 tabs dark). Pairs: last
round's picture of a tab against this round's, sides shuffled (round 1's "last round" is `main`).

| Round | Build | Judge | Ours, where | Ours, overall | Above LMS | Squint | Our scores (lowest–highest; screens with a 9) | Screens failing a hard rule | Pairs (prefers this round) | Sure of the jobs (due today · attendance · material) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7c640072 | designer | 1st | 2nd (Duolingo 1st) | yes (LMS 5th) | 5 of 5 (Tugas and Kuliah most alike) | 3–8; none | 7 of 17 (Beranda ×3, Kuliah ×2, Materi) | Jadwal, Tugas, Kuliah; prefers `main`'s Beranda and Akademik over Profil | |
| 1 | 7c640072 | student | 1st | 1st | yes (LMS 4th and 5th) | 5 of 5 (Tugas and Kuliah most alike) | 4–9; Jadwal, Ujian | 5 of 17 (Beranda ×3, Materi, Nilai) | Beranda, Tugas, Kuliah, Jadwal; prefers `main`'s Akademik over Profil | 6 · 8 · 8 (LMS: 4 · 4 · 3) |
| 1 | 7c640072 | prosecutor | 1st | 2nd (Duolingo 1st) | yes (LMS 5th) | 5 of 5 (Kuliah and Beranda most alike) | 3–8; none | 12 of 17 (facts repeated across screens) | Jadwal, Tugas, Kuliah; prefers `main`'s Beranda and Akademik over Profil | |
| 2 | 0956276c | designer | 1st | 2nd (Duolingo 1st) | yes (LMS 4th and 5th) | 5 of 5 (Beranda and Kuliah most alike) | 5–8; none | 4 of 17 (Beranda ×2, Kuliah ×2) | 8 of 10 that changed; prefers round 1's Tugas (no empty "Hari ini") and Kuliah (the list) | |
| 2 | 0956276c | student | 1st | 1st | yes (LMS 5th) | 5 of 5 (Beranda and Kuliah most alike) | 4–9; Jadwal, Profil, Cari | 2 of 17 (Kuliah ×2) | 7 of 10 that changed; prefers round 1's Kuliah (the list), Beranda's lower half and Ujian's smaller hero | 8 · 8 · 7 (LMS: 3 · 3 · 3) |
| 2 | 0956276c | prosecutor | 1st | 2nd (Duolingo 1st) | yes (LMS 5th) | 5 of 5 (Beranda and Kuliah most alike) | 3–8; none | 7 of 17 (Beranda ×3, Kuliah ×2, Nilai, the notification ask read as a promo) | 4 of 10 that changed (Profil ×2, Semua layanan, Materi); prefers round 1's Beranda (no "0" tile), Tugas, Kuliah, Beranda's lower half and Ujian | |
| 3 | 9540d488 | designer | 1st | **3rd** (Duolingo 1st, Grab 2nd) | yes (LMS 5th) | 5 of 5 (Beranda and Kuliah most alike) | 5–9; Ujian | 5 of 17 (Beranda ×2, Kuliah ×2, Nilai) | Kuliah; prefers round 2's Tugas (the "Hari ini" heading) and Ujian (the tall hero) | |
| 3 | 9540d488 | student | 1st | 2nd (Duolingo 1st) | yes (LMS 4th and 5th) | 5 of 5 (Beranda and Kuliah most alike) | 5–9; Ujian, Nilai | 4 of 17 (Beranda ×2, Kuliah ×2) | Tugas, Kuliah, Ujian | 9 · 7 · 8 (LMS: 3 · 3 · 3) |
| 3 | 9540d488 | prosecutor | 1st | 2nd (Duolingo 1st) | yes (LMS 4th and 5th) | 5 of 5 (Beranda and Kuliah most alike) | 4–8; none | 12 of 17 (the same facts on several screens) | Kuliah, Ujian; prefers round 2's Tugas (the "Hari ini" heading) | |

What two or more judges raised in round 1, and what was done:

- Beranda says the absences twice (the strip's tile, then the same rows below), and nothing says what's due today →
  the strip always has its three tiles (due, absences, next exam), and "Perlu kamu urus" keeps only what the strip
  doesn't count.
- Profil: the big avatar and the tall blue card push the Akademik rows off the first screen (all three preferred
  `main`'s Akademik) → the identity in one row, the IPK card half as tall, the six rows on the first screen.
- Kuliah tells attendance in words and shows no courses → a grid of course cards with dots (it was already on its
  way); its presence card's button is "Isi Presensi", as on Beranda.
- Tugas has no "today" and no urgency → "Hari ini" always first, a pill on what's due within 3 days.
- Materi is a wall of pasted text → one row per material, a note folded.
- "Semua layanan" repeats tiles and its colours mean nothing → one colour per group, nothing shown twice.
- Not changed: the now card's wave and the header's dot texture (two judges called them decoration; the developer
  asked to keep them), Profil holding Nilai, KRS and UKT (the blueprint; Nilai, KRS and UKT are on Beranda's grid too).
- The grey box behind the greeting in dark was the emulator's keyboard-focus mark, not the app: the picture flow now
  touches the screen first.

What two or more judges raised in round 2, and what was done:

- Kuliah's grid of pastel cards: all three preferred round 1's list, and failed the grid for saying an absence three
  ways (dots, "4/3", a sentence) → one list again, sorted by risk, the course's tile, its name, and the dots as the
  only meter.
- Tugas' empty "Hari ini" block (designer, prosecutor; the student liked being told) → one quiet line, no heading.
- Ujian's tall hero (student, prosecutor) → one compact card: the days left, then the name, day and room.
- Beranda's lower half now leads with the notification ask, which reads as a promo (student, prosecutor) → not
  changed this round: it's the app's one ask and goes once answered. Still open.
- The now card says when the window closes three ways (bar, "tutup 09:30", "1 jam 19 mnt lagi"), the wave and the
  header's dots are decoration (designer, prosecutor) → not changed: the developer asked to keep the now card as it is.
- Beranda and Kuliah both open with the presence card (all three, as the two most alike) → not changed this round.
- One exam, two names ("UTS Markom" on Tugas, "UTS Komunikasi Pemasaran" on Ujian) → Ujian uses the course's name;
  Tugas still shows the lecturer's title. Still open.

After round 3: Tugas got its "Hari ini" heading back over the quiet line (two of three judges preferred round 2's), so
the final build's Tugas is round 2's. Ujian stays compact (two of three) and Kuliah stays a list (all three).

## Where it ends (17:00)

- **Hill 1 (the layout, measured):** at the top on every row. Profil is last in the bar, no avatar is in a top bar,
  Beranda's first screen holds the search bar, the now card, the strip and the grid with 53 dp to spare, 16 things to
  tap (11 on `main`), 48 words (50), "what's due today" and "is my attendance safe" with no tap, this week's material
  in 2 taps (3–4), cold start +4% and tab switches no slower than `main`.
- **Hill 2 (judged):** not at the top.
  - Ranking: every judge put ours first for "I know where everything is" in all three rounds, and above Edunex
    Mobile LMS. Overall it was first or second for every judge in rounds 1 and 2 (two rounds in a row); in round 3 the
    designer put it third, behind Duolingo and Grab.
  - Squint test: 5 of 5 for every judge in all three rounds.
  - Scores: 3–9 in round 1, 3–9 in round 2, 4–9 in round 3. No screen holds 9 in every category for any judge.
  - Hard rules: 4 to 12 of 17 pictures still fail for a judge, almost all on "each fact once": the now card saying
    when the window closes three ways, the presence card on both Beranda and Kuliah, "3,39" twice on Nilai, and (the
    prosecutor) the same fact on different screens.
  - The student's sureness: 6 · 8 · 8, then 8 · 8 · 7, then 9 · 7 · 8 (target: 8 on all three; the previous run's last council: 6 · 8 · 4).
- **Still open, most serious first:** the presence card opens both Beranda and Kuliah; Kuliah's dots have no number
  (round 2's "4/3" was called unreadable, round 3's judges asked for a number back); the now card's three ways of
  saying the closing time, its wave and the header's dots (kept on purpose); one exam under two names on Tugas and
  Ujian; the notification ask leading Beranda's lower half; Materi showing an old link under "Minggu ini" (the
  demo's data: the module the course marks as this week's); unlabelled clash and history marks on Jadwal.
