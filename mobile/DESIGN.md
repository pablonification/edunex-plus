# Edunex Plus phone app: design system

How the app looks, moves and behaves, so every screen feels built for the phone it is on, and sits next to
Gojek, Grab and GoPay without shame. The tokens live in `src/ui/theme.ts`, the parts in
`src/ui/`. Build screens from those parts; a screen that styles its own button, row or sheet is a bug.
Words come from `src/core/strings` (`.agents/skills/copywriting`). The desktop is a reference for data,
never for layout.

Sources: Material 3 (incl. Expressive) and Android's quality guidelines, through the design skill
(`npx skills add pablonification/mobile-app-design-skill@mobile-app-design -g -y`: `references/android.md`,
`visual-design.md`, `accessibility.md`, `review-checklist.md`). Android is drawn first; what an iPhone does
differently is in `IOS.md`.

## The frame

| Piece | What | Where |
| --- | --- | --- |
| Bottom tabs | Android's own navigation bar (expo-router `NativeTabs`, a Material `BottomNavigationView`): Beranda, Jadwal, Tugas, Kuliah, Profil (the Student is last, as in Gojek and Grab). Akademik is not a tab: its pages are Profil's rows and the service tiles. Labels always shown; icons are Fluent's 24 px drawings as drawables (`tab_home`, `tab_schedule`, `tab_tasks`, `tab_courses`, `tab_profile`, each with `_filled`: a house, a calendar, a clipboard of ticks, the graduation cap, a person), regular at rest, filled when picked. **The picked tab** is its filled icon and its label (bold) in the brand's blue (`v4.brand`: #1f63e0, dark #a9c4ff), in light and dark; there is no Material pill behind it (the indicator takes the bar's own colour, so it never draws). **The bar is the page's own colour** (`v4.page`, white; dark #161618) with a hairline (`v4.line`) along its top, drawn where the tabs' pages end (`BarHairline`), not a grey band under a white page; Material's ripple stays. The phone's own three buttons under it follow the theme (dark on light, light on dark: `NavigationBar` in `app/_layout.tsx`). At rest: `onSurfaceVariant`. iPhone: Apple's symbols (`house`, `calendar`, `checkmark.circle`, `book`, `person`, each `.fill` when picked where Apple has one), the accent as the tint. **Badges** (the error colour): a badge is a count the tab's page leads with, or it's gone. Tugas: its page's "Belum selesai" count, shown only while one is late or due within a day. Profil: the KRS to send and the bills due, which its rows say. Kuliah: none (presence open now is the page's first line and Beranda's first block, not a number the page leads with). Beranda, Jadwal: none. All tabs mounted ahead: a switch is instant, each keeps its scroll, a second tap scrolls to the top. Each tab's route wraps its page in `TabClock` (a hidden tab ignores the minute's tick until shown) and calls `usePerfFocused(name)`. | `app/(tabs)/_layout.tsx`, `plugins/tab-icons.js`, `scripts/make-tab-icons.mjs` |
| Top bars | **No avatar anywhere**: the Student is the Profil tab. Beranda: the search bar (`home.search`, a 48 dp pill on the page's `soft` fill that opens Search with the keyboard up) with the bell at its end, fixed as the page scrolls (`HomeBar`). Every other tab: its name (Headline S, Plus Jakarta Sans bold) on the white page, the data's status as one quiet line under it only when it says something to act on (never "Diperbarui baru saja"; tap: the sources sheet), the tab's own one or two actions (Jadwal's month and ⋮, Kuliah's ⋮, Profil's Settings), then Search and the bell (a dot while something is unread), the same two in the same place on every tab (`BTabHeader`; Jadwal's `TabHeader` draws the same bar). A problem banner follows under it. | `src/screens/home/header.tsx`, `src/parts/b-header.tsx`, `src/shell/source-status.tsx` |
| Beranda | One white page; its first screen, in order and with no scrolling at font size 1.1: the search bar (`home.search`); the class on now, the page's one block of colour (`home.now`, `NowBlock`); one strip about the Student, three things to tap (`home.strip`: what's due, absences at or past the limit, days to the next exam; good news is a check and a word, never "0"); the services, four across, eight at most, one word each, the last "Lainnya" (`home.grid`, `ServiceTile`). No greeting and no heading between them. 14 or more things to tap and 50 words or fewer, read from a dump by `qa/layout-read.mjs`. Below the fold: "Nanti hari ini" as a timeline, then "Perlu kamu urus" with only what the strip doesn't say. Nothing is said twice. | `src/screens/home/`, `qa/superapp-decisions.md` |
| Semua layanan | Behind "Lainnya" (`screen.services`, `/services`): a search field that filters, then every service in three named groups, 4 across: Harian, Akademik, Aplikasi. Each service once, with the glyph and colour it has on Beranda. | `src/screens/services/` |
| Stack top bar | `TopBar title=… actions=…`: Android's back arrow, the title at the start (Title L), one or two actions at the end, more in ⋮ (`OverflowMenu`). `lines={2}`: a long subject's name whole on two lines, the bar growing to hold it (a course's page: its name is the bar's title, never a big name in the page under an empty bar). `titleFrom={dp}`: a page that shows its subject big at its top keeps the bar's title hidden until the page has scrolled that far, then fades it in (M3's collapsing top app bar, on the UI thread, no layout moves). | `src/ui/top-bar.tsx`, `src/ui/menu.tsx` |
| Screens | Every drill-down is its own route on the native stack (`app/_layout.tsx`, `animation: "default"`: Android's own open/close, drawn natively), so Back and the back gesture work everywhere with no code. A course, a module (`/course/<code>/module/<id>`), a Task, an exam, Nilai, Materi, Ujian, Semua layanan, each part of Rencana studi (`/plan/<part>`), Settings, Search, Notifikasi, the in-app web page. On an iPhone the same stack gives the back swipe from the left edge. | `app/` |
| Sheets | `Sheet` / `ActionSheet`: Android's Material bottom sheet (react-native-screens' `FormSheet`, a `BottomSheetDialog`): the scrim fades in while the sheet slides up, drag down or Back closes it, fits its content up to the screen less a strip. Its title in the heading face (`SheetTitle`, Plus Jakarta Sans bold, as every screen's), also for a sheet that draws its own heading. The sheet's window takes the app's status bar style (React Native's extra window, as a `Modal`, with Material's own status bar handling taken out: `patches/react-native-screens…`; sent again once it's up), so the icons stay dark over the light page's scrim. | `src/ui/sheet.tsx` |
| Menus | ⋮ opens `OverflowMenu`, Material's menu hung from its button. A row's long-press menu is an `ActionSheet` (nothing to hang from). A choice with `checked` is a setting turned on and off from the menu (its state as a switch at its end, the whole item the target, read as a checkbox): Jadwal's "Ingatkan sebelum kuliah". | `src/ui/menu.tsx` |
| Snackbar | The toasts (`toast(...)`) as Material's snackbar: inverse surface, one at a time, just above the tabs' bar (or the phone's bar), Undo as its one action. | `src/ui/toasts.tsx` |
| Insets | Edge to edge. Inside a tab the tabs keep pages clear of the phone's bar. Over the tabs, a `Page` that reaches the screen's foot stops scrolling at the top of the phone's bar, with a strip of the page's colour under the bar, so nothing ever sits under three-button navigation's buttons (round 3, the real phone); `BottomBar` and Kumpulkan's bar pad by the bar's height (`useBottomInset()`). Never a hard-coded bar height. | `src/ui/insets.ts`, `src/ui/layout.tsx` |

**BackHandler** only while a sheet or an unsaved edit is open (a sheet's Back is the native sheet's own).
Anything else that wants Back is a screen: make it a route.

## The look: one page colour, flat lists, a few cards (the super-app layout, on round 2's v4 tokens)

The tokens are still `theme.v4` (the name stayed; the grey page did not). The page and a card are one colour in both
themes, so a screen is never "flat in light, boxed in dark": a list lies flat on the page with inset hairlines, and a
card (a fill, a corner) is drawn only for one thing you can pick up: Beranda's class block, Profil's head, a course, a
result, a notice. Never a card inside a card, never a grey box around a section. The decisions: `mobile/qa/superapp-decisions.md`.

| Part | What | Where |
| --- | --- | --- |
| Surfaces | `theme.v4`: `page` and `card` are the same colour (#ffffff / #161618): nothing may rely on a card standing off the page by its fill. What must stand off takes `chip` or a tint (a course's, a state's). No shadow on a card or a row (only what floats over content keeps one: a menu, the snackbar). `chip` (a neutral pill's, a neutral icon tile's and a disabled button's fill on a card: #f1f3f7 / #2a2f39, a step off the card in dark, never the page's black), `line`, `fg` / `fg2` / `muted`, `onHead` (white, on the class block and the strong block), the one filled button's `brand` / `onBrand` (#1f63e0 + white; dark #a9c4ff + #0a2a66: white on #4d86ff fails), tonal `okBg/okFg`, `redBg/redFg`, `ambBg/ambFg`, `live` (the now dot) | `src/ui/theme.ts` |
| Course tiles | `theme.courseTile(tone)` → `{ ink, tint }` for each of the ten course colours (light and dark): ink ≥ 4.6:1 on its tint and on a card. `CourseTile` (44 dp: the course's glyph, filled and solid in its ink, nothing behind it), `CourseGlyph`; the glyph is Fluent's, one per subject family, picked from the course's name (`courseGlyph`, `CourseIcons`), the same wherever the course appears | `src/ui/tile.tsx` |
| Type | Headings and numbers in Plus Jakarta Sans (`<Text face="display" weight="bold">`, also `semibold`, `extrabold`), bundled as Android font assets (`plugins/fonts.js`, OFL in the licences); everything else Roboto on the M3 scale | `src/ui/text.tsx`, `assets/fonts` |
| Press | `PressScale`: gives to 96.5% and springs back (expressive), on the UI thread; one per card or row | `src/ui/press.tsx` |
| Big button | `BigButton` (52 dp pill). One filled action per screen: `filled` on the page (the brand's blue, white words; dark: pale blue, navy words) or `course` on a block of a course's colour (white, the words in `ink`, the course's colour). `done` (tonal green, after it), `outline` (a second way; `ink` white for a white outline on a course's block) | `src/ui/big-button.tsx` |
| Absence scale | One reading of a course's absences, on every tab: **dots**, one per absence the target allows (used ones filled in the state's colour, the rest outlined, one more red dot for each over the limit), and **one short label** ("sisa 1", "habis", "lewat 1"). Never the dots plus a count plus a sentence: the sentence is the row's spoken name. `AbsenceDots`, `absenceShort`. The colour is `absenceTone(state)`: `red` once the target can't be reached or the course finished below it, `amber` with the absences used up but none over, `ok` (green) with absences left or the target met, null before SIX has a count. `absenceInk(theme.v4, tone)` → `{ bg, fg }` (`redBg/redFg`, `ambBg/ambFg`, `okBg/okFg`); `absenceName(t, health)` is the one name a warning goes by ("Jatah habis", "Lewat batas 1×"). Beranda's strip counts every course with no absence left, and says it with the same words. Amber stays a clash's and a moved class's colour too | `src/ui/absence.ts`, `src/screens/presence/absence-dots.tsx` |
| Living parts | `CookieCheck` (M3's cookie scaling in turning, its check drawing itself), `PulseDot` (the live dot: a few pulses when its screen is shown, then at rest), `CountUp` (a number counting up once per run), `Rise` (a screen's cards rising in a stagger on its first showing only). **No wave anywhere**: how far along is a plain bar (`PlainBar`, `Meter`); `WavyProgress` is drawn on no screen | `src/ui/expressive.tsx` |
| Lists | Flat on the page in both themes, an inset hairline between rows, no card around them. `CardGroup`, `Group`, `CardList`/`CardSlice`, `List`/`GroupTile` keep their names and props and draw no fill and no corner; `Panel` (both of them) draws no fill unless given a `tint` or a fill in `style`. `TileRow` / `GroupRow` (one target: a leading tile, the title, at most one meta line, at most one status; the hairline starts after the tile; `dim` for what isn't open yet), `StatusChip` / `Pill` (the row's one status as a tonal pill), `SectionTitle` / `Heading` (a section's name in Plus Jakarta Sans, its one action at the end) | `src/ui/v4-list.tsx`, `src/ui/group.tsx`, `src/ui/card-list.tsx`, `src/ui/layout.tsx` |
| Other tiles | `IconTile` (a TileRow's tile that isn't a course's: a file's kind, a module's number, a meeting's date) in a tone from `useToneTile()` (v4's red, amber, ok, brand and neutral pairs) | `src/ui/icon-tile.tsx` |
| Bars | `TopBar v4` and `TabHeader v4`: the bar in the page's own colour. Every `TopBar`'s title is in Plus Jakarta Sans bold, `v4` or not: one face for every screen's title | `src/ui/top-bar.tsx`, `src/shell/source-status.tsx` |
| Screens past Beranda | `Heading` (a section's heading in Plus Jakarta Sans), `Panel` (a section's block, flat on the page; a card only with a `tint`; with `onPress` the whole block is one springing target), `Group` + `GroupRow` (rows flat on the page: a leading tile, the title, at most one meta line in a state's tone, one trailing status; hairlines inset past the tile), `Pill` (one tonal status: red, amber, ok, brand, plain), `IconTile` (a tinted square for what isn't a course), `Figure` + `FigureLabel` (a screen's key number counting up once; `decimals` and `comma` for an IPK, "3,42"), `FigureRow` + `FigureCell` (figures side by side: one size for all, so the labels sit on one line and the numbers on one baseline; `FigureDash` for one with nothing to count). A screen using them passes `background={theme.v4.page}` to its `Page`, and its `TopBar` sits on the same page colour at rest (`usePageColor`) | `src/ui/group.tsx` (akademik) |
| Course icon tile | `CourseIconTile`: `IconTile`'s shape in a course's tint with a kind's icon in its ink, for a row that belongs to a course but isn't the course (a result, a notification) | `src/ui/course-icon-tile.tsx` (akademik) |
| Meter | `Meter`: a thin bar under a figure, a share in one colour and an optional second stretch in a lighter tone (passed, then this term); the figure says the number | `src/ui/meter.tsx` (akademik) |

### The kit: which part a screen uses for what (`src/ui/kit.tsx`, `src/ui/b.tsx`)

| For | Use | Never |
| --- | --- | --- |
| Marking attendance, anywhere | `PresenceButton` (48 dp pill, the raised hand, testID `action.presence`). `tone="page"` on the page: the brand's blue, white words. `tone="course" ink={courseColour}` on a block of a course's colour: white, the words in the course's colour. `label` is the word when it isn't "Isi Presensi" ("Tandai Hadir" for SIX, the same hand); `icon` only for the block's other main action (joining an online class); `time` puts the one time on the same line; `quiet` outlines it when nobody can say it counts | a local button, a second filled button beside it |
| A screen's one main action | `BigButton variant="filled"`, or `variant="course" ink=…` on a course's block; a second way is `outline` | two filled buttons on one screen |
| How far along (a presence window, a term) | `PlainBar`: a track, a fill, at most one label at its end. On a course's block: `color` white, `track` white at about 30% | a wave, a dot, a second label saying the same time |
| The class on now | `NowBlock` (Beranda's look: the course's deep colour in both themes, white on it; the kicker line with a dot that pulses three times then rests when `live`; the name on two lines; one `PlainBar` whose end says what it measures; the button as `children`). `NowLine` is its small size for a list (Kuliah): the name on two lines, one short line under it, the button beside it or under it as the width allows | a block drawn by hand on a screen; a dot that pulses for ever |
| A block of full colour that isn't a course's (Profil's card) | `v4.strong` / `v4.onStrong`: the same saturated blue (#1f63e0, white on it 5.4:1) in both themes, so it stays as vivid in dark as the course and exam blocks | `v4.brand` for a block: dark's is the pale #a9c4ff, made for a button on the dark page |
| A clash | `ClashMark` (the overlap icon and "Bentrok" in amber; `detail` for when) | other words or another icon for a clash |
| The strip's three | `StatTile` inside `CountStrip`: the figure in a fixed 32 dp line, the label always one line (it shrinks to 85%, then is cut: write two words), a small chevron after the label. Three cells share a baseline whatever their labels | a label that wraps; "0" (good news is `mark`) |
| A service | `ServiceTile` in a `ServiceRow` (four across), glyph and colour from `screens/services/list.ts`; `tag` for the one fact it answers with (Nilai "3,26", UKT "Lunas", KRS "14 SKS"): a small pill on the page's surface over the tile's top right corner, read with the tile's name | a service's glyph or colour chosen on the screen |
| A section's name | `SectionHeading` (`BHeading`) | all-caps labels |
| A row | `FlatRow` (`BRow`), or `TileRow` / `GroupRow` / `SettingRow`. A row with `onPress` and a free end closes with the one quiet chevron (`RowChevron`, `ui/row-end.tsx`) by itself; a row without `onPress` has none. Where the end is taken (a pill, a time), pass `chevron` to add it after; `chevron={false}` opts out (a switch's row and a danger never get one). Rows, headings and Beranda's parts share one edge: the page's, 16 dp from the screen's side (`ROW_SIDE` 0; a divider starts past the tile, `ROW_INSET` 56). A screen's own line never adds `space[1]` to sit under a heading | a card per row; a chevron drawn by the screen; a row padded in from its heading |
| Notifications off | `NotificationsOff` (`parts/notifications-off.tsx`): one line ("Notifikasi mati") and one 48 dp button in the brand's blue, one word ("Nyalakan"); `openNotificationSettings` from the same file | a second notice, a copy of the settings opener |
| Nothing to show | `EmptyState`: the icon bare (no circle, no tile), the reason, one next step | a container behind the icon |


Rules that hold (the judge's): a row has a title and at most one short meta line, at most one status (a chip or an
icon, never a sentence); no explanatory sentences on a tab's first screen (one tap deeper); Beranda's first screen
≤ 50 words and 14 or more things to tap (`mobile/qa/layout-read.mjs`), no other tab's first screen over about 45 words
(`mobile/qa/words.sh`); one title per screen; a fact is said once, where the Student acts on it. Motion on the UI thread; Remove animations: fades
and a still wave.

## Colour: Material 3 roles

`theme.color.<role>`. Pair each fill with its `on…` role; never a raw hex in a screen.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| primary / onPrimary | #245bcc / #ffffff | #8fb0ff / #0b2a6b | the one main action (filled button), links, selection |
| primaryContainer / onPrimaryContainer | #dbe6fe / #0d3a91 | #1f3f86 / #dbe6ff | a highlighted card, first-run |
| secondaryContainer / onSecondaryContainer | #dce3f4 / #16264a | #2d3851 / #dce3f7 | the tabs' indicator, picked chips and segments, tonal buttons, the empty state's icon |
| tertiaryContainer / onTertiaryContainer | #efe6fd / #3a1580 | #3c2768 / #efe6fd | ITB's own (the source's purple) |
| error / onError, errorContainer / onErrorContainer | #b42318 / #fff, #fde7e4 / #7a1710 | #ff6259 / #5c0f08, #3a1c19 / #ffdad5 | what went wrong, badges |
| surface | #ffffff | #161618 | the page |
| surfaceContainerLowest … Highest | #fff, #f6f7fb, #f0f2f7, #eaecf2, #e3e5ec | #111113, #1c1c1f, #212125, #2a2a2f, #35353b | what must stand off the page: a quiet well (Low, High), a sheet's parent (Container), tracks (Highest). The page and a card are `surface`, never a Low |
| onSurface / onSurfaceVariant | #1d1d1f / #55565e | #ececef / #b4b4bd | text: main / secondary (never lighter than onSurfaceVariant) |
| outline / outlineVariant | #7f8088 / #dfe1e8 | #8b8b94 / #3a3a41 | outlined buttons and fields (3:1) / decorative dividers only |
| inverseSurface / inverseOnSurface / inversePrimary | #2e3036 / #f1f1f6 / #aec6ff | #e4e4ea / #2a2a2f / #245bcc | the snackbar |

Meaning colours stay as the desktop names them (`warningBg/Fg`, `successBg/Fg`, `status…`, `meter…`,
the ten course colours via `theme.course(tone)`). The old names (`fg`, `muted`, `faint`, `canvas`, `edge`,
`line`, `fill`, `accent`, `accentFg`, `raised`, `sunken`, …) still work and point at their roles; new code
uses the roles. Every text/icon pair passes 4.5:1 (text) / 3:1 (icons, marks, a control's only edge) in both themes,
checked by `test/mobile/contrast.test.ts` against the values in `src/ui/palette.ts` (every pair a screen draws,
light and dark: the service tiles' white glyph on its fill, the strong block, the class on now, the course tiles, the
tab bar's picked and unpicked ink). `node mobile/qa/contrast-read.mjs` prints each pair with its ratio, worst first. A
screen that starts drawing a new pair adds it there.

**States in dark (round 3).** Over the limit is clearly red (`error` #ff6259, v4 `redFg` #ff6b61), used up clearly
amber (`warningFg`, v4 `ambFg` #ffb224): about 35° of hue apart, both 4.5:1 or more on the page. The amber fill
(`warningBg`, v4 `ambBg` #4a3600) is amber-tinted, not brown. `Segmented`'s picked segment is `picked` (light: the
secondaryContainer; dark #35508f, a blue that reads as chosen), not the role itself: a chip's course dot keeps 3:1 on
that. Checked in the contrast test ("dark's states read as what they are").

**One surface, not boxes.** The page and a card are one colour in both themes, so a list lies flat on it with an
inset hairline between rows and a section is a heading and space. A fill is for one thing you can pick up, or a state
(a tint). Shadows only on what floats over content: the snackbar, a menu.

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
| `Switch` | M3 switch (iPhone: iOS's own) | Android's own `MaterialSwitch` (`modules/material-switch`, W9): Material's track, thumb, check, ripple and TalkBack "switch, on"; colours from the roles; 52×48 to touch; the testID sits on the switch itself. A tap the screen doesn't keep goes back after 1.5 s. Without the native module (tests) the JS-drawn one stands in |
| `List` + `Row` | List items in a group | flat on the page, an inset hairline between rows, no box (light and dark alike); 56 dp min; a row that opens something ends in the one quiet chevron (`RowChevron`) or sits in a block that presses, a row that does nothing has neither; one row, one target, one outcome; `quick` names a row's swipe actions for TalkBack |
| `GroupTile` | One row of a flat list | `List`'s row drawn one by one for a FlashList (Tugas): a hairline over every row but the `first`; `last` is kept for callers and rounds nothing |
| `SettingsGroup`, `SettingRow`, `SwitchRow`, `ChoiceRow` + `ChoiceSheet` (`ui/settings-list.tsx`) | Settings lists | a `Heading` over a flat `Group`, each row a `GroupRow` (title, the value or state as its one meta line); a switch row toggles from anywhere on it with a haptic (Android's MaterialSwitch at its end, the row carrying role switch and the testID); a choice row shows its value and opens a native sheet of radio options (each option `<rowTestID>.<value>`) |
| `ErrorBanner` (`ui/settings-list.tsx`) | Banner | a page's error under its top bar with a close button, until the next try works (never a snackbar) |
| `DrawnCheck`, `Celebration` (`ui/celebrate.tsx`) | — | the earned moment: a success circle springs in and its check draws itself (Reanimated, UI thread) with the success haptic; Remove animations: a fade. `Celebration` shows it over the page without blocking taps, read by TalkBack, gone after ~1.7 s (the hand-in) |
| `SwipeRow` | Swipe to act (Gmail) | see Patterns; on the UI thread (gesture handler 3 + Reanimated) |
| `Card` | Card | plain is flat (no fill: on the page, like every list), raised (Container) is the deliberate card for the one thing that leads, sunken (High) a quiet well |
| `Section`, `PageHeader`, `Notice`, `StatRow`, `Meta` | | as before, on the scale |
| `EmptyState` | | the icon bare on the page (no circle, no tile), Title M, a line why, the next step as a button |
| `Skeleton` | | the shape of what's coming, breathing slowly (still with Remove animations) |
| `Sheet`, `ActionSheet` | Modal bottom sheet | native; `footer` for the sheet's main action |
| `OverflowMenu`, `Menu` | Menu | anchored, 48 dp items |
| `TopBar`, `BTabHeader` | Small top app bar | the page's own colour; a tab's name big on it, then Search and the bell; no avatar |
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
| Ujian | `ServiceIcons.Exams` | `document-bullet-list-clock` (a sheet with a clock: a paper sat at a set hour; a pencil on a note read as "edit") | 24 (28, 32: the 24) |
| Materi | `ServiceIcons.Materials` | `book` | 24, 28, 32 |
| KRS | `ServiceIcons.Krs` | `task-list-square-ltr` (the registration form: a list with its ticks; coins read as "top up"; never a clipboard: the Tugas tab's and a Task's) | 24 (28, 32: the 24) |
| UKT | `ServiceIcons.Bills` | `wallet` | 24, 28, 32 |
| Kalender akademik | `ServiceIcons.AcademicCalendar` | `calendar-agenda` (a calendar page of dated lines: the term's dates as a list) | 24, 28 (32: the 28) |
| Rencana studi | `ServiceIcons.StudyPlan` | `steps` (the plan to graduation: steps going up; a road sign read as map directions) | 24 (28, 32: the 24) |
| Transkrip | `ServiceIcons.Transcript` | `document-ribbon` | 24, 28, 32 |
| Notifikasi | `ServiceIcons.Notifications` | `alert` | 24, 28, 32 |
| Pengaturan | `ServiceIcons.Settings` | `settings` | 24, 28, 32 |
| Pencarian | `ServiceIcons.Search` | `search` | 24, 28, 32 |
| Lainnya | `ServiceIcons.More` | `grid` | 24, 28 (32: the 28) |
| Kurikulum | `ServiceIcons.Curriculum` | `organization` (the programme's courses as a tree of boxes; books are Materi's) | 24, 28, 32 |
| Berkas | `ServiceIcons.Files` | `folder` | 24, 28, 32 |
| Profil | `ServiceIcons.Profile` | `person` | 24, 28, 32 |
| Perlu kamu urus | `ServiceIcons.Needs` | `checkbox-person` (a box to tick that is yours; the warning triangle is a warning only) | 24 (28, 32: the 24) |
| Ringkasan awal | `ServiceIcons.FirstSummary`, `Icons.FirstSummary` | `scan-text` (a page being read: its one glyph everywhere; the history clock is "Jam berubah" only) | 24, 28, 32 |
| Jadwal bulanan | `ServiceIcons.Month`, `Icons.Month` | `calendar-month` (a month's grid of days; Kalender akademik is dated lines, the Jadwal tab a single page) | 24, 28, 32 |
| Laporkan masalah | `ServiceIcons.Report` | `chat-warning` (a message with an exclamation mark) | 24 (28, 32: the 24) |

**Service colours, one rule.** A solid colour is one of Beranda's seven; every other service is the app's own pale
blue with a blue glyph. The seven, one each: Materi blue, Ujian rose, Nilai orange, Kalender teal, KRS magenta, UKT
gold, Rencana green (`SERVICE_TONES`, `src/ui/palette.ts`). None is the states' red or amber (those say late or at
risk, never a place to go), none is violet (the class on now may be: its colour is the course's), and only one is
green. Each sits on its own step of lightness as well as its own hue, so a colour-blind eye tells them apart too
(light 37 to 60; dark 43 to 61 in even steps of about three: a dark tile must stand 3:1 off the dark page and keep
its white glyph at 3:1, which leaves only that band). Every other service, and "Lainnya", is the **quiet tile** (the
tone still named `grey`): a pale-blue square with its own glyph in blue, one treatment in both themes, on Semua
layanan, in Profil's rows and in search. Never grey (grey read as switched off), never a hue of its own (a second
rainbow). So no colour ever stands for two services. A service's glyph and colour live in
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

Nothing in the phone app draws another family: not Phosphor, not an emoji. Filled marks the Student's place (a picked tab,
a service's tile, a course's glyph) and a status that has to read at a glance; regular is everything else.

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
  A skeleton fades to its data only when the data lands in front of the Student (`useArrivalId` in `parts/arrival.ts`
  gives `CrossFade` its id): never on a hidden tab, and not on a screen whose parts already arrive (`Rise`, `Arrive`):
  one change, one move. A fold in the middle of a list arrives and folds at once (`Unfold` in `parts/unfold.tsx`).
- **Screens, sheets, menus, tabs, pull to refresh and switches are Android's own** (native stack `animation:
  "default"`, the Material sheet, NativeTabs, `RefreshControl`, MaterialSwitch). Tabs switch at once (the speed wall).
- **Tokens only** (`motion` in `ui/theme.ts`): `spatialFast/Default/Slow` for what moves, `effectsFast/Default` for
  fades and colour (never overshoot), `duration.short` 150, `medium` 250, `long` 400. A spring or duration written out
  in a screen is a bug; a new one is proposed for `theme.ts`.
- **On the UI thread**: Reanimated, or RN Animated with `useNativeDriver`. Never animate on the JS thread.
- **Joy in a few earned moments only** (`motion.expressive`, a slight overshoot; `ui/celebrate.tsx`): Kumpulkan,
  presence marked, a swipe that commits. Not on every tap.
- **Haptics on commits only** (`ui/haptics.ts`; a long press: `hold()` in `parts/hold.ts`): done, sent, saved, a swipe
  past its threshold, a long press that opens something. Never on a plain tap, a navigation or a scroll. Where a swipe
  and a menu do the same thing, each buzzes once (the swipe plays its own). The list: `qa/superapp-motion.md`, 3.
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
| First frame | The stage: Edunex Plus's blue over the whole screen (the same blue gone deep in dark), the phone's bars' icons white (`shell/welcome.tsx`). |
| A moment later | Two doors rise in the upper half, the same on both, each with its system's logo and name. Between them the app's mark with a glow behind it: the stage's one light, tight around the mark. A door's foot is empty: nothing on a door looks like something to pick. Bottom-left the headline, "Edunex dan SIX, / akhirnya di satu tempat."; under the thumb the one button, "Masuk dengan akun ITB", with the note about signing in; the language chip top-right. Then nothing moves: the stage at rest draws no frame. |
| The tap | The button becomes the status in words, in its place ("Menunggu Microsoft…", "Menyelesaikan masuk ke Edunex…", "Menghubungkan SIX juga…"), each swapped at once at full strength; the language chip and the note go with the button. Microsoft's page covers the stage while the Student types; once it hands back the stage shows again, not a spinner. |
| A system connecting | A ring is at its door's foot, already turning: a bright white half on a dim track, the brightest thing on the door, the size of the tick it becomes. Edunex's is there from the tap, SIX's when SIX starts. It's the scene's one endless move (a rotation of one small view) and runs only while a system connects and the stage is in view. |
| Each system in | Its door lights (white in light; a dimmer blue in dark, so two lit doors don't glare), 0.4 s in all. The name is never absent: midway, in about five frames, it turns from white to navy where it stands (white while the door is still more blue, navy once it's more white), and the ring gives way to the tick in the same spot at the same time. Then what the system said comes under the name, in two lines' room on both doors: the name and NIM under Edunex; the programme under SIX once SIX has said it, and nothing until then (the tick already says it's connected). Both ticks are one size and one colour. The glow widens a step (out to the first lit door, then over both). One haptic each. A door has three states (nothing, working, in) and never a fill level: nothing there is measured. |
| The first system in with the name | As its door lights, the headline becomes the greeting in the same spot and size, rising 8 dp into place: "Pagi, Dimas." (the part of the day, the first name). It's read while the other system connects, about a second in the demo. Beranda has no greeting, so it's said once, here. And the doors start closing onto the mark (0.4 s), the other's ring still turning: two become one in time that was passing anyway. A system that stopped keeps its door where it is until the hand-over. |
| The second system in | Its door lights against the first: the doors have met. The mark answers with one beat and one haptic, over as the stage starts to move. |
| The instant that door has lit (0.4 s after it's in) | The hand-over, with no hold: the whole stage (the joined doors, mark, greeting) lifts away like a curtain, starting gently, its lower edge rounded (a clear line along it in dark). Nothing on it changes while it lifts, so it moves as one picture. The lower half is never empty: the greeting is there until Beranda is. A strip of the stage's blue holds the status bar; once the curtain's edge is under it the strip fades where it is, so no edge, line or door crosses the clock. The three buttons' icons turn as the lift starts, the status bar's as the strip fades. |
| 0.7 s later | The scene is gone. Nothing of it is left on Beranda. |
| The first read in | The app's snackbar, once per install (the setting `firstScanDone`): "Semua siap.", with "Lihat ringkasan" (`screens/first-scan/said.tsx`), for 6 s. It waits for every system that's signed in to have read its parts (`SCAN_PARTS`) and for ITB's calendar, and never shows under the stage. It pushes nothing; afterwards the summary is in Semua layanan. |
| A later visit | "Ingatkan sebelum kuliah?" (`screens/home/first-run.tsx`), once: never in the first minute, during the first read or in the visit that read finished in; from the next open on, on a day with a class, until answered. A bell, the question, a close, and "Nyalakan" as a text button: nothing filled. |

Rules it keeps:

- **Nothing stands in for Beranda, and nothing of the first run sits on it.** The read's progress is Beranda's own
  blocks filling in place, never a list or a card drawn for the wait.
- **Nothing on a door is a control**, and both doors look the same until a system moves: a door's foot is empty,
  then a turning ring, then a tick, never a fill level or an empty ring (which read as a radio button), and there's
  no list of features.
- **The scene knows nothing of Beranda's layout.** Its colours are its own (`first-minute/colors.ts`), it leaves
  upward as one sheet, and all it takes from Beranda is in `first-minute/seam.ts` (the status bar's icons over
  Beranda's page, the curtain's corner). A new Beranda re-points that file, if anything.
- **Cheap to draw, still at rest.** Every colour on the stage is opaque (a resting door is the stage a step lighter,
  mixed ahead, not white laid over it), no shape is clipped, and every move is a timing that ends, on the UI thread,
  on a transform or an opacity. The hand-over is one transform on one view, set going whole the moment the second
  system is in (the mark's beat, then the lift, by delays on the UI thread), so the first read's JavaScript can't
  hold a step of it up. The greeting, the doors meeting and the glow's last step are over before the lift, so the
  sheet lifts as one picture (a hardware texture on Android, rasterised on an iPhone). A door's whole change comes from one value; its logo is drawn once. While the stage
  covers the screen it says so (`first-minute/covering.ts`): what's under it rests and stays out of TalkBack's reach.
- **Loaded only when nobody is signed in** (`first-minute/gate.tsx`): a start with someone signed in pays nothing.
- **Remove animations**: the same beats as fades (the door lighting, its name and tick turning, the headline into
  the greeting), the greeting held half a second, then the stage cross-fades to Beranda, never a cut; nothing moves,
  turns or grows (the doors stay apart, the glow keeps its size, a connecting door's ring is still, its bright half
  on its track). **TalkBack**: the headline (then the greeting),
  each door's state ("Edunex: Belum terhubung", then "Edunex terhubung" with what it learned, also announced as it
  happens), the button, and the status line as it changes; once the curtain lifts, only Beranda speaks.
- **Font size 1.3 and a small phone**: the headline's two halves share one size at which each keeps to its one line
  (at 1.3 on a 411 dp screen 22.4 sp: 29 dp letters on two 35 dp lines; on 360 dp 19.2 sp: 25 dp letters on two
  30 dp lines; never a third), and the greeting takes that size on the lower line. A door's line is 155 dp wide on
  411 dp and 130 dp on 360 dp: its two lines of facts are 26 dp each at 1.3 (52 dp, kept from the start), the doors
  shorten, the mark shrinks to its room (never under 48 dp) and stands clear under those two lines, and the note
  under the button gives way first.
- **A long name**: on its door the name keeps to one line: whole words that fit at no less than 0.8 of 14 sp, then
  fewer words, never a cut letter ("Muhammad Rizky Ramadhan Pratama" reads "Muhammad Rizky" at 1.3 on both widths,
  "Muhammad Rizky Ramadhan" at 1.0 on 411 dp). The greeting uses the first name alone, shrinking to 0.7 at most.
- **Every other way in keeps the stage, and keeps calm**: nothing red, no box. A sign-in that fails or is closed
  brings the button back where it was, and the note under it becomes the reason, white, with a mark ("Halaman masuk
  tidak bisa dibuka. Coba lagi."). No network is its own: the same place says "Tidak bisa terhubung. Cek
  internetmu, lalu coba lagi." with the no-Wi-Fi mark, also when a session was saved but nothing could be read (its
  door stays shut; the app reads by itself once the network is back, and the scene goes on from there). With SIX
  asking for the Student or failing, Edunex's door lights alone, the status says "SIX bisa dihubungkan nanti dari
  Pengaturan.", SIX's door keeps an empty foot, the greeting is up, and the hand-over goes 1.2 s later (time to read the line,
  which leaves with the stage; the doors meet as it starts); with SIX only slow, 2 s after Edunex is in, and SIX joins on Beranda. Signed out later, the
  stage is the first frame again.

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
- **Speed**: every screen calls `usePerfDrawn(ready)` (a tab: `usePerfFocused(name)`); the walls on a Galaxy A52's
  release build: cold start under 1.0 s, tab switch p90 under 100 ms, no JS block > 50 ms while moving. Draw the
  first screenful first: defer what's below it a frame, FlashList for long lists.
- **testIDs**: `screen.<name>`, `tab.<name>`, `row.<kind>.<id>`, `action.<name>`, `sheet.<name>`.

## Review checklist (before a screen is done)

Seen in the demo, light and dark, at font size 1.1 and 1.3 and with Remove animations; one filled button; a fact said
once; no card inside a card, no grey box, no hairline box. Then the scripts, each over what the phone drew:

- `node mobile/qa/touch-read.mjs <dump>`: every tap 48 dp or more, every one with a name TalkBack reads.
- `node mobile/qa/layout-read.mjs <dump>`: Beranda's four blocks, 14 taps, 50 words, a grid of four across.
- `node mobile/qa/contrast-read.mjs`: every pair, both themes; a new pair goes in `test/mobile/contrast.test.ts`.
- `npx vitest run test/mobile/no-english-left.test.ts`: every string in both languages, none left in English.
- A service keeps its glyph and colour wherever it shows; a course is its own glyph in its colour.
- Back, and the back swipe on an iPhone, from every pushed screen; the empty, loading, error and offline states seen
  once each; the testIDs of `AGENTS.md` where a flow presses.
- An iPhone has its side in the same change (`IOS.md`): a ripple is a dim there, a sheet is UIKit's, a haptic is the
  Taptic Engine's.
