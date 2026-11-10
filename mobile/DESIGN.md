# Edunex Plus for Android: design system

How the app looks, moves and behaves, so every screen feels built for Android (round 2's goal: next to
Gojek, GoPay, Todoist, Grab and myBCA, never amateur). The tokens live in `src/ui/theme.ts`, the parts in
`src/ui/`. Build screens from those parts; a screen that styles its own button, row or sheet is a bug.
Words come from `src/core/strings` (`.agents/skills/copywriting`). The desktop is a reference for data,
never for layout.

Sources: Material 3 (incl. Expressive) and Android's quality guidelines, through the design skill
(`npx skills add pablonification/mobile-app-design-skill@mobile-app-design -g -y`: `references/android.md`,
`visual-design.md`, `accessibility.md`, `review-checklist.md`). Android only.

## The frame

| Piece | What | Where |
| --- | --- | --- |
| Bottom tabs | Android's own navigation bar (expo-router `NativeTabs`, a Material `BottomNavigationView`): Beranda, Jadwal, Tugas, Kuliah, Profil. Labels always shown; icons are Fluent's 24 px drawings as drawables (`tab_home`, `tab_schedule`, `tab_tasks`, `tab_courses`, `tab_profile`, each with `_filled`: a house, a calendar, a clipboard of ticks, the graduation cap, a person), regular at rest, filled when picked. **The picked tab** is its filled icon and its label (bold) in the brand's blue (`v4.brand`: #1f63e0, dark #a9c4ff), in light and dark; there is no Material pill behind it (the indicator takes the bar's own colour, `surfaceContainer`, so it never draws). At rest: `onSurfaceVariant`. iPhone: Apple's symbols (`house`, `calendar`, `checkmark.circle`, `book`, `person`, each `.fill` when picked where Apple has one), the accent as the tint. **Badges** (the error colour): a badge is a count the tab's page leads with, or it's gone. Tugas: its page's "Belum selesai" count, shown only while one is late or due within a day. Profil: the KRS to send and the bills due, which its rows say. Kuliah: none (presence open now is the page's first line and Beranda's first block, not a number the page leads with). Beranda, Jadwal: none. All tabs mounted ahead: a switch is instant, each keeps its scroll, a second tap scrolls to the top. Each tab's route wraps its page in `TabClock` (a hidden tab ignores the minute's tick until shown) and calls `usePerfFocused(name)`. | `app/(tabs)/_layout.tsx`, `plugins/tab-icons.js`, `scripts/make-tab-icons.mjs` |
| Tab top bar | One pattern on all five tabs (round 3): `TabHeader title=… actions=…`: the tab's name (Title L, Plus Jakarta Sans) with the data's status as one quiet line under it only when it says something to act on (never "Diperbarui baru saja"; tap: the sources sheet), then the tab's own one or two actions (`actions`: Jadwal's month and ⋮, Kuliah's ⋮), then `TabActions`, the same three in the same places on every tab: Search, the bell (a small dot while something's unread), the avatar (account and Settings). Just the bar: no big title under it to collapse. Beranda's bar is its own blue (`HomeBar`: the greeting as its title, then `TabActions`), fixed as the page scrolls. A problem banner follows under it. | `src/shell/source-status.tsx`, `src/screens/home/header.tsx` |
| Stack top bar | `TopBar title=… actions=…`: Android's back arrow, the title at the start (Title L), one or two actions at the end, more in ⋮ (`OverflowMenu`). `lines={2}`: a long subject's name whole on two lines, the bar growing to hold it (a course's page: its name is the bar's title, never a big name in the page under an empty bar). `titleFrom={dp}`: a page that shows its subject big at its top keeps the bar's title hidden until the page has scrolled that far, then fades it in (M3's collapsing top app bar, on the UI thread, no layout moves). | `src/ui/top-bar.tsx`, `src/ui/menu.tsx` |
| Screens | Every drill-down is its own route on the native stack (`app/_layout.tsx`, `animation: "default"`: Android's own open/close, drawn natively), so Back and the back gesture work everywhere with no code. A course, a module (`/course/<code>/module/<id>`), a Task, an exam, Nilai, each part of Rencana studi (`/plan/<part>`), Settings, Search, Notifikasi, the in-app web page. | `app/` |
| Sheets | `Sheet` / `ActionSheet`: Android's Material bottom sheet (react-native-screens' `FormSheet`, a `BottomSheetDialog`): the scrim fades in while the sheet slides up, drag down or Back closes it, fits its content up to the screen less a strip. Its title in the heading face (`SheetTitle`, Plus Jakarta Sans bold, as every screen's), also for a sheet that draws its own heading. The sheet's window takes the app's status bar style (React Native's extra window, as a `Modal`, with Material's own status bar handling taken out: `patches/react-native-screens…`; sent again once it's up), so the icons stay dark over the light page's scrim. | `src/ui/sheet.tsx` |
| Menus | ⋮ opens `OverflowMenu`, Material's menu hung from its button. A row's long-press menu is an `ActionSheet` (nothing to hang from). A choice with `checked` is a setting turned on and off from the menu (its state as a switch at its end, the whole item the target, read as a checkbox): Jadwal's "Ingatkan sebelum kuliah". | `src/ui/menu.tsx` |
| Snackbar | The toasts (`toast(...)`) as Material's snackbar: inverse surface, one at a time, just above the tabs' bar (or the phone's bar), Undo as its one action. | `src/ui/toasts.tsx` |
| Insets | Edge to edge. Inside a tab the tabs keep pages clear of the phone's bar. Over the tabs, a `Page` that reaches the screen's foot stops scrolling at the top of the phone's bar, with a strip of the page's colour under the bar, so nothing ever sits under three-button navigation's buttons (round 3, the real phone); `BottomBar` and Kumpulkan's bar pad by the bar's height (`useBottomInset()`). Never a hard-coded bar height. | `src/ui/insets.ts`, `src/ui/layout.tsx` |

**BackHandler** only while a sheet or an unsaved edit is open (a sheet's Back is the native sheet's own).
Anything else that wants Back is a screen: make it a route.

## The look: one page colour, flat lists, a few cards (the super-app layout, on round 2's v4 tokens)

The tokens are still `theme.v4` (the name stayed; the grey page did not). The page and a card are one colour in both
themes, so a screen is never "flat in light, boxed in dark": a list lies flat on the page with inset hairlines, and a
card (a fill, a corner) is drawn only where one thing leads: Beranda's class block, Profil's head, a course's block, a
notice. The decisions: `mobile/qa/superapp-decisions.md`.

| Part | What | Where |
| --- | --- | --- |
| Surfaces | `theme.v4`: `page` and `card` are the same colour (#ffffff / #161618): nothing may rely on a card standing off the page by its fill. What must stand off takes `chip` or a tint (a course's, a state's). No shadow anywhere. `chip` (a neutral pill's, a neutral icon tile's and a disabled button's fill on a card: #f1f3f7 / #2a2f39, a step off the card in dark, never the page's black), `line`, `fg` / `fg2` / `muted`, the header's `head` (#1f63e0 / dark #1a3158, a deep desaturated blue; white on it 12.9:1) with `onHead`, the one filled button's `brand` / `onBrand` (#1f63e0 + white; dark #a9c4ff + #0a2a66: white on #4d86ff fails), tonal `okBg/okFg`, `redBg/redFg`, `ambBg/ambFg`, `live` (the now dot) | `src/ui/theme.ts` |
| Course tiles | `theme.courseTile(tone)` → `{ ink, tint }` for each of the ten course colours (light and dark): ink ≥ 4.6:1 on its tint and on a card. `CourseTile` (44 dp: the course's glyph, filled and solid in its ink, nothing behind it), `CourseGlyph`; the glyph is Fluent's, one per subject family, picked from the course's name (`courseGlyph`, `CourseIcons`), the same wherever the course appears | `src/ui/tile.tsx` |
| Type | Headings and numbers in Plus Jakarta Sans (`<Text face="display" weight="bold">`, also `semibold`, `extrabold`), bundled as Android font assets (`plugins/fonts.js`, OFL in the licences); everything else Roboto on the M3 scale | `src/ui/text.tsx`, `assets/fonts` |
| Press | `PressScale`: gives to 96.5% and springs back (expressive), on the UI thread; one per card or row | `src/ui/press.tsx` |
| Big button | `BigButton` (52 dp pill). One filled action per screen: `filled` on the page (the brand's blue, white words; dark: pale blue, navy words) or `course` on a block of a course's colour (white, the words in `ink`, the course's colour). `done` (tonal green, after it), `outline` (a second way; `ink` white for a white outline on a course's block) | `src/ui/big-button.tsx` |
| Absence scale | One colouring for a course's absences on every tab. `absenceTone(state)` → `red` once the target can't be reached or the course finished below it, `amber` with the absences used up but none over, `ok` (green) with absences left or the target met ("Sisa 2×"), null before SIX has a count. `absenceName(t, health)`: the one name each warning goes by on every chip and pill (Beranda, Perlu kamu urus, Kuliah, an exam): "Jatah habis", and "Lewat batas 1×" for the target out of reach (the desktop's "Tak bisa lagi capai 80%", said with the target on Kuliah's big number and the course's sheet). Never "Di bawah target": a course with none left can be under its target today too. `absenceInk(theme.v4, tone)` → its `{ bg, fg }` (`redBg/redFg`, `ambBg/ambFg`, `okBg/okFg`): `fg` for words and the pips' used absences, `bg` under a chip's `fg`. The tone names match Kuliah's `StatusChip`. Every pair through contrast.py: on its tint 5.95–6.79:1 light, 9.0–9.6:1 dark; on a card or the page ≥ 6.1:1; the pips at 80% on a card ≥ 4.3:1 (3:1 needed). Amber stays a clash's and a moved class's colour too | `src/ui/absence.ts` |
| Living parts | `WavyProgress` (M3 Expressive's wave up to how far along, moving; track and stop dot after), `CookieCheck` (M3's cookie scaling in turning, its check drawing itself), `PulseDot`, `CountUp` (a number counting up once per run), `Rise` (a screen's cards rising in a stagger on its first showing only) | `src/ui/expressive.tsx` |
| Lists | Flat on the page in both themes, an inset hairline between rows, no card around them. `CardGroup`, `Group`, `CardList`/`CardSlice`, `List`/`GroupTile` keep their names and props and draw no fill and no corner; `Panel` (both of them) draws no fill unless given a `tint` or a fill in `style`. `TileRow` / `GroupRow` (one target: a leading tile, the title, at most one meta line, at most one status; the hairline starts after the tile; `dim` for what isn't open yet), `StatusChip` / `Pill` (the row's one status as a tonal pill), `SectionTitle` / `Heading` (a section's name in Plus Jakarta Sans, its one action at the end) | `src/ui/v4-list.tsx`, `src/ui/group.tsx`, `src/ui/card-list.tsx`, `src/ui/layout.tsx` |
| Other tiles | `IconTile` (a TileRow's tile that isn't a course's: a file's kind, a module's number, a meeting's date) in a tone from `useToneTile()` (v4's red, amber, ok, brand and neutral pairs) | `src/ui/icon-tile.tsx` |
| Bars | `TopBar v4` and `TabHeader v4`: the bar in the page's own colour. Every `TopBar`'s title is in Plus Jakarta Sans bold, `v4` or not: one face for every screen's title | `src/ui/top-bar.tsx`, `src/shell/source-status.tsx` |
| Screens past Beranda | `Heading` (a section's heading in Plus Jakarta Sans), `Panel` (a section's block, flat on the page; a card only with a `tint`; with `onPress` the whole block is one springing target), `Group` + `GroupRow` (rows flat on the page: a leading tile, the title, at most one meta line in a state's tone, one trailing status; hairlines inset past the tile), `Pill` (one tonal status: red, amber, ok, brand, plain), `IconTile` (a tinted square for what isn't a course), `Figure` + `FigureLabel` (a screen's key number counting up once; `decimals` and `comma` for an IPK, "3,42"), `FigureRow` + `FigureCell` (figures side by side: one size for all, so the labels sit on one line and the numbers on one baseline; `FigureDash` for one with nothing to count). A screen using them passes `background={theme.v4.page}` to its `Page`, and its `TopBar` sits on the same grey at rest (`usePageColor`) | `src/ui/group.tsx` (akademik) |
| Course icon tile | `CourseIconTile`: `IconTile`'s shape in a course's tint with a kind's icon in its ink, for a row that belongs to a course but isn't the course (a result, a notification) | `src/ui/course-icon-tile.tsx` (akademik) |
| Meter | `Meter`: a thin bar under a figure, a share in one colour and an optional second stretch in a lighter tone (passed, then this term); the figure says the number | `src/ui/meter.tsx` (akademik) |

### The kit: which part a screen uses for what (`src/ui/kit.tsx`, `src/ui/b.tsx`)

| For | Use | Never |
| --- | --- | --- |
| Marking attendance, anywhere | `PresenceButton` (48 dp pill, the raised hand, testID `action.presence`). `tone="page"` on the page: the brand's blue, white words. `tone="course" ink={courseColour}` on a block of a course's colour: white, the words in the course's colour. `label` is the word when it isn't "Isi Presensi" ("Tandai Hadir" for SIX, the same hand); `icon` only for the block's other main action (joining an online class); `time` puts the one time on the same line; `quiet` outlines it when nobody can say it counts | a local button, a second filled button beside it |
| A screen's one main action | `BigButton variant="filled"`, or `variant="course" ink=…` on a course's block; a second way is `outline` | two filled buttons on one screen |
| How far along (a presence window, a term) | `PlainBar`: a track, a fill, at most one label at its end. On a course's block: `color` white, `track` white at about 30% | a wave, a dot, a second label saying the same time |
| A clash | `ClashMark` (the overlap icon and "Bentrok" in amber; `detail` for when) | other words or another icon for a clash |
| The strip's three | `StatTile` inside `CountStrip`: the figure in a fixed 32 dp line, the label always one line (it shrinks to 85%, then is cut: write two words), a small chevron after the label. Three cells share a baseline whatever their labels | a label that wraps; "0" (good news is `mark`) |
| A service | `ServiceTile` in a `ServiceRow` (four across), glyph and colour from `screens/services/list.ts`; `tag` for the one fact it answers with (Nilai "3,26", UKT "Lunas", KRS "14 SKS"): a small pill on the page's surface over the tile's top right corner, read with the tile's name | a service's glyph or colour chosen on the screen |
| A section's name | `SectionHeading` (`BHeading`) | all-caps labels |
| A row | `FlatRow` (`BRow`), or `TileRow` / `GroupRow` | a card per row |
| Nothing to show | `EmptyState`: the icon bare (no circle, no tile), the reason, one next step | a container behind the icon |


Rules that hold (the judge's): a row has a title and at most one short meta line, at most one status (a chip or an
icon, never a sentence); no explanatory sentences on a tab's first screen (one tap deeper); a tab's first screen ≤ ~45
words above the tabs (`mobile/qa/words.sh`); one title per screen. Motion on the UI thread; Remove animations: fades
and a still wave.

## Colour: Material 3 roles

`theme.color.<role>`. Pair each fill with its `on…` role; never a raw hex in a screen.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| primary / onPrimary | #245bcc / #ffffff | #8fb0ff / #0b2a6b | the one main action (filled button), links, selection |
| primaryContainer / onPrimaryContainer | #dbe6fe / #0d3a91 | #1f3f86 / #dbe6ff | the avatar, a highlighted card |
| secondaryContainer / onSecondaryContainer | #dce3f4 / #16264a | #2d3851 / #dce3f7 | the tabs' indicator, picked chips and segments, tonal buttons, the empty state's icon |
| tertiaryContainer / onTertiaryContainer | #efe6fd / #3a1580 | #3c2768 / #efe6fd | ITB's own (the source's purple) |
| error / onError, errorContainer / onErrorContainer | #b42318 / #fff, #fde7e4 / #7a1710 | #ff9c8f / #5c0f08, #3a1c19 / #ffdad5 | what went wrong, badges |
| surface | #ffffff | #161618 | the page |
| surfaceContainerLowest … Highest | #fff, #f6f7fb, #f0f2f7, #eaecf2, #e3e5ec | #111113, #1c1c1f, #212125, #2a2a2f, #35353b | cards and list tiles (Low), bars and sheets' parent (Container), wells (High), tracks (Highest) |
| onSurface / onSurfaceVariant | #1d1d1f / #55565e | #ececef / #b4b4bd | text: main / secondary (never lighter than onSurfaceVariant) |
| outline / outlineVariant | #7f8088 / #dfe1e8 | #8b8b94 / #3a3a41 | outlined buttons and fields (3:1) / decorative dividers only |
| inverseSurface / inverseOnSurface / inversePrimary | #2e3036 / #f1f1f6 / #aec6ff | #e4e4ea / #2a2a2f / #245bcc | the snackbar |

Meaning colours stay as the desktop names them (`warningBg/Fg`, `successBg/Fg`, `status…`, `meter…`,
the ten course colours via `theme.course(tone)`). The old names (`fg`, `muted`, `faint`, `canvas`, `edge`,
`line`, `fill`, `accent`, `accentFg`, `raised`, `sunken`, …) still work and point at their roles; new code
uses the roles. Every text/icon pair above passes 4.5:1 (text) / 3:1 (icons, outlines) in both themes,
checked by `test/mobile/contrast.test.ts` against the values in `src/ui/palette.ts` (every pair a screen draws,
light and dark). A screen that starts drawing a new pair adds it there.

**Tonal surfaces, not boxes.** Cards and list groups are separated from the page by tone (surfaceContainerLow
on surface), never by a hairline border or a shadow. Shadows only on what floats over content: the
snackbar, a menu.

## Type: Material 3's scale (sp)

`<Text size="titleMedium">`; Android scales sp with the font size setting (up to 200%: never fix a text
container's height, let rows grow).

| Style | Size/line | Weight | Use |
| --- | --- | --- | --- |
| displaySmall … Large | 36/44 … 57/64 | 400 | rare: one big figure |
| headlineMedium | 28/36 | 400 | a page's own title (PageHeader), big figures (IPK) |
| headlineSmall | 24/32 | 400 | a detail screen's subject (a module's title) |
| titleLarge | 22/28 | 400 | top bars, sheet titles |
| titleMedium | 16/24 | 500 | section headers (semibold), card titles |
| titleSmall | 14/20 | 500 | small headers |
| bodyLarge | 16/24 | 400 | list titles, reading text |
| bodyMedium | 14/20 | 400 | meta lines, descriptions |
| bodySmall | 12/16 | 400 | captions, the status line (never smaller for words) |
| labelLarge | 14/20 | 500 | buttons, chips, tabs |
| labelMedium / labelSmall | 12/16, 11/16 | 500 | badges, tiny labels |

At most four sizes and two or three weights on a screen. `weight="semibold"` is the emphasis (M3
Expressive's emphasized styles), used for the one thing per row or section that leads. The old sizes map
onto the scale: micro/caption → bodySmall, small → bodyMedium, body/lead → bodyLarge, title → titleMedium,
heading → headlineSmall, figure/display → headlineMedium.

## Space, shape, targets

- **Spacing** on the 4/8 grid: `space[1]`=4, `[2]`=8, `[3]`=12, `[4]`=16, `[6]`=24, `[8]`=32, `[10]`=40,
  `[12]`=48; page sides 16. Tighter inside a group than between groups. (`space[0.5]`, `[1.5]`, `[2.5]`,
  `[3.5]` are left for old screens; don't use them in new work.)
- **Shape**: `shape.xs` 4 (snackbar, inner list tiles), `sm` 8 (chips, skeletons), `md` 12, `lg` 16 (cards),
  `lgPlus` 20 (a list group's ends, a leading card), `xl` 28 (sheets), `full` (buttons, segments, avatars).
  Nested corners: inner = outer − padding.
- **Touch targets**: 48 dp (`TOUCH`) for everything that takes a tap, whatever it looks like (`hitSlop`
  makes up the difference: a 32 dp chip, a 40 dp button). `IconButton` is 48. The shared controls' sizes and
  their slop live in `src/ui/sizes.ts`, checked by `test/mobile/touch-targets.test.ts`.

## Components (`src/ui/`)

| Part | Material 3 | Notes |
| --- | --- | --- |
| `Button variant=` | primary = Filled, tonal = Filled tonal, secondary = Outlined, ghost = Text, danger = Outlined in error | pill, 40 (md) / 32 (sm) / 56 (lg) high, 48 to touch; label in labelLarge; `busy` keeps its colours with a spinner. **One filled button per screen.** |
| `IconButton` | Standard icon button | 48 dp, a name is required; `selected` for a toggle |
| `Chip` / `ChipRow` | Filter chip | 32 high, outlined; picked: secondaryContainer and a check |
| `Segmented` | Segmented buttons | 40 high, outlined, picked with a check |
| `Switch` | M3 switch | Android's own `MaterialSwitch` (`modules/material-switch`, W9): Material's track, thumb, check, ripple and TalkBack "switch, on"; colours from the roles; 52×48 to touch; the testID sits on the switch itself. A tap the screen doesn't keep goes back after 1.5 s. Without the native module (tests) the JS-drawn one stands in |
| `List` + `Row` | List items in a group | flat on the page, an inset hairline between rows, no tile and no box (light and dark alike); 56 dp min; no chevrons; one row, one target, one outcome; `quick` names a row's swipe actions for TalkBack |
| `GroupTile` | One row of a flat list | `List`'s row drawn one by one for a FlashList (Tugas): a hairline over every row but the `first`; `last` is kept for callers and rounds nothing |
| `SettingsGroup`, `SettingRow`, `SwitchRow`, `ChoiceRow` + `ChoiceSheet` (`ui/settings-list.tsx`) | Settings lists | a `Heading` over a flat `Group`, each row a `GroupRow` (title, the value or state as its one meta line); a switch row toggles from anywhere on it with a haptic (Android's MaterialSwitch at its end, the row carrying role switch and the testID); a choice row shows its value and opens a native sheet of radio options (each option `<rowTestID>.<value>`) |
| `ErrorBanner` (`ui/settings-list.tsx`) | Banner | a page's error under its top bar with a close button, until the next try works (never a snackbar) |
| `DrawnCheck`, `Celebration` (`ui/celebrate.tsx`) | — | the earned moment: a success circle springs in and its check draws itself (Reanimated, UI thread) with the success haptic; Remove animations: a fade. `Celebration` shows it over the page without blocking taps, read by TalkBack, gone after ~1.7 s (the hand-in) |
| `SwipeRow` | Swipe to act (Gmail) | see Patterns; on the UI thread (gesture handler 3 + Reanimated) |
| `Card` | Filled card | plain (Low), raised (Container, the one card that leads), sunken (High) |
| `Section`, `PageHeader`, `Notice`, `StatRow`, `Meta` | | as before, on the scale |
| `EmptyState` | | the icon bare on the page (no circle, no tile), Title M, a line why, the next step as a button |
| `Skeleton` | | the shape of what's coming, breathing slowly (still with Remove animations) |
| `Sheet`, `ActionSheet` | Modal bottom sheet | native; `footer` for the sheet's main action |
| `OverflowMenu`, `Menu` | Menu | anchored, 48 dp items |
| `TopBar`, `TabHeader` | Small top app bar | surface at rest, surfaceContainer once the page scrolls under it (on the UI thread) |
| `Toasts` | Snackbar | |

## Icons

One family for the whole app, the desktop's: Microsoft's **Fluent UI System Icons** (MIT; `docs/design-system.md`,
"Icons"). `src/ui/icons.tsx` keeps the names the app always used (`Icons.Home`, `Icons.Check`, …) and their props
(`size`, `color`, `weight`).

- **Drawn at the size Fluent made it for.** Fluent draws each icon anew at 12, 16, 20, 24, 28, 32 and 48 px, its lines
  as thick as that size wants; an icon draws the form nearest the size it shows at (between two, the bigger:
  `src/ui/icon-size.ts`). 18 draws the 20 px form, 22 the 24, 28 the 28.
- **Regular, or filled where the Student is.** Regular by default; `weight="fill"` or `"bold"` draws Fluent's filled
  form: a picked tab, a service's tile, a status that has to read at a glance (a check, a warning). `"light"` is
  regular. A filled shape has to mean the same: `Icons.Circle` ("not started") stays a ring whatever the weight.
- **Plain path data, loaded when drawn.** `scripts/make-ui-icons.mjs` copies each icon `icons.tsx` imports
  (`./fluent/<name>`) from `@fluentui/react-icons` into `src/ui/fluent/<name>.ts`: its paths as strings, drawn with
  `react-native-svg`. Never `@fluentui/react-icons`' components (they're DOM). Each icon's file loads when it's first
  drawn (Metro's inline requires), so Beranda's first frame loads only the icons on it, not all 95 (about 340 KB in all).
- **By Fluent's own name** (`<Fluent name="Search20Regular">`, `ui/fluent.tsx`): a thin wrapper for the service tiles
  and b.tsx's marks, loading the same way: each glyph is its own file (`src/ui/fluent-named/<name>.ts`) behind a
  function in `ui/fluent-paths.ts`. It used to be one table of all 44 paths, loaded whole by the first glyph drawn
  (Beranda's search icon). New icons go in `icons.tsx`, not here.
- **A new icon:** find its name in `node_modules/@fluentui/react-icons/lib/atoms/headless-svg/` (the repository
  root's), import `./fluent/<name>` in `icons.tsx`, add it to `Icons`, run `node mobile/scripts/make-ui-icons.mjs`.
- **The tabs** are the same family as Android drawables (24 px, regular and `_filled`): `scripts/make-tab-icons.mjs`
  writes `assets/tab-icons/`, `plugins/tab-icons.js` copies them in at prebuild (a native build to change).
- **Services** (Beranda's grid, Semua layanan): `ServiceIcons.<Name>`, filled by default, each in its own colour on
  its tile. Drawn at 24, 28 and 32 px; where Fluent drew no 28 or 32, the nearest it drew (in brackets).

| Service | Export | Fluent icon | Sizes Fluent drew (of 24, 28, 32) |
| --- | --- | --- | --- |
| Jadwal | `ServiceIcons.Schedule` | `calendar-ltr` | 24, 28, 32 |
| Tugas | `ServiceIcons.Tasks` | `clipboard-task-list-ltr` | 24 (28, 32: the 24) |
| Kuliah | `ServiceIcons.Courses` | `hat-graduation` | 24, 28, 32 |
| Presensi | `ServiceIcons.Attendance` | `hand-right` | 24, 28 (32: the 28) |
| Nilai | `ServiceIcons.Grades` | `ribbon` | 24, 28, 32 |
| Ujian | `ServiceIcons.Exams` | `document-edit` | 24 (28, 32: the 24) |
| Materi | `ServiceIcons.Materials` | `book` | 24, 28, 32 |
| KRS | `ServiceIcons.Krs` | `stack-add` (courses stacked up, one more to add; never a clipboard or a form: those are the Tugas tab's and a Task's) | 24 (28, 32: the 24) |
| UKT | `ServiceIcons.Bills` | `wallet` | 24, 28, 32 |
| Kalender akademik | `ServiceIcons.AcademicCalendar` | `calendar-star` | 24 (28, 32: the 24) |
| Rencana studi | `ServiceIcons.StudyPlan` | `directions` | 24, 28, 32 |
| Transkrip | `ServiceIcons.Transcript` | `document-ribbon` | 24, 28, 32 |
| Notifikasi | `ServiceIcons.Notifications` | `alert` | 24, 28, 32 |
| Pengaturan | `ServiceIcons.Settings` | `settings` | 24, 28, 32 |
| Pencarian | `ServiceIcons.Search` | `search` | 24, 28, 32 |
| Lainnya | `ServiceIcons.More` | `grid` | 24, 28 (32: the 28) |
| Kurikulum | `ServiceIcons.Curriculum` | `library` | 24, 28, 32 |
| Berkas | `ServiceIcons.Files` | `folder` | 24, 28, 32 |
| Profil | `ServiceIcons.Profile` | `person` | 24, 28, 32 |
| Perlu kamu urus | `ServiceIcons.Needs` | `checkbox-person` (a box to tick that is yours; the warning triangle is a warning only) | 24 (28, 32: the 24) |
| Ringkasan awal | `ServiceIcons.FirstSummary`, `Icons.FirstSummary` | `scan-text` (a page being read: its one glyph everywhere; the history clock is "Jam berubah" only) | 24, 28, 32 |
| Jadwal bulanan | `ServiceIcons.Month`, `Icons.Month` | `calendar-multiple` (pages one behind another; not the Jadwal tab's single page, nor Lainnya's dots) | 24, 28, 32 |
| Laporkan masalah | `ServiceIcons.Report` | `person-feedback` | 24, 28, 32 |

**Service colours, one rule.** Colour belongs to Beranda's seven, one each: Materi blue, Ujian violet, Nilai lime,
Kalender teal, KRS magenta, UKT green, Rencana indigo (`SERVICE_TONES`, `src/ui/palette.ts`). None is red or amber:
those say a state (late, at risk), never a place to go. Each sits on its own step of lightness as well as its own
hue, so a colour-blind eye tells them apart too. Every other service, and "Lainnya", is the **neutral tile** (`grey`):
a soft grey square with its own glyph in grey ink, the same in both themes, on Semua layanan, in Profil's rows and
in search. So no colour ever stands for two services. A service's glyph and colour live in
`src/screens/services/list.ts` only; `test/mobile/contrast.test.ts` ("service colours by the rule") holds the rule.

- **Courses** (`CourseIcons`, picked by `courseGlyph` in `ui/tile.tsx` from words in the course's name): always the
  filled form, solid in the course's colour, no outline pair and no container. One per subject family; none is a
  tab's or a service's glyph. Nothing in `src/ui` draws another icon family (`test/mobile/icons.test.ts`).

| Subject family | Export | Fluent icon |
| --- | --- | --- |
| Tugas akhir, skripsi, proposal | `CourseIcons.Thesis` | `certificate` |
| Transportasi, infrastruktur | `CourseIcons.Transport` | `vehicle-subway` |
| Komunikasi, pemasaran, media | `CourseIcons.Communication` | `megaphone-loud` |
| Ekonomi, keuangan, bisnis | `CourseIcons.Economy` | `data-trending` |
| Akuntansi, perbankan | `CourseIcons.Accounting` | `savings` |
| Perencanaan, kota, wilayah | `CourseIcons.Planning` | `map` |
| Arsitektur, bangunan | `CourseIcons.Architecture` | `building-multiple` |
| Sipil, struktur, jembatan | `CourseIcons.Civil` | `wrench-screwdriver` |
| Pemrograman, informatika, data | `CourseIcons.Code` | `braces` |
| Elektro, listrik, daya | `CourseIcons.Electric` | `plug-connected` |
| Komputer, sistem digital | `CourseIcons.Computer` | `developer-board` |
| Kimia, biologi, lab | `CourseIcons.Lab` | `beaker` |
| Fisika | `CourseIcons.Physics` | `molecule` |
| Matematika, statistik | `CourseIcons.Math` | `math-formula` |
| Lingkungan, kehutanan | `CourseIcons.Environment` | `leaf-two` |
| Kesehatan, farmasi | `CourseIcons.Health` | `heart-pulse` |
| Hukum, etika | `CourseIcons.Law` | `scales` |
| Desain, seni rupa | `CourseIcons.Design` | `paint-brush` |
| Gambar teknik, metode | `CourseIcons.Drawing` | `ruler` |
| Manajemen, kewirausahaan | `CourseIcons.Management` | `briefcase` |
| Sosial, masyarakat, psikologi | `CourseIcons.Society` | `people-community` |
| Bahasa, global | `CourseIcons.Language` | `earth` |
| Any other course | `CourseIcons.Course` | `book-open` |

**One glyph, one meaning.** The warning triangle (`Icons.AlertTriangle`) is a warning only; the history clock
(`Icons.History`) is "Jam berubah" only; the overlap (`Icons.Overlap`, in `ClashMark`) is a clash only; the raised
hand is marking attendance only; the cap is the Kuliah tab only (a course is its own `CourseIcons` glyph, SIX is the
building, Edunex the learning window); the clipboard list is the Tugas tab only.

Glyphs the screens asked for, in `Icons` (regular; `weight="fill"` for the filled form):

| For | Export | Fluent icon | Sizes Fluent drew |
| --- | --- | --- | --- |
| Share a file or link | `Icons.Share` | `share-android` | 16, 20, 24, 32 |
| A PDF | `Icons.FilePdf` | `document-pdf` | 16, 20, 24, 28, 32 |
| Slides | `Icons.FileSlides` | `slide-text` | 16, 20, 24, 28, 32, 48 |
| Sound | `Icons.FileAudio` | `music-note-2` | 16, 20, 24 |
| SIX (the account, a source) | `Icons.Six` | `building-bank` | 16, 20, 24, 28, 48 |
| Edunex (the account, a source) | `Icons.Edunex` | `learning-app` | 16, 20, 24 |

Neither SIX nor Edunex takes the graduation cap (the Kuliah tab's) or the book (Materi's).

Still Phosphor, to replace: the course glyphs in `src/ui/tile.tsx` and the file kinds in `src/parts/files.tsx`.

## Motion

Every touch answers; every change of state is shown moving; joy only for what the Student earned. The full list of
what moves, and how, is `qa/superapp-motion.md`; the parts to build it with are in `src/ui/moves.tsx`.

- **Every touch answers in the frame it lands.** Android's ripple (drawn by the system, never late), an iPhone's
  tint or dim, and for a card, a tile or an icon a small give. A bare `Pressable` with none of these is a bug: use
  `Tap` (`feel` card, tile, row or icon), or a `Button`, `IconButton`, `Chip`. A full-width row tints, it doesn't
  shrink.
- **Every change the Student causes moves from where it was to where it is**, never a jump cut:
  - something comes, goes or changes height (a fold, a banner, a row done, a section after a refresh): `Appear`, with
    `shifts` on what's below so the page slides aside;
  - content replaces content in the same place (skeleton to data, one filter's list to another's, a tab's panel):
    `CrossFade`;
  - a number that changes while seen (minutes left, a count, IPK after a refresh): `RollTo` (`CountUp` is for a
    first showing only);
  - the picked mark of a segment, a tab pill or a day slides to the new one: `useSlidingMark`;
  - a list's first showing arrives once, in a short stagger: `Arrive` (a screen's big parts: `Rise`).
- **Screens, sheets, menus, tabs, pull to refresh and switches are Android's own** (native stack `animation:
  "default"`, the Material sheet, NativeTabs, `RefreshControl`, MaterialSwitch). Tabs switch at once (the speed wall).
- **Tokens only** (`motion` in `ui/theme.ts`): `spatialFast/Default/Slow` for what moves, `effectsFast/Default` for
  fades and colour (never overshoot), `duration.short` 150, `medium` 250, `long` 400. A spring or duration written out
  in a screen is a bug; a new one is proposed for `theme.ts`.
- **On the UI thread**: Reanimated, or RN Animated with `useNativeDriver`. Never animate on the JS thread.
- **Joy in a few earned moments only** (`motion.expressive`, a slight overshoot; `ui/celebrate.tsx`): Kumpulkan,
  presence marked, a swipe that commits. Not on every tap.
- **Haptics on commits only** (`ui/haptics.ts`): done, sent, saved, a swipe past its threshold, a long press. Never on
  a plain tap, a navigation or a scroll.
- **Remove animations** (`useReduceMotion()`): nothing slides, springs or staggers; a change is simply there (a fade
  only where it's already safe); a touch still answers with its ripple or tint; the skeleton stops breathing. A layout
  animation never starts on a hidden screen (one started there with animations off left parts invisible: `Rise`).
- **Endless loops run only while shown** (`useLoopWhileShown()` in `ui/motion.ts`): the wave, the "now" dot, a
  skeleton's breathing and a spinner run while their screen is in front and the app in the foreground, and stop
  otherwise (a hidden tab, a screen under a pushed one, the background). Use it for any new looping part: a loop
  left running redraws every frame for nobody (battery), and Android's tools see the app as never idle.
- **Below the fold waits for the push** (`Later` in `screens/plan/deferred.ts`): a screen's first screenful draws at
  once; its lower parts mount one per frame after the push transition ends, never during it.
- **Frames**: under 5% janky during every animation and list scroll on a Galaxy A52 (`qa/jank.sh`). No layout
  animations inside a FlashList's recycled cells.

## The first minute

The app's one loud place: the first open, the sign-in and the moment Beranda appears (`src/shell/first-minute/`,
"two doors, one room"). Edunex and SIX are two doors every ITB student knows; the app is the one room behind both.
It's loud because it happens once, and it's wrapped around what must happen anyway (one sign-in), so it never adds
a wait: one tap, nothing to swipe, nothing to skip, and it ends about a second after the systems are in.

| When | What the Student sees |
| --- | --- |
| First frame | The stage: Edunex Plus's blue over the whole screen (the same blue gone deep in dark), status bar icons white (`shell/welcome.tsx`). |
| A moment later | Two doors rise in the upper half, the same faint light on both, each with its system's logo and name. Bottom-left the headline, "Edunex dan SIX, / akhirnya di satu tempat."; under the thumb the one button, "Masuk dengan akun ITB"; the language chip top-right. |
| The tap | The button becomes the status in words, in its place ("Menunggu Microsoft…", "Menyelesaikan masuk ke Edunex…", "Menghubungkan SIX juga…"); the language chip goes. Microsoft's page covers the stage while the Student types; once it hands back the stage shows again, not a spinner. |
| Each system in | Its door, which breathed with a line of light under it while it signed in, lights (white in light, pale blue in dark), its name in its own colour, a tick at its foot. One haptic each. With the first one in, the headline becomes the greeting ("Pagi, Dimas"). A door has three states (nothing, working, in) and never a fill level: nothing there is measured. |
| Both in (or 2 s after the first) | The doors close up and the app's mark lands on the seam, between the names and the ticks. A tick haptic. |
| Half a second on | The hand-over, one move: the whole stage (doors, mark, greeting) lifts away like a curtain, its lower edge rounded. Under it the real Beranda was there all along: the tab bar shows first, then its blocks from the bottom up, each in its place and filling as the first read brings it. One haptic. The status bar's icons turn to Beranda's as the curtain clears them. |
| 0.6 s later | The scene is gone. Nothing of it is left on Beranda. |

Rules it keeps:

- **Nothing stands in for Beranda.** The read's progress is Beranda's own blocks filling in place, never a list drawn
  for the wait and thrown away. The first read's card (`screens/home/first-run.tsx`) holds its place from the start:
  what the read has brought ("5 mata kuliah · 10 tugas"), then "Semua siap, Dimas." in the same place. Nothing
  arrives late and pushes the page down.
- **Nothing on a door is a control**, and both doors look the same until a system moves: no ring, no fill level, no
  list of features.
- **The scene knows nothing of Beranda's layout.** Its colours are its own (`first-minute/colors.ts`), it leaves
  upward as one sheet, and all it takes from Beranda is in `first-minute/seam.ts` (the status bar's icons over
  Beranda's page, the curtain's corner). A new Beranda re-points that file, if anything.
- **UI thread only, transforms and opacity only**: the hand-over is one transform on one view, set going whole at
  the start so the first read's JavaScript can't hold a step of it up. No layout animation, no blur, no per-frame
  drawing, and the scene reads no data but who signed in.
- **Loaded only when nobody is signed in** (`first-minute/gate.tsx`): a start with someone signed in pays nothing.
- **Remove animations**: the same steps as fades (the door's light, the tick, the mark), then a cross-fade straight
  to Beranda; nothing moves or breathes. **TalkBack**: the headline, each door's state ("Edunex: Belum terhubung",
  "Edunex terhubung"), the button, and the status line as it changes; once the curtain lifts, only Beranda speaks.
  **Font size 1.3 and a small phone**: the headline's two halves share one size at which each keeps to its one line
  (never a word alone), the doors shorten, and the note under the button gives way first.
- **Every other way in keeps the stage**: a sign-in that fails or is closed brings the button back with the reason
  over it; with SIX down or slow the hand-over goes with Edunex's door alone, 2 s after it's in, and Beranda's own
  status offers SIX; signed out later, the stage is the first frame again.

## Patterns

- **One tap target per card or row, one outcome.** A card with an arrow that goes elsewhere is a bug (W12).
- **States, every screen**: saved data at once; else a skeleton in the screen's own shape (never a spinner
  on a blank page); empty says why and the next step; an error is a banner under the top bar with what's
  wrong and "Coba lagi" (`ProblemBanner`); offline keeps the saved data with "Terakhir diperbarui …" in the
  top bar's status line, never greyed out. During the first read (`useFirstReadRunning`, or the demo's `useSettling`) a
  part picked from half the data shows only what won't change and holds the rest in its place, the same size, so
  nothing swaps or moves as it fills in: Perlu kamu urus's cards wait in their shape; the now card keeps the course's
  colour and its official name once known, its line, wave, minutes and button held (`screens/home/now-hold.ts`).
- **Errors never in a snackbar** (it's gone before it's read): inline for a field, a banner for the page, a
  dialog only when it blocks. The snackbar says what happened, with Undo.
- **Undo over confirm** for routine actions; confirm only what can't be undone, naming it.
- **Every gesture has a visible way too** (a swipe also in the long-press menu, the menu also in ⋮ or a button).
- **Swipe on a row = Android's commit swipe** (`SwipeRow`, Gmail's): the row follows the finger over the action's
  colour; past 35% of its width (or a flick past 25%) a haptic tick and the icon growing say letting go will do it.
  A "done" (success tone) swipes toward the end, anything else toward the start, the same on every screen. An action
  that puts the row away (`leaves`, the default) slides it out, folds it, then runs, and its snackbar offers Urungkan
  (a row still there 1.5 s later comes back); one that opens a choice (`leaves: false`, Ingatkan nanti) springs back
  and opens it. Every swipe is also in the long-press `ActionSheet` and in TalkBack's actions (`Row quick=`).
- **A card is one target**: the whole card opens one thing (Beranda's now card: its class's sheet); a labelled
  button inside it is the card's one action, never an arrow to somewhere else.
- **Speed**: every screen calls `usePerfDrawn(ready)` (a tab: `usePerfFocused(name)`); targets on the lab's
  release builds: tab switch < 300 ms, screen open < 500 ms, no JS block > 50 ms while moving. Draw the
  first screenful first: defer what's below it a frame, FlashList for long lists.
- **testIDs**: `screen.<name>`, `tab.<name>`, `row.<kind>.<id>`, `action.<name>`, `sheet.<name>`.

## Review checklist (before a screen is done)

Light and dark screenshots on `mid`; largest font size; TalkBack names on every control; every pair through
contrast.py; 48 dp targets; one filled button; no hairline boxes; Back and the gesture from every pushed
screen; the empty, loading, error and offline states seen once each.
