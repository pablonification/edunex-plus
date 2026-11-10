# Round 4: shared decisions (the super-app layout)

Written before the first wave so children don't collide. Change it only through the lead.

## Bottom bar

Beranda (`tab.home`, `index`) · Jadwal (`tab.schedule`) · Tugas (`tab.tasks`) · Kuliah (`tab.courses`) · **Profil**
(`tab.profile`, `app/(tabs)/profile.tsx`, `screen.profile`). Akademik is no tab any more: its content is in Profil.
The avatar is in no top bar. The bell is on Beranda only. Search is a bar on Beranda (`home.search`), not an icon on
every tab.

## Beranda's first screen (1080×2400 at 420 dpi = 411×914 dp, font size 1.1, no scrolling)

In this order, each fully visible:

1. `home.header`: Edunex blue, a short greeting, then a full-width search bar (`home.search`, opens `/search`) with the
   bell (`action.alerts`) beside it.
2. `home.now`: the now card as it is (it keeps `card.now` inside).
3. `home.strip`: 2–3 number tiles, each a tap into its page: `strip.due` (due this week → Tugas), `strip.attendance`
   (courses at risk → `/presence`), `strip.exam` (the next exam, in days → the exam). A number and one or two words.
   Nothing to show: one quiet line, or gone.
4. `home.grid`: `ServiceGrid` with `HOME_GRID` (4 × 2).

Below the fold: later today (compact), then what still needs the Student ("Perlu kamu urus").

Budgets: 12 or more things to tap on the first screen (tab bar not counted), 60 words or fewer.

## Services (`mobile/src/parts/services.tsx`: one list, the only place a service's colour, icon and word are set)

| id | Word (id / en) | Colour (light) | Icon (Phosphor, fill) | Opens |
| --- | --- | --- | --- | --- |
| `presence` | Presensi / Presence | `#15994f` green | HandPalm | `/presence` |
| `grades` | Nilai / Grades | `#e07b00` orange | Exam | `/grades` |
| `exams` | Ujian / Exams | `#7a4fe0` violet | NotePencil | `/exams` (new view of `edunex.exams`) |
| `materials` | Materi / Materials | `#0b8fa8` teal | Books | `/materials` (new view: this week's material, every course) |
| `krs` | KRS | `#d6336c` pink | ClipboardText | `/plan/krs` |
| `calendar` | Kalender / Calendar | `#e04434` red | CalendarDots | `/plan/deadlines` |
| `bills` | UKT | `#b8860b` gold | Wallet | `/plan/bills` |
| `more` | Lainnya / More | neutral (`v4.chip`) | SquaresFour | `/services` |

testID `service.<id>`. "Semua layanan" (`/services`, `screen.services`): a search bar (`services.search`), "Sering kamu
buka", then every service grouped (Kuliah, Akademik, Administrasi, Buka di web), the same tiles. New services for that
page are added to `SERVICES` with their own colour.

## Three surfaces, each with one job

- **Hero**: colour, one per screen at most (Beranda's blue header and now card; Profil's identity and IPK).
- **Tile**: a service. A saturated colour, a white filled icon, 52 dp, one word under it. Never a pale tint with a
  line icon.
- **Row**: only for a list of like things (tasks, courses, settings).

One icon family (Phosphor). No emoji, no banner, promo, mascot or decoration badge, no card inside a card, no
sentence that explains the screen.

## Who owns which files (first wave)

| Child | Owns | Leaves alone |
| --- | --- | --- |
| A, tabs and navigation | `app/(tabs)/_layout.tsx`, `src/shell/source-status.tsx` (`TabHeader`, `TabActions`: no avatar, no bell or search off Beranda), `assets/tab-icons` (`tab_profile`, `tab_profile_filled`), `src/nav.ts`, deep links, `flows/`, `qa/flows/`, `flows/screens.json`, testIDs that moved | home, profile, services |
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
