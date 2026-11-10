# Round 4: shared decisions (the super-app layout)

Written before the first wave so children don't collide. Change it only through the lead.

## Bottom bar

Beranda (`tab.home`, `index`) · Jadwal (`tab.schedule`) · Tugas (`tab.tasks`) · Kuliah (`tab.courses`) · **Profil**
(`tab.profile`, `app/(tabs)/profile.tsx`, `screen.profile`). Akademik is no tab any more: its content is in Profil.
The avatar is in no top bar. The bell is on Beranda only. Search is a bar on Beranda (`home.search`); Jadwal, Tugas
and Kuliah keep only a search icon (`action.search`) beside their own actions.

## Beranda's first screen (1080×2400 at 420 dpi = 411×914 dp, font size 1.1, no scrolling)

In this order, each fully visible:

1. `home.header`: Edunex blue, a short greeting, then a full-width search bar (`home.search`, opens `/search`) with the
   bell (`action.alerts`) beside it.
2. `home.now`: the now card as it is (it keeps `card.now` inside).
3. `home.strip`: 2–3 number tiles, each a tap into its page: `strip.due` (due this week → Tugas), `strip.attendance`
   (courses at or past their limit → Kuliah), `strip.exam` (the next exam, in days → the exam). A number and one or two words.
   Nothing to show: one quiet line, or gone.
4. `home.grid`: `ServiceGrid` with `HOME_GRID` (4 × 2).

Below the fold: later today (compact), then what still needs the Student ("Perlu kamu urus").

Budgets: 12 or more things to tap on the first screen (tab bar not counted), 60 words or fewer.

## Services (`mobile/src/parts/services.tsx`: one list, the only place a service's colour, icon and word are set)

Colour means the group: every service in a group has its group's one colour (`GROUP_COLORS`), white filled icon at
3:1 or more, light and dark. Inside a group, services differ by their icon's shape; no two services share one.

| Group | Colour (light / dark) | Services (Phosphor, fill) |
| --- | --- | --- |
| Kuliah | `#0f8a6c` / `#0d7a60` teal-green | Presensi (HandPalm, `/courses`), Materi (Books, `/materials`), Ujian (PencilLine, `/exams`) |
| Akademik | `#7a4fe0` / `#6d45d0` violet | Nilai (Exam, `/grades`), KRS (ClipboardText), Rencana studi (Path), Kurikulum (TreeStructure) |
| Administrasi | `#c2580c` / `#b04f0b` amber-orange | Kalender (CalendarDots, `/plan/deadlines`), UKT (Wallet), Notifikasi (Bell), Pengaturan (GearSix), Lapor masalah (Lifebuoy) |
| Buka di web | `#5b6577` / `#525b6b` slate | Edunex (Student), SIX (Globe) |
| (none) | neutral (`v4.chip`) | Lainnya (SquaresFour, `/services`), Beranda only |

`HOME_GRID`, by group: Presensi, Materi, Ujian · Nilai, KRS · Kalender, UKT · Lainnya.

testID `service.<id>`. "Semua layanan" (`/services`, `screen.services`): a search bar (`services.search`; nothing
found offers `/search?q=…`), "Sering kamu buka" (`services.frequent`, only after 5 counted opens, at most 4 tiles,
absent in the demo's pictures), then Kuliah, Akademik, Administrasi, Buka di web (`services.group.<group>`), each a
heading over its tiles. Tugas and Jadwal aren't tiles: they're bottom tabs; Jadwal's month view opens from Jadwal. Each
fact once. A new service joins a group and takes its colour.

## Three surfaces, each with one job

- **Hero**: colour, one per screen at most (Beranda's blue header and now card; Profil's identity and IPK).
- **Tile**: a service. Its group's colour, a white filled icon, 52 dp, one word under it. Never a pale tint with a
  line icon.
- **Row**: only for a list of like things (tasks, courses, settings).

One icon family (Phosphor). No emoji, no banner, promo, mascot or decoration badge, no card inside a card, no
sentence that explains the screen.

## Who owns which files (first wave)

| Child | Owns | Leaves alone |
| --- | --- | --- |
| A, tabs and navigation | `app/(tabs)/_layout.tsx`, `src/shell/source-status.tsx` (`TabHeader`, `TabActions`: no avatar, no bell off Beranda, a search icon on the other tabs), `assets/tab-icons` (`tab_profile`, `tab_profile_filled`), `src/nav.ts`, deep links, `flows/`, `qa/flows/`, `flows/screens.json`, testIDs that moved | home, profile, services |
| B, Beranda | `src/screens/home/**`, `app/(tabs)/index.tsx` | `src/parts/services.tsx` (imports it) |
| C, Semua layanan | `src/parts/services.tsx`, `app/services.tsx`, `src/screens/services/**` | home, profile |
| D, Profil | `app/(tabs)/profile.tsx`, `src/screens/profile/**` (may reuse `src/screens/academic` and `src/screens/settings` parts) | tab layout, home |
| E, Materi and Ujian | `app/materials.tsx`, `app/exams.tsx`, `src/screens/materials/**`, `src/screens/exams/**` | everything else |

Strings: `src/core/strings/mobile.ts`, each child under its own `// r4 <area>` comment placed next to its screen's
existing section (A: after the tabs; B: at the end of `// home`; C: after `mobile.service.*`; D: after `// Akademik`;
E: at the end of the file's entries), Indonesian and English, with the `copywriting` skill.

Children never start an emulator, Metro or Gradle, and never run `npm install`. They run `npx tsc --noEmit` in
`mobile/`, `npx biome check` on what they touched, the vitest files they touched, commit on their branch and hand back
the branch and commit.
