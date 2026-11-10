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
| Bottom tabs | Android's own navigation bar (expo-router `NativeTabs`, a Material `BottomNavigationView`): Beranda, Jadwal, Tugas, Kuliah, Profil. Labels always shown; icons are Fluent's 24 px drawings as drawables (`tab_home`, `tab_schedule`, `tab_tasks`, `tab_courses`, `tab_profile`, each with `_filled`: a house, a calendar, a clipboard of ticks, the graduation cap, a person), regular at rest, filled when picked; the native badge (error colour) only for what needs the Student today. All tabs mounted ahead: a switch is instant, each keeps its scroll, a second tap scrolls to the top. Each tab's route wraps its page in `TabClock` (a hidden tab ignores the minute's tick until shown) and calls `usePerfFocused(name)`. | `app/(tabs)/_layout.tsx`, `plugins/tab-icons.js`, `scripts/make-tab-icons.mjs` |
| Tab top bar | One pattern on all five tabs (round 3): `TabHeader title=… actions=…`: the tab's name (Title L, Plus Jakarta Sans) with the data's status as one quiet line under it only when it says something to act on (never "Diperbarui baru saja"; tap: the sources sheet), then the tab's own one or two actions (`actions`: Jadwal's month and ⋮, Kuliah's ⋮), then `TabActions`, the same three in the same places on every tab: Search, the bell (a small dot while something's unread), the avatar (account and Settings). Just the bar: no big title under it to collapse. Beranda's bar is its own blue (`HomeBar`: the greeting as its title, then `TabActions`), fixed as the page scrolls. A problem banner follows under it. | `src/shell/source-status.tsx`, `src/screens/home/header.tsx` |
| Stack top bar | `TopBar title=… actions=…`: Android's back arrow, the title at the start (Title L), one or two actions at the end, more in ⋮ (`OverflowMenu`). `lines={2}`: a long subject's name whole on two lines, the bar growing to hold it (a course's page: its name is the bar's title, never a big name in the page under an empty bar). `titleFrom={dp}`: a page that shows its subject big at its top keeps the bar's title hidden until the page has scrolled that far, then fades it in (M3's collapsing top app bar, on the UI thread, no layout moves). | `src/ui/top-bar.tsx`, `src/ui/menu.tsx` |
| Screens | Every drill-down is its own route on the native stack (`app/_layout.tsx`, `animation: "default"`: Android's own open/close, drawn natively), so Back and the back gesture work everywhere with no code. A course, a module (`/course/<code>/module/<id>`), a Task, an exam, Nilai, each part of Rencana studi (`/plan/<part>`), Settings, Search, Notifikasi, the in-app web page. | `app/` |
| Sheets | `Sheet` / `ActionSheet`: Android's Material bottom sheet (react-native-screens' `FormSheet`, a `BottomSheetDialog`): the scrim fades in while the sheet slides up, drag down or Back closes it, fits its content up to the screen less a strip. Its title in the heading face (`SheetTitle`, Plus Jakarta Sans bold, as every screen's), also for a sheet that draws its own heading. The sheet's window takes the app's status bar style (React Native's extra window, as a `Modal`, with Material's own status bar handling taken out: `patches/react-native-screens…`; sent again once it's up), so the icons stay dark over the light page's scrim. | `src/ui/sheet.tsx` |
| Menus | ⋮ opens `OverflowMenu`, Material's menu hung from its button. A row's long-press menu is an `ActionSheet` (nothing to hang from). A choice with `checked` is a setting turned on and off from the menu (its state as a switch at its end, the whole item the target, read as a checkbox): Jadwal's "Ingatkan sebelum kuliah". | `src/ui/menu.tsx` |
| Snackbar | The toasts (`toast(...)`) as Material's snackbar: inverse surface, one at a time, just above the tabs' bar (or the phone's bar), Undo as its one action. | `src/ui/toasts.tsx` |
| Insets | Edge to edge. Inside a tab the tabs keep pages clear of the phone's bar. Over the tabs, a `Page` that reaches the screen's foot stops scrolling at the top of the phone's bar, with a strip of the page's colour under the bar, so nothing ever sits under three-button navigation's buttons (round 3, the real phone); `BottomBar` and Kumpulkan's bar pad by the bar's height (`useBottomInset()`). Never a hard-coded bar height. | `src/ui/insets.ts`, `src/ui/layout.tsx` |

**BackHandler** only while a sheet or an unsaved edit is open (a sheet's Back is the native sheet's own).
Anything else that wants Back is a screen: make it a route.

## Round 2's look: v4 (chosen by Arqila, built on Beranda first)

The direction is `mobile/design/r2-directions/v4/` on `origin/mobile-r2-mockups` (README, `build.mjs` for the exact
values, `v4-live.html` to try it). Beranda and its class sheet are built from it (`src/screens/home`); the parts below
are shared, for the next screens once Arqila has seen it in the app (Decision 23).

| Part | What | Where |
| --- | --- | --- |
| Surfaces | `theme.v4`: `page` (#f1f3f7 / #0c0e12) under `card` (#fff / #171a20, radius 20–24, a soft shadow in light only), `chip` (a neutral pill's, a neutral icon tile's and a disabled button's fill on a card: #f1f3f7 / #2a2f39, a step off the card in dark, never the page's black), `line`, `fg` / `fg2` / `muted`, the header's `head` (#1f63e0 / dark #1a3158, a deep desaturated blue; white on it 12.9:1) with `onHead`, the one filled button's `brand` / `onBrand` (#1f63e0 + white; dark #a9c4ff + #0a2a66: white on #4d86ff fails), tonal `okBg/okFg`, `redBg/redFg`, `ambBg/ambFg`, `live` (the now dot) | `src/ui/theme.ts` |
| Course tiles | `theme.courseTile(tone)` → `{ ink, tint }` for each of the ten course colours (light and dark): ink ≥ 4.6:1 on its tint and on a card. `CourseTile` (44 dp, radius 32%, the course's glyph two-tone in its ink on its tint), `CourseGlyph`; the glyph picked from the course's name (`courseGlyph`) | `src/ui/tile.tsx` |
| Type | Headings and numbers in Plus Jakarta Sans (`<Text face="display" weight="bold">`, also `semibold`, `extrabold`), bundled as Android font assets (`plugins/fonts.js`, OFL in the licences); everything else Roboto on the M3 scale | `src/ui/text.tsx`, `assets/fonts` |
| Press | `PressScale`: gives to 96.5% and springs back (expressive), on the UI thread; one per card or row | `src/ui/press.tsx` |
| Big button | `BigButton` (52 dp pill): `filled` (the screen's one main action), `done` (tonal green, after it), `outline` | `src/ui/big-button.tsx` |
| Absence scale | One colouring for a course's absences on every tab. `absenceTone(state)` → `red` once the target can't be reached or the course finished below it, `amber` with the absences used up but none over, `ok` (green) with absences left or the target met ("Sisa 2×"), null before SIX has a count. `absenceName(t, health)`: the one name each warning goes by on every chip and pill (Beranda, Perlu kamu urus, Kuliah, an exam): "Jatah habis", and "Lewat batas 1×" for the target out of reach (the desktop's "Tak bisa lagi capai 80%", said with the target on Kuliah's big number and the course's sheet). Never "Di bawah target": a course with none left can be under its target today too. `absenceInk(theme.v4, tone)` → its `{ bg, fg }` (`redBg/redFg`, `ambBg/ambFg`, `okBg/okFg`): `fg` for words and the pips' used absences, `bg` under a chip's `fg`. The tone names match Kuliah's `StatusChip`. Every pair through contrast.py: on its tint 5.95–6.79:1 light, 9.0–9.6:1 dark; on a card or the page ≥ 6.1:1; the pips at 80% on a card ≥ 4.3:1 (3:1 needed). Amber stays a clash's and a moved class's colour too | `src/ui/absence.ts` |
| Living parts | `WavyProgress` (M3 Expressive's wave up to how far along, moving; track and stop dot after), `CookieCheck` (M3's cookie scaling in turning, its check drawing itself), `PulseDot`, `CountUp` (a number counting up once per run), `Rise` (a screen's cards rising in a stagger on its first showing only) | `src/ui/expressive.tsx` |
| Lists | `CardGroup` (a white card of rows, radius 20), `TileRow` (one target: a leading tile, the title, at most one meta line, at most one status; its divider starts after the tile; `dim` for what isn't open yet), `StatusChip` (the row's one status as a tonal pill: red, amber, ok, brand, neutral), `SectionTitle` (a section's name in Plus Jakarta Sans, its one action at the end). Kuliah, the course page and the module are built from them | `src/ui/v4-list.tsx` |
| Other tiles | `IconTile` (a TileRow's tile that isn't a course's: a file's kind, a module's number, a meeting's date) in a tone from `useToneTile()` (v4's red, amber, ok, brand and neutral pairs) | `src/ui/icon-tile.tsx` |
| Bars | `TopBar v4` and `TabHeader v4`: the bar in the page's grey (the card's white once the page scrolls under it), for a screen on v4's grey page. Every `TopBar`'s title is in Plus Jakarta Sans bold, `v4` or not: one face for every screen's title | `src/ui/top-bar.tsx`, `src/shell/source-status.tsx` |
| Screens past Beranda | `Heading` (a section's heading in Plus Jakarta Sans), `Panel` (a white card; with `onPress` the whole card is one springing target; `tint`), `Group` + `GroupRow` (rows in one card: a leading tile, the title, at most one meta line in a state's tone, one trailing status; hairlines inset past the tile), `Pill` (one tonal status: red, amber, ok, brand, plain), `IconTile` (a tinted square for what isn't a course), `Figure` + `FigureLabel` (a screen's key number counting up once; `decimals` and `comma` for an IPK, "3,42"), `FigureRow` + `FigureCell` (figures side by side: one size for all, so the labels sit on one line and the numbers on one baseline; `FigureDash` for one with nothing to count). A screen using them passes `background={theme.v4.page}` to its `Page`, and its `TopBar` sits on the same grey at rest (`usePageColor`) | `src/ui/group.tsx` (akademik) |
| Course icon tile | `CourseIconTile`: `IconTile`'s shape in a course's tint with a kind's icon in its ink, for a row that belongs to a course but isn't the course (a result, a notification) | `src/ui/course-icon-tile.tsx` (akademik) |
| Meter | `Meter`: a thin bar under a figure, a share in one colour and an optional second stretch in a lighter tone (passed, then this term); the figure says the number | `src/ui/meter.tsx` (akademik) |

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
| `List` + `Row` | List items in a group | tonal tiles 2 dp apart, round group ends; 56 dp min; no chevrons; one row, one target, one outcome; `quick` names a row's swipe actions for TalkBack |
| `GroupTile` | One tile of a grouped list | the same tile as `List`'s, drawn row by row (`first`/`last` round the group's ends) for a FlashList (Tugas) |
| `SettingsGroup`, `SettingRow`, `SwitchRow`, `ChoiceRow` + `ChoiceSheet` (`ui/settings-list.tsx`) | Settings lists | v4: a `Heading` over one white `Group`, each row a `GroupRow` (title, the value or state as its one meta line); a switch row toggles from anywhere on it with a haptic (Android's MaterialSwitch at its end, the row carrying role switch and the testID); a choice row shows its value and opens a native sheet of radio options (each option `<rowTestID>.<value>`) |
| `ErrorBanner` (`ui/settings-list.tsx`) | Banner | a page's error under its top bar with a close button, until the next try works (never a snackbar) |
| `DrawnCheck`, `Celebration` (`ui/celebrate.tsx`) | — | the earned moment: a success circle springs in and its check draws itself (Reanimated, UI thread) with the success haptic; Remove animations: a fade. `Celebration` shows it over the page without blocking taps, read by TalkBack, gone after ~1.7 s (the hand-in) |
| `SwipeRow` | Swipe to act (Gmail) | see Patterns; on the UI thread (gesture handler 3 + Reanimated) |
| `Card` | Filled card | plain (Low), raised (Container, the one card that leads), sunken (High) |
| `Section`, `PageHeader`, `Notice`, `StatRow`, `Meta` | | as before, on the scale |
| `EmptyState` | | icon in a secondaryContainer circle, Title M, a line why, the next step as a button |
| `Skeleton` | | the shape of what's coming, breathing slowly (still with Remove animations) |
| `Sheet`, `ActionSheet` | Modal bottom sheet | native; `footer` for the sheet's main action |
| `OverflowMenu`, `Menu` | Menu | anchored, 48 dp items |
| `TopBar`, `TabHeader` | Small top app bar | surface at rest, surfaceContainer once the page scrolls under it (on the UI thread) |
| `Toasts` | Snackbar | |

## Motion

- **Screens**: Android's own transition (native stack `animation: "default"`) and Back; nothing drawn in JS.
- **Sheets**: the native Material sheet's slide and scrim fade, its drag and Back.
- **Tabs**: no animation (Material's bar switches at once).
- **Small things the app moves itself** use M3's springs (`motion.spatialFast/Default/Slow` for position,
  `motion.effects…` for opacity and colour, which never overshoot), on the UI thread (Reanimated, or RN
  Animated with `useNativeDriver`). Durations otherwise: `motion.duration.short` 150, `medium` 250, `long` 400.
- **Joy in a few earned moments only** (`motion.expressive`, a slight overshoot): Kumpulkan, a swipe that
  commits, Tandai Hadir done. Not on every tap.
- **Remove animations** (`useReduceMotion()`): moving things only fade; the skeleton stops breathing.
- **Endless loops run only while shown** (`useLoopWhileShown()` in `ui/motion.ts`): the wave, the "now" dot, a
  skeleton's breathing and a spinner run while their screen is in front and the app in the foreground, and stop
  otherwise (a hidden tab, a screen under a pushed one, the background). Use it for any new looping part: a loop
  left running redraws every frame for nobody (battery), and Android's tools see the app as never idle.
- **Below the fold waits for the push** (`Later` in `screens/plan/deferred.ts`): a screen's first screenful draws at
  once; its lower parts mount one per frame after the push transition ends, never during it.

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
